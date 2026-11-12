import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The library (Phase 5, P5.3): one book from each group opens as a book map, a section reads, and
 * Next leads on through the library without touching the path's progress or "Continue" place.
 */
const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
  books: { id: string; name: string; group: string; library?: boolean }[];
  sections: { id: string; bookId: string; order: number; title: string; library?: boolean }[];
};

// The first library book of each group, from the manifest (books are in canonical order).
const firstOfGroup = new Map<string, string>();
for (const b of manifest.books)
  if (b.library && !firstOfGroup.has(b.group)) firstOfGroup.set(b.group, b.id);

const sectionsOf = (bookId: string) =>
  manifest.sections.filter((s) => s.bookId === bookId).sort((a, z) => a.order - z.order);

async function serious(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('the library', () => {
  test('every group has a library book', () => {
    expect([...firstOfGroup.keys()].sort()).toEqual(
      [...new Set(manifest.books.filter((b) => b.library).map((b) => b.group))].sort(),
    );
    expect(firstOfGroup.size).toBe(7);
  });

  for (const [group, bookId] of firstOfGroup) {
    test(`${group}: ${bookId} opens and reads`, async ({ page }) => {
      const [first, second] = sectionsOf(bookId);
      await page.goto(`/book/${bookId}/`);
      await expect(page.locator('html')).toHaveAttribute('data-book-map', /.+/);
      await expect(page.getByTestId('library-label')).toBeVisible();
      expect(await serious(page)).toEqual([]);

      await page.locator(`a[href="/read/${first!.id}/"]`).first().click();
      await page.waitForURL(`**/read/${first!.id}/`);
      await expect(page.locator('html')).toHaveAttribute('data-reader', first!.id);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(first!.title);
      await expect(page.getByTestId('library-label')).toBeVisible();
      await expect(page.locator('[data-verse]').first()).toBeVisible();
      expect(await serious(page)).toEqual([]);

      // Library pages are never stops and never the path's "Continue" place.
      await expect(page.getByRole('button', { name: 'Mark as read' })).toHaveCount(0);
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1800);
      const stored = await page.evaluate(() => ({
        last: localStorage.getItem('sas:v1:last'),
        progress: localStorage.getItem('sas:v1:progress'),
      }));
      expect(stored).toEqual({ last: null, progress: null });

      // Next leads on through the library: the book's next section, or the next library book.
      const next = page.getByTestId('next-link');
      const expected =
        second ??
        sectionsOf(manifest.books[manifest.books.findIndex((b) => b.id === bookId) + 1]!.id)[0];
      await expect(next).toHaveAttribute('data-next', expected!.id);
    });
  }

  test('the last library section ends the library, not the path', async ({ page }) => {
    const all = manifest.books.filter((b) => b.library);
    const last = sectionsOf(all[all.length - 1]!.id).at(-1)!;
    await page.goto(`/read/${last.id}/`);
    await expect(page.getByTestId('library-end')).toBeVisible();
    await expect(page.getByTestId('path-end')).toHaveCount(0);
  });
});
