import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('styleguide', () => {
  test('renders sections, fonts and textures without horizontal scroll', async ({ page }) => {
    await page.goto('/styleguide/');
    await expect(page.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeVisible();
    for (const name of [
      'Palette',
      'Text contrast',
      'Type',
      'The page',
      'Reader parts',
      'Materials',
      'Motion',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() =>
      ['EB Garamond', 'Cormorant Garamond'].map((f) => document.fonts.check(`16px "${f}"`)),
    );
    expect(loaded).toEqual([true, true]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('table tbody tr')).toHaveCount(28);
    await expect(page.locator('table')).not.toContainText('FAIL');
  });

  test('theme switch applies Vellum and persists', async ({ page }) => {
    await page.goto('/styleguide/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vault');
    await page.getByLabel('Vellum').check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
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
    await page.goto('/styleguide/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByLabel('Vellum').check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
    expect(errors).toEqual([]);
    await context.close();
  });

  for (const theme of ['vault', 'vellum'] as const) {
    test(`has no serious accessibility issues (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('sas:v1:settings', JSON.stringify({ theme: t }));
      }, theme);
      await page.goto('/styleguide/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
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
