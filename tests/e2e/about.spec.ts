import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('About this path', () => {
  test('opens from the Vault and links every path book and bridge', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.getByTestId('about-link').click();
    await page.waitForURL(/\/about\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'About this path' })).toBeVisible();
    // 21 Old Testament and 2 New Testament books on the main path, four bridges.
    await expect(page.locator('main a[href^="/book/"]')).toHaveCount(23);
    await expect(page.locator('main a[href^="/bridge/"]')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Why it ends with Acts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The detour into John 11' })).toBeVisible();
    await page.getByRole('link', { name: '← All books' }).click();
    await page.waitForURL(/\/$/);
  });

  test('has no serious accessibility issues', async ({ page }) => {
    await page.goto('/about/');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
});
