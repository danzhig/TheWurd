import { expect, test, type Browser } from '@playwright/test';

/** PLAN P2.5: ambient polish, and every effect off under reduced motion. */

async function withVibrate(browser: Browser, reducedMotion: 'reduce' | 'no-preference') {
  const context = await browser.newContext({ reducedMotion });
  await context.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vibrate: unknown[] }).__vibrate = calls;
    Object.defineProperty(navigator, 'vibrate', {
      value: (p: unknown) => (calls.push(p), true),
      configurable: true,
    });
  });
  return context;
}

test.describe('ambient polish', () => {
  test('light rays turn slowly in the oculus, and stand still under reduced motion', async ({
    browser,
  }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
      const name = await page
        .locator('[class*="rays"]')
        .evaluate((el) => getComputedStyle(el).animationName);
      if (reducedMotion === 'reduce') expect(name).toBe('none');
      else expect(name).toMatch(/rays-drift/);
      await context.close();
    }
  });

  test('a short haptic tick when a section completes, once', async ({ browser }) => {
    const context = await withVibrate(browser, 'no-preference');
    const page = await context.newPage();
    const calls = () =>
      page.evaluate(() => (window as unknown as { __vibrate: unknown[] }).__vibrate);
    await page.goto('/read/gen-01/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-01');
    await page
      .getByRole('button', { name: 'Mark as read' })
      .evaluate((b) => (b as HTMLElement).click());
    await expect.poll(calls).toEqual([12]);
    // Unmarking does not tick (pressed without scrolling, which would mark it read again).
    await page
      .getByRole('button', { name: 'Mark as unread' })
      .evaluate((b) => (b as HTMLElement).click());
    await expect(page.getByRole('button', { name: 'Mark as read' })).toBeVisible();
    await page.waitForTimeout(200);
    expect(await calls()).toEqual([12]);
    await context.close();
  });

  test('no haptic tick under reduced motion', async ({ browser }) => {
    const context = await withVibrate(browser, 'reduce');
    const page = await context.newPage();
    await page.goto('/read/gen-01/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-01');
    await page
      .getByRole('button', { name: 'Mark as read' })
      .evaluate((b) => (b as HTMLElement).click());
    await expect(page.getByText('Read', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __vibrate: unknown[] }).__vibrate),
    ).toEqual([]);
    await context.close();
  });

  test('the cover shades as it opens and leaves nothing behind', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.getByTestId('vault-scene').locator('a[data-book="Ruth"]').click();
    await page.waitForURL(/\/book\/Ruth\/$/);
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'open', {
      timeout: 4000,
    });
    const cast = await page
      .locator('[data-cover-shadow]')
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(cast).toBe(0);
  });
});
