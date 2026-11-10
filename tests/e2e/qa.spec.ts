/**
 * Phase 1 QA sweep (PLAN M7, §18 checks 14–17): every kind of page, in every browser project.
 * Storage blocked, reduced motion, accessibility, and the main journey there and back.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';

const PAGES = [
  { path: '/', ready: 'data-vault' },
  { path: '/book/Gen/', ready: 'data-book-map' },
  { path: '/read/gen-01/', ready: 'data-reader' },
  { path: '/bridge/br-rome/', ready: 'data-reader' },
  { path: '/path/', ready: null },
  { path: '/about/', ready: null },
  { path: '/sources/', ready: null },
] as const;

async function open(page: Page, p: (typeof PAGES)[number]) {
  await page.goto(p.path);
  await expect(page.locator('h1').first()).toBeVisible();
  if (p.ready) await expect(page.locator('html')).toHaveAttribute(p.ready, /.+/);
}

async function blockedStorage(browser: Browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage'])
      Object.defineProperty(window, name, {
        get() {
          throw new Error('blocked');
        },
      });
  });
  return context;
}

test.describe('QA sweep', () => {
  for (const p of PAGES) {
    test(`${p.path}: renders and navigates with storage blocked`, async ({ browser }) => {
      const context = await blockedStorage(browser);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page, p);
      expect(errors).toEqual([]);
      await context.close();
    });

    test(`${p.path}: no serious accessibility issues`, async ({ page }) => {
      await open(page, p);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
      ).toEqual([]);
    });
  }

  test('reduced motion: no movement longer than 150 ms along the whole journey', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    // Record every animation that moves something (transform) for longer than 150 ms.
    await context.addInitScript(() => {
      const long: string[] = [];
      (window as unknown as { __long: string[] }).__long = long;
      const check = () => {
        for (const a of document.getAnimations()) {
          const t = a.effect?.getTiming();
          const ms = Number(t?.duration) || 0;
          const kf = (a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [];
          const moves = kf.some((k) => 'transform' in k || 'translate' in k || 'scale' in k);
          if (ms > 150 && moves)
            long.push(`${(a as CSSAnimation).animationName ?? 'waapi'} ${ms}ms`);
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    const long = () => page.evaluate(() => (window as unknown as { __long: string[] }).__long);
    await open(page, PAGES[0]);
    await page.getByTestId('vault-scene').locator('a[data-book="Exod"]').click();
    await page.waitForURL(/\/book\/Exod\/$/);
    expect(await long()).toEqual([]);
    await page.locator('[data-station="exod-02"] a').click();
    await page.waitForURL(/\/read\/exod-02\/$/);
    expect(await long()).toEqual([]);
    await context.close();
  });

  test('the journey there and back: Vault → book → section → Next → book → Vault', async ({
    page,
  }) => {
    await open(page, PAGES[0]);
    await page.getByTestId('vault-scene').locator('a[data-book="Exod"]').click();
    await page.waitForURL(/\/book\/Exod\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-book-map', 'Exod');
    await page.locator('[data-station="exod-02"] a').click();
    await page.waitForURL(/\/read\/exod-02\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'exod-02');
    await page.getByTestId('next-link').click();
    await page.waitForURL(/\/read\/exod-03\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'exod-03');
    await page.getByRole('link', { name: 'Exodus map' }).click();
    await page.waitForURL(/\/book\/Exod\/$/);
    await page.getByRole('link', { name: '← All books' }).click();
    await page.waitForURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 4000 });
  });
});
