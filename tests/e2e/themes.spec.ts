import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Themes view (PLAN §16, P6.3). The switch is an active flight both ways (owner,
 * 2026-11-12): stars are sampled mid-flight and must be between their book's medallion and their
 * constellation, never jumping. The stars are canvas pixels, so the page exposes their positions
 * (`window.__sasStars`).
 */
type Sample = {
  p: number;
  fade: boolean;
  stars: {
    home: { x: number; y: number };
    end: { x: number; y: number };
    now: { x: number; y: number };
  }[];
} | null;

const sample = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sasStars: () => Sample }).__sasStars());

async function openVault(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
}

/** Wait until the flight is between `lo` and `hi`, then report how many stars are on their way. */
async function midFlight(page: Page, lo: number, hi: number) {
  let s: Sample = null;
  await expect
    .poll(
      async () => {
        s = await sample(page);
        return !!s && s.p > lo && s.p < hi;
      },
      { intervals: [16], timeout: 5000 },
    )
    .toBe(true);
  const stars = s!.stars;
  const between = stars.filter(
    (t) =>
      Math.hypot(t.now.x - t.home.x, t.now.y - t.home.y) > 1 &&
      Math.hypot(t.now.x - t.end.x, t.now.y - t.end.y) > 1,
  );
  return between.length / stars.length;
}

test.describe('themes', () => {
  test('switching flies every star from its book to its constellation, and back', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'to-themes');
    // Mid-flight the spiral is still there, fading, and the stars are on their way.
    expect(await midFlight(page, 0.45, 0.55)).toBeGreaterThan(0.9);
    await expect(page.getByTestId('spiral-layer')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 5000,
    });
    await expect(page.getByTestId('spiral-layer')).toHaveCount(0);
    await expect(page.locator('[data-constellation]')).toHaveCount(10);
    expect((await sample(page))!.p).toBe(1);

    await page.getByTestId('view-spiral').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'to-spiral');
    expect(await midFlight(page, 0.45, 0.55)).toBeGreaterThan(0.9);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'spiral', {
      timeout: 5000,
    });
    await expect(page.getByTestId('themes-layer')).toHaveCount(0);
    await expect(page.locator('[data-testid="vault-scene"] a[data-book]').first()).toBeVisible();
    expect((await sample(page))!.p).toBe(0);
  });

  test('a constellation opens to its passages; a passage opens the reader at its verse', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    await page.locator('[data-constellation="mercy"]').click({ force: true });
    const passages = page.locator('[data-passage^="mercy-"]');
    await expect(passages.first()).toBeAttached({ timeout: 6000 });
    expect(await page.locator('[data-testid="vault-view"] *').count()).toBeLessThan(300);
    // Zoomed all the way in, still under the budget.
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await page.locator('[data-testid="vault-view"] *').count()).toBeLessThan(300);

    const href = (await passages.first().getAttribute('href'))!;
    expect(href).toMatch(/^\/read\/[^/]+\/\?theme=mercy-[a-z]+#v-\d+-\d+$/);
    // Click that very link (the stars are small and the camera may still be gliding, so a click
    // by position could land on a neighbour), then wait for its own section.
    await passages.first().dispatchEvent('click');
    const section = href.split('/')[2]!;
    await page.waitForURL(new RegExp(`/read/${section}/`));
    await expect(page.locator('html')).toHaveAttribute('data-reader', section);
    await expect(page.locator(`[id="${href.split('#')[1]}"]`)).toBeAttached();
    // Back on the Vault, it is still showing the themes.
    await page.goBack();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes');
  });

  test('reduced motion cross-fades instead of flying', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openVault(page);
    await page.getByTestId('view-themes').click();
    let s: Sample = null;
    await expect
      .poll(async () => (s = await sample(page)) && s.p > 0, { intervals: [16], timeout: 3000 })
      .toBe(true);
    expect(s!.fade).toBe(true);
    for (const t of s!.stars) expect(t.now).toEqual(t.end);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 1500,
    });
    await context.close();
  });

  test('no serious accessibility issues in the Themes view', async ({ page }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
});
