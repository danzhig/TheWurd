/**
 * Step 1 — fetch-sources: download every pinned source into sources/raw and verify its SHA-256
 * against sources/manifest.json. Already-downloaded files are re-verified, not re-fetched.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { RAW_DIR, SOURCES_MANIFEST } from './lib/paths';

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  layer: z.string(),
  url: z.string().url(),
  file: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  version: z.string(),
  homepage: z.string().url(),
  license: z.string(),
  licenseUrl: z.string().url(),
  licenseVerified: z.string(),
  attribution: z.string(),
  usedFor: z.string(),
  phase: z.number(),
  /** Which script downloads it: the content pipeline (default), `pnpm fonts` or `pnpm terms:fetch`. */
  pipeline: z.enum(['content', 'fonts', 'terms']).optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export function readSourcesManifest(): Source[] {
  const json = JSON.parse(fs.readFileSync(SOURCES_MANIFEST, 'utf8'));
  return z.object({ note: z.string(), sources: z.array(SourceSchema) }).parse(json).sources;
}

export function sha256(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

export async function fetchSources(): Promise<Record<string, string>> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const out: Record<string, string> = {};
  for (const src of readSourcesManifest().filter((s) => (s.pipeline ?? 'content') === 'content')) {
    const dest = path.join(RAW_DIR, src.file);
    if (!fs.existsSync(dest)) {
      console.log(`fetch  ${src.id}  ${src.url}`);
      await download(src.url, dest);
    }
    const got = sha256(dest);
    if (got !== src.sha256) {
      throw new Error(
        `Checksum mismatch for ${src.id} (${src.file}).\n  expected ${src.sha256}\n  got      ${got}\n` +
          `The upstream file has changed. Re-verify it and its license, then update sources/manifest.json deliberately.`,
      );
    }
    console.log(`ok     ${src.id}  sha256 ${got.slice(0, 12)}…`);
    out[src.id] = dest;
  }
  // Unpack the WEBC USFM zip next to it.
  const webcDir = path.join(RAW_DIR, 'webc');
  if (!fs.existsSync(webcDir)) {
    fs.mkdirSync(webcDir);
    execFileSync('unzip', ['-q', '-o', path.join(RAW_DIR, 'eng-web-c_usfm.zip'), '-d', webcDir]);
  }
  out.webcDir = webcDir;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchSources().catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
