import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ReadingPlanSchema } from '../../lib/types';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

async function openVault(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
}

const scale = (page: Page) =>
  page.getByTestId('vault-scene').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

const listLinks = (page: Page) =>
  page
    .locator(
      'section[aria-label="The path, as a list"] a[data-book], section[aria-label="The path, as a list"] a[data-bridge]',
    )
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));

test.describe('the Vault', () => {
  test('the list view exposes the same links as the ceiling', async ({ page }) => {
    await openVault(page);
    const scene = await page
      .getByTestId('vault-scene')
      .locator('a[data-book], a[data-bridge]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const list = await listLinks(page);
    expect([...list].sort()).toEqual([...scene].sort());
    expect(list).toHaveLength(plan.books.length + plan.bridges.length);
    // The books outside the path appear in both, as names (they have no pages).
    const off = await page.getByTestId('vault-scene').locator('[data-offpath]').count();
    expect(await page.locator('[data-offpath-item]').count()).toBe(off);
    expect(off).toBe(49);
    // List mode shows it.
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('region', { name: 'The path, as a list' })).toBeVisible();
    await expect(page.getByTestId('vault-view')).toBeHidden();
    await page.getByRole('link', { name: 'Exodus' }).click();
    await page.waitForURL(/\/book\/Exod\/$/);
  });

  test('the path list follows the plan order, with bridges and the John 11 detour', async ({
    page,
  }) => {
    await openVault(page);
    const hrefs = await listLinks(page);
    const expected: string[] = [];
    for (const step of plan.steps) {
      if (step.kind === 'book') expected.push(`/book/${step.id}/`);
      if (step.kind === 'bridge') expected.push(`/bridge/${step.id}/`);
      if (step.kind === 'book' && step.id === 'Luke') expected.push('/book/John/');
    }
    expect(hrefs).toEqual(expected);
  });

  test('tapping a medallion flies in and opens the book; returning pulls back out', async ({
    page,
  }) => {
    await openVault(page);
    const before = await scale(page);
    await page.getByTestId('vault-scene').locator('a[data-book="Exod"]').click();
    // A closed book lifts out of the medallion and lands exactly on the book page's cover.
    const flying = page.getByTestId('flying-book');
    await expect(flying).toBeAttached();
    await page.waitForURL(/\/book\/Exod\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-book-map', 'Exod');
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'open', {
      timeout: 3000,
    });
    await page.getByRole('link', { name: '← All books' }).click();
    // The cover closes, then the closed book shrinks back into its medallion.
    await expect(flying).toBeAttached({ timeout: 3000 });
    await page.waitForURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 4000 });
    // The camera ends where it was before flying in.
    await expect.poll(() => scale(page), { timeout: 3000 }).toBeCloseTo(before, 2);
  });

  test('keyboard focus moves along the spiral and the camera follows', async ({ page }) => {
    await openVault(page);
    await page.locator('a[data-book="Gen"]').last().focus();
    await expect(page.getByTestId('vault-scene').locator('a[data-book="Gen"]')).toHaveClass(
      /focused/,
    );
    await page.keyboard.press('ArrowRight');
    await expect(
      page.locator('section[aria-label="The path, as a list"] a[data-book="Job"]'),
    ).toBeFocused();
    await expect(page.getByTestId('vault-scene').locator('a[data-book="Job"]')).toHaveClass(
      /focused/,
    );
    await page.keyboard.press('ArrowRight');
    await expect(
      page.locator('section[aria-label="The path, as a list"] a[data-book="Exod"]'),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/book\/Exod\/$/);
  });

  test('Continue flies to the reader’s place; resume opens it', async ({ page }) => {
    await page.goto('/read/1sam-08/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', '1sam-08');
    await openVault(page);
    await expect(page.getByTestId('vault-scene').locator('a[data-book="1Sam"]')).toHaveClass(
      /current/,
    );
    const before = await scale(page);
    await page.getByTestId('continue').click();
    await expect.poll(() => scale(page)).toBeGreaterThan(before * 1.3);
    // When the flight lands, 1 Samuel is centred.
    const vp = page.viewportSize()!;
    await expect
      .poll(async () => {
        const box = (await page
          .getByTestId('vault-scene')
          .locator('a[data-book="1Sam"]')
          .boundingBox())!;
        return Math.abs(box.x + box.width / 2 - vp.width / 2);
      })
      .toBeLessThan(30);
    await page.getByTestId('resume').click();
    await page.waitForURL(/\/read\/1sam-08\/$/);
  });

  test('zooming in reveals names (semantic zoom) and stays within limits', async ({ page }) => {
    await openVault(page);
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 8; i++) await zoomIn.click();
    // Quick taps add up, to the medallion-detail limit and no further.
    await expect.poll(() => scale(page)).toBeCloseTo(2.6, 2);
    const named = await page
      .getByTestId('vault-scene')
      .locator('a[data-book][class*="named"]')
      .count();
    expect(named).toBeGreaterThan(0);
    // Wheel zoom works too.
    const before = await scale(page);
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => scale(page)).toBeLessThan(before);
  });

  test('books outside the path show a tooltip', async ({ page }) => {
    await openVault(page);
    await page.getByTestId('vault-scene').locator('[data-offpath="Rev"]').click({ force: true });
    const tip = page.getByTestId('offpath-tip');
    await expect(tip).toContainText('Revelation');
    await expect(tip).toContainText('Not on this path.');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
  });

  test('moving Job re-orders the spiral', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('sas:v1:settings', JSON.stringify({ jobAfter: 'Ruth' })),
    );
    await openVault(page);
    const books = (await listLinks(page)).filter((h) => h!.startsWith('/book/'));
    expect(books.indexOf('/book/Job/')).toBe(books.indexOf('/book/Ruth/') + 1);
    expect(books.indexOf('/book/Exod/')).toBe(books.indexOf('/book/Gen/') + 1);
  });

  test('stays under 300 interactive nodes at any zoom', async ({ page }) => {
    await openVault(page);
    const count = () => page.locator('[data-testid="vault-view"] *').count();
    expect(await count()).toBeLessThan(300);
    for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await count()).toBeLessThan(300);
  });

  test('reduced motion: no camera flight, straight to the book', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openVault(page);
    await page.getByTestId('vault-scene').locator('a[data-book="Ruth"]').click();
    await page.waitForURL(/\/book\/Ruth\/$/, { timeout: 2000 });
    await context.close();
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
    await openVault(page);
    await page.getByTestId('continue').click();
    await page.getByRole('button', { name: 'List' }).click();
    expect(errors).toEqual([]);
    await context.close();
  });

  for (const mode of ['map', 'list'] as const) {
    test(`no serious accessibility issues (${mode})`, async ({ page }) => {
      await openVault(page);
      if (mode === 'list') await page.getByRole('button', { name: 'List' }).click();
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
