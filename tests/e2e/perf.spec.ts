import { expect, test } from '@playwright/test';

/**
 * PLAN §11 M5: camera transitions run at 60 fps in a performance trace on a throttled mobile
 * profile (phone viewport, CPU slowed 4×). Runs in its own Playwright project after all other
 * tests, so no other browser competes for the CPU while frames are timed.
 */
test.describe('performance', () => {
  test('camera moves hold 60 fps on a throttled mobile profile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const frames = await page.evaluate(async () => {
      const ts: number[] = [];
      let on = true;
      const tick = (t: number) => {
        ts.push(t);
        if (on) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      document.querySelector<HTMLButtonElement>('[data-testid=continue]')!.click();
      await new Promise((r) => setTimeout(r, 900));
      on = false;
      return ts.slice(1).map((t, i) => t - ts[i]!);
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sorted = [...frames].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const long = frames.filter((f) => f > 25).length;
    test.info().annotations.push({
      type: 'frames',
      description: `n=${frames.length} median=${median.toFixed(1)}ms long=${long}`,
    });
    expect(median).toBeLessThan(17.5); // 60 fps
    expect(long / frames.length).toBeLessThan(0.05);
  });
});
