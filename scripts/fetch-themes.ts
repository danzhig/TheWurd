/**
 * pnpm themes:fetch — download and verify the Phase 6 sources (sources/manifest.json, pipeline
 * "themes"): Nave's Topical Bible (CrossWire SWORD module) and OpenBible.info's topical data.
 * `pnpm content:build` and CI never fetch them; the theme data they produce is committed.
 */
import { fetchPipeline } from './fetch-terms';

fetchPipeline('themes').catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
