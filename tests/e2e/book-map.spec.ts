import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ReadingPlanSchema } from '../../lib/types';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

async function openMap(page: Page, bookId: string) {
  await page.goto(`/book/${bookId}/`);
  await expect(page.locator('#page-heading')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-book-map', bookId); // laid out
}

test.describe('book maps', () => {
  test('every plan book shows all its sections, in order, each linking to its page', async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    for (const book of plan.books) {
      await openMap(page, book.id);
      const ids = await page
        .locator('[data-station]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-station')));
      expect(ids, book.id).toEqual(book.sections.map((s) => s.id));
      const hrefs = await page
        .locator('[data-station] a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      expect(hrefs, book.id).toEqual(book.sections.map((s) => `/read/${s.id}/`));
      for (const s of book.sections) {
        await expect(page.locator(`[data-station="${s.id}"]`), s.id).toHaveAttribute(
          'data-status',
          s.status,
        );
      }
    }
  });

  test('tapping a station opens the right page', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    for (const book of plan.books) {
      const s = book.sections[Math.floor(book.sections.length / 2)]!;
      await openMap(page, book.id);
      await page.locator(`[data-station="${s.id}"] a`).click();
      await page.waitForURL(new RegExp(`/read/${s.id}/$`));
      await expect(page.locator('#page-heading')).toHaveText(s.title);
    }
  });

  test('back returns to the same map position', async ({ page }) => {
    await openMap(page, 'Gen');
    const station = page.locator('[data-station="gen-17"]');
    await station.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 40));
    const y0 = await page.evaluate(() => window.scrollY);
    expect(y0).toBeGreaterThan(200);
    await station.locator('a').click();
    await page.waitForURL(/\/read\/gen-17\/$/);
    await page.goBack();
    await page.waitForURL(/\/book\/Gen\/$/);
    await expect(station).toBeInViewport();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0 - 5);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y0)).toBeLessThanOrEqual(5);

    // The reader's up link lands in the same place too.
    await station.locator('a').click();
    await page.waitForURL(/\/read\/gen-17\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-17');
    await page.getByRole('link', { name: 'Genesis map' }).click();
    await page.waitForURL(/\/book\/Gen\/$/);
    await expect(station).toBeInViewport();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y0)).toBeLessThanOrEqual(5);
  });

  test('the cover opens on arrival, not again on return', async ({ page }) => {
    await page.goto('/book/Exod/', { waitUntil: 'commit' });
    const cover = page.getByTestId('book-cover');
    await expect(cover).toBeAttached();
    await expect(cover).toBeHidden({ timeout: 3000 });
    await expect(page.locator('html')).toHaveAttribute('data-book-map', 'Exod');
    await page.locator('[data-station="exod-02"] a').click();
    await page.waitForURL(/\/read\/exod-02\/$/);
    await page.goBack();
    await page.waitForURL(/\/book\/Exod\/$/);
    await expect(cover).toBeHidden();
  });

  test('under reduced motion the pages simply appear, with no overlays', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openMap(page, 'Josh');
    await expect(page.getByTestId('book-cover')).toBeHidden();
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'open');
    await page.locator('[data-station="josh-02"] a').click();
    await page.waitForURL(/\/read\/josh-02\/$/);
    await expect(page.locator('#transition-layer > *')).toHaveCount(0);
    await context.close();
  });

  test('a station grows into the page of verses, and shrinks back into it', async ({ page }) => {
    await openMap(page, 'Exod');
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'open', {
      timeout: 3000,
    });
    await page.locator('[data-station="exod-03"] a').click();
    await expect(page.getByTestId('paper')).toBeAttached();
    await page.waitForURL(/\/read\/exod-03\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'exod-03');
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.waitForURL(/\/book\/Exod\/$/);
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('[data-station="exod-03"] [data-mark]')).toBeInViewport();
  });

  test('station labels: range on tap-and-hold on a phone, always on desktop', async ({
    page,
  }, info) => {
    await openMap(page, 'Gen');
    const range = page.locator('[data-station="gen-07"] [class*="range"]');
    const height = async () => (await range.boundingBox())?.height ?? 0;
    if (info.project.name === 'phone') {
      expect(await height()).toBeLessThanOrEqual(1); // visually hidden, still read aloud
      const link = page.locator('[data-station="gen-07"] a');
      await link.scrollIntoViewIfNeeded();
      const box = (await link.boundingBox())!;
      await page.mouse.move(box.x + 30, box.y + 20);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await expect.poll(height).toBeGreaterThan(10);
      await expect(page).toHaveURL(/\/book\/Gen\/$/); // the hold did not navigate
    } else {
      expect(await height()).toBeGreaterThan(10);
    }
  });

  test('the map shows progress and where the reader last was', async ({ page }) => {
    await page.goto('/read/gen-01/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-01');
    // Without scrolling: reaching the end marks the section read and replaces the button.
    await page
      .getByRole('button', { name: 'Mark as read' })
      .evaluate((b) => (b as HTMLElement).click());
    await page.keyboard.press('Escape'); // up a level, to the book map
    await page.waitForURL(/\/book\/Gen\/$/);
    await expect(page.getByTestId('book-progress')).toHaveText('1 of 20 sections read');
    await expect(page.locator('[data-station="gen-01"]')).toHaveClass(/done/);
    await expect(page.locator('[data-station="gen-01"]')).toHaveClass(/current/);
  });

  test('the Vault list links to every book map', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('section[aria-label="The path, as a list"] a[data-book]');
    await expect(links).toHaveCount(plan.books.length);
  });

  for (const theme of ['vault', 'vellum'] as const) {
    test(`no serious accessibility issues on a book map (${theme})`, async ({ page }) => {
      await page.addInitScript(
        (t) => localStorage.setItem('sas:v1:settings', JSON.stringify({ theme: t })),
        theme,
      );
      await openMap(page, 'Deut');
      await expect(page.getByTestId('book-cover')).toBeHidden({ timeout: 3000 });
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
