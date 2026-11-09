import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ReadingPlanSchema } from '../../lib/types';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);
const allSections = plan.books.flatMap((b) => b.sections.map((s) => ({ ...s, bookId: b.id })));

/**
 * The plan order with default settings, written independently of lib/path.ts: book steps in order,
 * their read and skim sections, bridges between; no skips, no optional sections, no excursion.
 */
function expectedOrder(): string[] {
  const out: string[] = [];
  for (const step of plan.steps) {
    if (step.kind === 'bridge') out.push(step.id);
    if (step.kind !== 'book') continue;
    const book = plan.books.find((b) => b.id === step.id)!;
    for (const s of book.sections) if (s.status === 'read' || s.status === 'skim') out.push(s.id);
  }
  return out;
}

const idFromUrl = (url: string) => url.match(/\/(?:read|bridge)\/([^/]+)\/?$/)?.[1] ?? url;

async function open(page: Page, id: string) {
  await page.goto(id.startsWith('br-') ? `/bridge/${id}/` : `/read/${id}/`);
  await expect(page.locator('#page-heading')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-reader', id); // hydrated
}

test.describe('reader', () => {
  test('Next walks from Genesis 1 to Acts 28 in exactly the plan order', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'The full walk runs once, at desktop size.');
    test.setTimeout(10 * 60_000);
    const visited: string[] = [];
    await open(page, 'gen-01');
    for (;;) {
      visited.push(idFromUrl(page.url()));
      const next = page.getByTestId('next-link');
      if ((await next.count()) === 0) break;
      const target = await next.getAttribute('data-next');
      await next.click();
      await page.waitForURL((u) => idFromUrl(u.toString()) === target);
      await expect(page.locator('#page-heading')).toBeVisible();
      if (visited.length > 400) throw new Error('walk did not end');
    }
    expect(visited).toEqual(expectedOrder());
    await expect(page.getByTestId('path-end')).toBeVisible();
  });

  test('every fold expands', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Covered once; phone layout is checked separately.');
    test.setTimeout(5 * 60_000);
    const withFolds = allSections.filter(
      (s) => s.inner?.length || s.status === 'skim' || s.status === 'skip',
    );
    expect(withFolds.length).toBeGreaterThan(40);
    for (const s of withFolds) {
      await open(page, s.id);
      const folds = page.locator('details[data-fold]');
      const n = await folds.count();
      expect(n, s.id).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const fold = folds.nth(i);
        await fold.locator(':scope > summary').click();
        await expect(fold, `${s.id} fold ${i}`).toHaveAttribute('open', '');
        await expect(fold.locator('[data-verse]').first(), `${s.id} fold ${i}`).toBeVisible();
      }
    }
  });

  test('notes appear at their anchors', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    for (const note of plan.notes) {
      const sectionIds = allSections.filter((s) => s.noteIds?.includes(note.id)).map((s) => s.id);
      for (const id of sectionIds) {
        await open(page, id);
        const card = page.locator(`[data-note="${note.id}"]`);
        await expect(card, `${note.id} on ${id}`).toHaveCount(1);
        await expect(card).toContainText(note.text);
        const where = await card.evaluate((el) => {
          const verses = [...document.querySelectorAll<HTMLElement>('[data-verse]')];
          const after = verses.find(
            (v) => el.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
          const before = verses.filter(
            (v) => el.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_PRECEDING,
          );
          return {
            next: after?.dataset.verse ?? null,
            first: verses[0]?.dataset.verse ?? null,
            nBefore: before.length,
            inCard:
              !!el.closest('[data-status]') &&
              el.closest('[data-status]') !== el.closest('article'),
          };
        });
        const sec = allSections.find((s) => s.id === id)!;
        if (note.section !== id || note.at === 'start') {
          expect(where.nBefore, `${note.id} at start of ${id}`).toBe(0);
        } else if (note.at === 'end') {
          expect(where.next, `${note.id} at end of ${id}`).toBeNull();
        } else if (note.at === 'fold') {
          expect(where.inCard, `${note.id} in the fold card of ${id}`).toBe(true);
        } else {
          const [c, v] = note.at.split(':');
          expect(where.next, `${note.id} before ${sec.bookId} ${note.at}`).toBe(
            `${sec.bookId}.${c}.${v}`,
          );
        }
      }
    }
  });

  test('optional detours are offered beside Next and lead back onto the path', async ({ page }) => {
    await open(page, 'luke-12');
    await expect(page.getByTestId('next-link')).toHaveAttribute('data-next', 'luke-13');
    await page.getByTestId('detour-link').click();
    await page.waitForURL(/\/read\/john-01\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'john-01');
    await expect(page.getByTestId('next-link')).toHaveAttribute('data-next', 'luke-13');
    await expect(page.getByTestId('prev-link')).toHaveAttribute('href', '/read/luke-12/');
    await open(page, 'deut-01');
    await expect(page.getByTestId('detour-link')).toHaveAttribute('href', '/read/deut-02/');
    await open(page, 'gen-20');
    await expect(page.getByTestId('next-link')).toHaveAttribute('data-next', 'job-01');
    await expect(page.getByTestId('detour-link')).toHaveCount(0);
  });

  test('keyboard moves along the path', async ({ page }) => {
    await open(page, 'gen-02');
    await page.keyboard.press('ArrowRight');
    await page.waitForURL(/\/read\/gen-03\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-03');
    await page.keyboard.press('ArrowLeft');
    await page.waitForURL(/\/read\/gen-02\/$/);
    await expect(page.locator('#page-heading')).toBeFocused();
  });

  test('progress: mark as read, skims count once seen, content notes can be hidden', async ({
    page,
  }) => {
    await open(page, 'gen-01');
    await page.getByRole('button', { name: 'Mark as read' }).click();
    await expect(page.getByText('Read', { exact: true })).toBeVisible();
    await open(page, 'gen-15');
    await expect(page.getByRole('button', { name: 'Mark as unread' })).toBeVisible();
    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sas:v1:progress') ?? '{}'),
    );
    expect(Object.keys(progress).sort()).toEqual(['gen-01', 'gen-15']);
    await open(page, 'judg-10');
    await expect(page.getByTestId('content-note')).toBeVisible();
    await page.getByRole('button', { name: 'Hide this note' }).click();
    await expect(page.getByTestId('content-note')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#page-heading')).toBeVisible();
    await expect(page.getByTestId('content-note')).toHaveCount(0);
  });

  test('reader uses Vellum by default and bridges use the Vault', async ({ page }) => {
    await open(page, 'gen-01');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
    await open(page, 'br-rome');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vault');
  });

  test('works with storage blocked', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, 'gen-01');
    await page.getByRole('button', { name: 'Mark as read' }).click();
    await page.getByTestId('next-link').click();
    await page.waitForURL(/\/read\/gen-02\/$/);
    expect(errors).toEqual([]);
    await context.close();
  });

  for (const id of ['gen-01', 'luke-09', 'job-x1', 'judg-10', 'br-greeks']) {
    test(`no serious accessibility issues: ${id}`, async ({ page }) => {
      await open(page, id);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
      ).toEqual([]);
    });
  }
});
