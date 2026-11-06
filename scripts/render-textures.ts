/**
 * pnpm textures — render the Vault's cloud layers and film grain once (PLAN §8: "generated once at
 * build time from SVG noise and radial gradients, exported as AVIF and WebP layers").
 * SVG turbulence is rasterised in Playwright's Chromium, then encoded to AVIF and WebP (with lossy
 * alpha, which keeps the soft layers small) by Python's Pillow. Output goes to public/textures/
 * and is committed; Vercel never runs this. Needs: Playwright's Chromium (a dev dependency) and
 * python3 with Pillow 11+ (AVIF support) on PATH.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PALETTE } from '../lib/design/tokens';
import { ROOT } from './lib/paths';

const OUT = path.join(ROOT, 'public/textures');

interface CloudSpec {
  name: string;
  size: number;
  freq: number; // base frequency of the noise; lower = larger billows
  octaves: number;
  seed: number;
  color: string; // cloud tint
  density: number; // alpha gain applied to the noise
  threshold: number; // alpha offset; more negative = sparser clouds
  clear: number; // radius (0..1 of half-size) of the clear oculus
  band: number; // radius where clouds reach full strength
  blur: number; // pre-render softening (baked in; nothing blurs at runtime)
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function cloudSvg(s: CloudSpec): string {
  const [r, g, b] = rgb(s.color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.size}" height="${s.size}">
  <defs>
    <filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${s.freq}" numOctaves="${s.octaves}" seed="${s.seed}" stitchTiles="noStitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${s.density} 0 0 0 ${s.threshold}"/>
      <feGaussianBlur stdDeviation="${s.blur}"/>
    </filter>
    <radialGradient id="ring" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="${s.clear}" stop-color="#fff" stop-opacity="0"/>
      <stop offset="${s.band}" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="1"/>
    </radialGradient>
    <mask id="m"><rect width="100%" height="100%" fill="url(#ring)"/></mask>
  </defs>
  <rect width="100%" height="100%" filter="url(#f)" mask="url(#m)"/>
</svg>`;
}

function grainSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <filter id="g" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.94  0 0 0 0 0.85  0 0.9 0 0 -0.38"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#g)"/>
</svg>`;
}

const CLOUDS: CloudSpec[] = [
  {
    name: 'clouds-far',
    size: 1600,
    freq: 0.0022,
    octaves: 5,
    seed: 11,
    color: PALETTE.smoke,
    density: 2.2,
    threshold: -0.75,
    clear: 0.2,
    band: 0.6,
    blur: 1,
  },
  {
    name: 'clouds-mid',
    size: 1600,
    freq: 0.0034,
    octaves: 5,
    seed: 29,
    color: PALETTE.cloud,
    density: 2.0,
    threshold: -0.95,
    clear: 0.28,
    band: 0.7,
    blur: 2,
  },
  {
    name: 'clouds-near',
    size: 1600,
    freq: 0.0032,
    octaves: 3,
    seed: 53,
    color: PALETTE.goldLight,
    density: 1.4,
    threshold: -0.9,
    clear: 0.38,
    band: 0.85,
    blur: 6,
  },
];

const ENCODER = `
import sys
from PIL import Image
png, base = sys.argv[1], sys.argv[2]
im = Image.open(png).convert('RGBA')
# WebP is only the fallback for browsers without AVIF, so large layers are stored smaller.
small = im if im.width <= 1024 else im.resize((1024, 1024), Image.LANCZOS)
small.save(base + '.webp', 'WEBP', quality=72, alpha_quality=85, method=6)
im.save(base + '.avif', 'AVIF', quality=65, speed=4)
`;

function encode(png: string, name: string) {
  const base = path.join(OUT, name);
  execFileSync('python3', ['-I', '-c', ENCODER, png, base]);
  const kb = (f: string) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;
  console.log(`${name}: webp ${kb(`${base}.webp`)}, avif ${kb(`${base}.avif`)}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-tex-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (name: string, svg: string, size: number) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg}</body></html>`,
    );
    const png = path.join(tmp, `${name}.png`);
    await page.screenshot({
      path: png,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    encode(png, name);
  };
  for (const c of CLOUDS) await render(c.name, cloudSvg(c), c.size);
  await render('grain', grainSvg(256), 256);
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
