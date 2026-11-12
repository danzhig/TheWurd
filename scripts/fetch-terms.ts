/**
 * pnpm terms:fetch — download and verify the Phase 3 sources (sources/manifest.json, pipeline
 * "terms"): STEPBible's tagged Hebrew and Greek texts, lexicons and morphology codes; the
 * Douay-Rheims, KJV, Brenton and Clementine Vulgate texts; the Septuagint with morphology; and
 * Lewis & Short. They are large, so `pnpm content:build` (and CI's content check) never fetch them.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { download, readSourcesManifest, sha256 } from './fetch-sources';
import { RAW_DIR } from './lib/paths';

export async function fetchTerms(): Promise<Record<string, string>> {
  return fetchPipeline('terms');
}

/**
 * Download and verify every source of one side pipeline (`terms`, `themes`) into sources/raw.
 * Zips (eBible USFM, the SWORD module, OpenBible's data) are unpacked beside themselves.
 */
export async function fetchPipeline(pipeline: 'terms' | 'themes'): Promise<Record<string, string>> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const out: Record<string, string> = {};
  for (const src of readSourcesManifest().filter((s) => s.pipeline === pipeline)) {
    const dest = path.join(RAW_DIR, src.file);
    if (!fs.existsSync(dest)) {
      console.log(`fetch  ${src.id}`);
      await download(src.url, dest);
    }
    const got = sha256(dest);
    if (got !== src.sha256) {
      throw new Error(
        `Checksum mismatch for ${src.id} (${src.file}).\n  expected ${src.sha256}\n  got      ${got}\n` +
          `The upstream file has changed. Re-verify it and its license, then update sources/manifest.json deliberately.`,
      );
    }
    out[src.id] = dest;
    // Zipped sources (eBible USFM, SWORD modules, OpenBible data): unpack beside the zip.
    if (src.file.endsWith('.zip')) {
      const dir = path.join(RAW_DIR, src.id);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        execFileSync('unzip', ['-q', '-o', dest, '-d', dir]);
      }
      out[`${src.id}Dir`] = dir;
    }
  }
  console.log(`ok     ${Object.keys(out).length} ${pipeline} sources verified`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchTerms().catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
