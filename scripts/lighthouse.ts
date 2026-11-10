/**
 * Lighthouse, mobile profile (PLAN M7): performance ≥ 90 and accessibility ≥ 95 on the main page
 * types. Serves the built `out/` locally (gzip, like the production host) and uses Playwright's
 * Chromium. Run after `pnpm build`: `pnpm lighthouse`.
 */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const PORT = 4174;
const DEBUG_PORT = 9333;
const PAGES = ['/', '/book/Gen/', '/read/gen-01/', '/path/'];
const MIN = { performance: 0.9, accessibility: 0.95 };

async function main() {
  const server = spawn('node', ['scripts/serve-static.mjs', 'out', String(PORT)], {
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${DEBUG_PORT}`] });
  const failures: string[] = [];
  try {
    for (const path of PAGES) {
      const result = await lighthouse(`http://localhost:${PORT}${path}`, {
        port: DEBUG_PORT,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility'],
      });
      const lhr = result!.lhr;
      const scores = Object.fromEntries(
        Object.entries(lhr.categories).map(([k, v]) => [k, v.score ?? 0]),
      ) as Record<keyof typeof MIN, number>;
      const lcp = lhr.audits['largest-contentful-paint']?.displayValue ?? '?';
      const tbt = lhr.audits['total-blocking-time']?.displayValue ?? '?';
      console.log(
        `${path.padEnd(16)} performance ${Math.round(scores.performance * 100)}  accessibility ${Math.round(scores.accessibility * 100)}  LCP ${lcp}  TBT ${tbt}`,
      );
      for (const [k, min] of Object.entries(MIN) as [keyof typeof MIN, number][]) {
        if (scores[k] < min)
          failures.push(`${path} ${k} ${Math.round(scores[k] * 100)} < ${min * 100}`);
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (failures.length) {
    console.error(`\nLighthouse below target:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nLighthouse OK');
}

void main();
