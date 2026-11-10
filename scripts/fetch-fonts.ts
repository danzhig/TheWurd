/**
 * pnpm fonts — build the site's WOFF2 fonts from the pinned upstream files (sources/manifest.json,
 * pipeline "fonts": google/fonts at a fixed commit). Each variable TTF is checksum-verified, then
 * subset with fontTools into Latin and Latin Extended WOFF2 files that keep the OpenType features
 * the design needs (true small capitals, old-style figures, ligatures, kerning). Output goes to
 * public/fonts/ with each family's OFL.txt and is committed; Vercel never runs this.
 * Needs python3 with fonttools and brotli (pip install fonttools brotli).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { download, readSourcesManifest, sha256 } from './fetch-sources';
import { RAW_DIR, ROOT } from './lib/paths';

/** Unicode ranges match the @font-face rules in styles/fonts.css. */
export const SUBSETS = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
} as const;

const FEATURES = [
  'kern',
  'liga',
  'calt',
  'ccmp',
  'locl',
  'mark',
  'mkmk',
  'rlig',
  'smcp',
  'c2sc',
  'onum',
  'lnum',
  'pnum',
  'tnum',
  'case',
  'frac',
  'numr',
  'dnom',
  'sups',
].join(',');

const FAMILIES: Record<string, string> = {
  ebgaramond: 'eb-garamond',
  cormorantgaramond: 'cormorant-garamond',
};

async function main() {
  const fonts = readSourcesManifest().filter((s) => s.pipeline === 'fonts');
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const src of fonts) {
    const file = path.join(RAW_DIR, src.file);
    if (!fs.existsSync(file)) await download(src.url, file);
    const got = sha256(file);
    if (got !== src.sha256)
      throw new Error(`Checksum mismatch for ${src.id}: expected ${src.sha256}, got ${got}`);
  }
  for (const [upstream, family] of Object.entries(FAMILIES)) {
    const dest = path.join(ROOT, 'public/fonts', family);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    for (const style of ['roman', 'italic'] as const) {
      const src = fonts.find((s) => s.id === `font-${upstream}-${style}`);
      if (!src) throw new Error(`sources/manifest.json has no font-${upstream}-${style}`);
      for (const [subset, unicodes] of Object.entries(SUBSETS)) {
        const out = path.join(
          dest,
          `${family}-${subset}-${style === 'roman' ? 'normal' : 'italic'}.woff2`,
        );
        execFileSync('python3', [
          '-I',
          '-m',
          'fontTools.subset',
          path.join(RAW_DIR, src.file),
          `--unicodes=${unicodes}`,
          `--layout-features=${FEATURES}`,
          '--flavor=woff2',
          '--no-hinting',
          '--desubroutinize',
          `--output-file=${out}`,
        ]);
      }
    }
    if (family === 'cormorant-garamond')
      ogFont(fonts.find((s) => s.id === `font-${upstream}-roman`)!.file);
    const licence = fonts.find((s) => s.id === `font-${upstream}-licence`)!;
    fs.copyFileSync(path.join(RAW_DIR, licence.file), path.join(dest, 'OFL.txt'));
    console.log(`ok  ${family}: ${fs.readdirSync(dest).join(', ')}`);
  }
}

/**
 * A static Cormorant Garamond (weight 500, Latin) as TTF for the build-time Open Graph images
 * (app/read/[sectionId]/opengraph-image.tsx): the image renderer cannot read WOFF2 or variable fonts.
 */
function ogFont(file: string) {
  const dir = path.join(ROOT, 'content/og');
  fs.mkdirSync(dir, { recursive: true });
  const instance = path.join(RAW_DIR, 'cormorant-500.ttf');
  execFileSync('python3', [
    '-I',
    '-m',
    'fontTools.varLib.instancer',
    path.join(RAW_DIR, file),
    'wght=500',
    '--static',
    `--output=${instance}`,
  ]);
  execFileSync('python3', [
    '-I',
    '-m',
    'fontTools.subset',
    instance,
    `--unicodes=${SUBSETS.latin}`,
    '--layout-features=kern,liga,smcp,c2sc,onum',
    '--no-hinting',
    `--output-file=${path.join(dir, 'cormorant-garamond-500.ttf')}`,
  ]);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
