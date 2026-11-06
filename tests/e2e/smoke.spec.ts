import { test, expect } from '@playwright/test';

test('home page renders the site title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Scripture as Story');
});
