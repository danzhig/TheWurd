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
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const out: Record<string, string> = {};
  for (const src of readSourcesManifest().filter((s) => s.pipeline === 'terms')) {
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
    // eBible texts arrive as zipped USFM: unpack beside the zip.
    if (src.file.endsWith('_usfm.zip')) {
      const dir = path.join(RAW_DIR, src.id);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        execFileSync('unzip', ['-q', '-o', dest, '-d', dir]);
      }
      out[`${src.id}Dir`] = dir;
    }
  }
  console.log(`ok     ${Object.keys(out).length} terms sources verified`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchTerms().catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
