import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

/**
 * PLAN §11 M5: camera transitions run at 60 fps in a performance trace on a throttled mobile
 * profile (phone viewport, CPU slowed 4×). Runs in its own Playwright project after all other
 * tests, so no other browser competes for the CPU while frames are timed.
 */
test.describe('performance', () => {
  // One at a time: frame timing and paint timing must not compete for the CPU.
  test.describe.configure({ mode: 'serial' });

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

  // PLAN §12: Largest Contentful Paint under 2.5 s on a throttled mobile profile.
  for (const path of ['/', '/book/Gen/', '/read/gen-01/']) {
    test(`LCP on ${path} is under 2.5 s on a throttled phone`, async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      // Slow 4G, as Lighthouse's mobile profile: 150 ms round trip, 1.6 Mbps down.
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await page.goto(path, { waitUntil: 'load' });
      const lcp = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let last = 0;
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) last = e.startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            setTimeout(() => resolve(last), 1500);
          }),
      );
      console.log(`LCP ${path}: ${Math.round(lcp)} ms`);
      expect(lcp).toBeGreaterThan(0);
      expect(lcp).toBeLessThan(2500);
    });
  }

  // PLAN §12: initial JavaScript on `/` (the scripts its HTML loads) under 150 KB gzipped.
  test('initial JavaScript on / is under 150 KB gzipped', () => {
    const html = fs.readFileSync('out/index.html', 'utf8');
    const srcs = [
      ...new Set(
        [...html.matchAll(/<script(?![^>]*noModule)[^>]+src="([^"]+)"/g)].map((m) => m[1]!),
      ),
    ];
    const kb = srcs.reduce((n, src) => n + gzipSync(fs.readFileSync(`out${src}`)).length, 0) / 1024;
    console.log(`initial JS on /: ${kb.toFixed(1)} KB gzipped`);
    expect(kb).toBeLessThan(150);
  });
});
