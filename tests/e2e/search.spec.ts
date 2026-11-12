import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { buildSequence, type PathInput } from '../../lib/path';

const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as PathInput;
const order = buildSequence(manifest).map((i) => i.id);
const idOf = (href: string) => href.match(/\/(?:read|bridge)\/([^/#]+)\//)![1]!;

test.describe('search', () => {
  test('a name returns its sections in path order, each opening at the verse', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.getByTestId('search-link').click();
    await page.waitForURL(/\/search\/$/);
    await page.getByTestId('search-input').fill('Moses');
    await expect(page.getByTestId('search-count')).toContainText('in path order');
    const results = page.locator('[data-result]');
    await expect(results.first()).toBeVisible();
    const hrefs = await results.evaluateAll((a) => a.map((x) => x.getAttribute('href')!));
    const positions = hrefs.map((h) => order.indexOf(idOf(h)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(hrefs[0]).toMatch(/^\/read\/exod-01\/#v-\d+-\d+/);
    // Opening a result lands on the verse.
    const target = hrefs[0]!.split('#')[1]!;
    await results.first().click();
    await page.waitForURL(/\/read\/exod-01\//);
    await expect(page.locator(`[id="${target}"]`)).toBeInViewport();
  });

  test('the query is kept in the address, and an unknown word says so', async ({ page }) => {
    await page.goto('/search/?q=Zacchaeus');
    await expect(page.getByTestId('search-input')).toHaveValue('Zacchaeus');
    // Path results come first, then the library (Phase 5): Luke 19, then 2 Maccabees 10.
    const results = page.locator('[data-result]');
    await expect(results).toHaveCount(2);
    await expect(results.first()).toHaveAttribute('href', /^\/read\/luke-12\/#v-19-/);
    await expect(results.nth(1)).toHaveAttribute('href', /^\/read\/2macc-\d+\/#v-10-/);
    await page.getByTestId('search-input').fill('zzqxv');
    await expect(page.getByTestId('search-count')).toHaveText('No sections match.');
    await expect(page).toHaveURL(/\?q=zzqxv$/);
  });

  test('has no serious accessibility issues', async ({ page }) => {
    await page.goto('/search/?q=Ruth');
    await expect(page.locator('[data-result]').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });

  test('if the index cannot load, it says so (not "offline") and can try again', async ({
    page,
  }) => {
    let fail = true;
    await page.route('**/pagefind/pagefind.js', (route) =>
      fail ? route.abort() : route.continue(),
    );
    await page.goto('/search/');
    await page.getByTestId('search-input').fill('Ruth');
    await expect(page.getByTestId('search-count')).toHaveText(
      'Search could not load. Please try again.',
    );
    fail = false;
    await page.getByTestId('search-retry').click();
    await expect(page.locator('[data-result]').first()).toBeVisible();
  });
});
