import { expect, test } from '@playwright/test';

test.describe('verse links', () => {
  test('tapping a verse number copies a link to that verse', async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    await page.goto('/read/gen-01/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-01');
    await page.locator('a.verse-link[href="#v-1-3"]').click();
    await expect(page.getByTestId('copied')).toHaveText('Link to 1:3 copied');
    await expect(page).toHaveURL(/\/read\/gen-01\/#v-1-3$/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${baseURL}/read/gen-01/#v-1-3`,
    );
    await context.close();
  });

  test('a shared link opens at the verse, clear of the top bar', async ({ page }) => {
    await page.goto('/read/exod-03/#v-5-1');
    const verse = page.locator('[id="v-5-1"]');
    await expect(verse).toBeInViewport();
    const top = await verse.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(56);
  });

  test('each section has a link preview image with its title', async ({ page, request }) => {
    await page.goto('/read/luke-12/');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/\/read\/luke-12\/opengraph-image/);
    const res = await request.get(new URL(og!).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    const png = await res.body();
    expect(png.readUInt32BE(16)).toBe(1200); // PNG header: width
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Lepers, the Widow, Zacchaeus/,
    );
  });
});
