/**
 * pnpm content:build — the whole content pipeline (docs/PLAN.md §5):
 *   1 fetch-sources → 2 parse-usfm → 3 map-versification → 4 resolve-plan → 5 validate → 6 emit
 * Writes public/data only when every check passes. Always writes the review reports in docs/.
 *
 * Flags:
 *   --check       rebuild in a temporary directory and fail if committed public/data differs
 *   --out <dir>   write the data to <dir> even if checks fail (for inspection; never public/data)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadingPlanSchema, verseText, type SectionFile } from '../lib/types';
import { fetchSources } from './fetch-sources';
import { parseAllBooks } from './parse-usfm';
import {
  buildMappings,
  checkStructureApprovals,
  readStructureMaps,
  type BookMapping,
} from './map-versification';
import { resolveBook, resolvePlan, type Resolution } from './resolve-plan';
import { checkLibrary, libraryBooks, readLibrary, unsectioned } from './library';
import {
  checkApprovedPlacements,
  buildShingles,
  checkChapterEnds,
  checkNoHandwrittenScripture,
  checkReferences,
} from './validate';
import {
  buildSectionFiles,
  checkOffpathTaglines,
  readOffpathTaglines,
  emit,
  writeMarkdownCopies,
  type EmitResult,
} from './emit';
import { estherDanielMap, pipelineReport, versificationLog } from './reports';
import { readTvtmsCondensed } from './lib/tvtms';
import {
  CONTENT_DIR,
  DATA_DIR,
  DECISIONS_FILE,
  DOCS_DIR as COMMITTED_DOCS,
  PLAN_FILE,
  STRUCTURE_MAPS,
} from './lib/paths';
import { readSourcesManifest } from './fetch-sources';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1] ?? '') : null;

function step(n: number, name: string) {
  console.log(`\n[${n}/6] ${name}`);
}

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.json'))
    .sort();
}

async function main() {
  const errors: string[] = [];

  step(1, 'fetch-sources');
  const paths = await fetchSources();

  step(2, 'parse-usfm');
  const parsed = parseAllBooks(paths.webcDir!);
  console.log(
    `parsed ${parsed.size} books, ${[...parsed.values()].reduce((n, b) => n + b.verses.length, 0)} verses`,
  );

  const plan = ReadingPlanSchema.parse(JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')));
  // The library (Phase 5): approved sections for books off the path, checked like the path's.
  const lib = readLibrary();
  const library = libraryBooks(lib, readOffpathTaglines().taglines);

  step(3, 'map-versification');
  const records = readTvtmsCondensed(paths.tvtms!);
  const maps = readStructureMaps(STRUCTURE_MAPS);
  let mappings: Map<string, BookMapping>;
  try {
    mappings = buildMappings(
      parsed,
      [...plan.books, ...library].map((b) => b.id),
      records,
      maps,
    );
  } catch (err) {
    console.error(`FAILED: ${(err as Error).message}`);
    process.exit(1);
  }
  for (const m of mappings.values()) {
    if (m.renumbered.length)
      console.log(`${m.book.id}: ${m.renumbered.length} plan verses renumbered (${m.kind})`);
  }

  step(4, 'resolve-plan');
  const resolution: Resolution = resolvePlan(plan, mappings);
  for (const book of library) {
    const r = resolveBook(book, mappings.get(book.id)!);
    resolution.sections.push(...r.sections);
    resolution.anchors.push(...r.anchors);
    resolution.decisions.push(...r.decisions);
    resolution.errors.push(...r.errors);
  }
  const notYet = unsectioned(lib, plan);
  console.log(
    `library: ${library.length} books sectioned, ${notYet.length} not yet (${notYet.join(', ') || 'none'})`,
  );
  errors.push(...resolution.errors);
  console.log(
    `${resolution.sections.length} sections, ${resolution.anchors.length} anchors, ${resolution.decisions.length} placement decisions`,
  );

  step(5, 'validate');
  errors.push(...checkReferences(plan));
  errors.push(...checkStructureApprovals(maps));
  errors.push(...checkApprovedPlacements(resolution.decisions, DECISIONS_FILE));
  errors.push(...checkChapterEnds(parsed));
  errors.push(...checkOffpathTaglines(plan));
  errors.push(...checkLibrary(lib, plan));
  writeMarkdownCopies(plan, CONTENT_DIR);
  errors.push(...checkNoHandwrittenScripture(CONTENT_DIR, buildShingles(parsed)));

  step(6, 'emit');
  let sectionFiles: SectionFile[] = [];
  try {
    sectionFiles = buildSectionFiles({
      plan,
      parsed,
      mappings,
      resolution,
      sources: [],
      outDir: '',
      contentDir: null,
      library,
    });
  } catch (err) {
    errors.push((err as Error).message);
  }
  const ok = errors.length === 0;
  const sources = readSourcesManifest();
  const target = CHECK
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'sas-check-'))
    : (OUT ?? (ok ? DATA_DIR : fs.mkdtempSync(path.join(os.tmpdir(), 'sas-dry-'))));
  let result: EmitResult = { sectionSizes: [], files: 0 };
  if (sectionFiles.length) {
    result = emit(
      { plan, parsed, mappings, resolution, sources, outDir: target, contentDir: null, library },
      sectionFiles,
    );
    console.log(`wrote ${result.files} files to ${path.relative(process.cwd(), target) || target}`);
    errors.push(...checkFidelity(target, mappings));
  }

  if (CHECK) {
    const a = listJson(target);
    const b = listJson(DATA_DIR);
    const diff = [...new Set([...a, ...b])].filter((f) => {
      const x = path.join(target, f);
      const y = path.join(DATA_DIR, f);
      return (
        !fs.existsSync(x) ||
        !fs.existsSync(y) ||
        fs.readFileSync(x, 'utf8') !== fs.readFileSync(y, 'utf8')
      );
    });
    if (diff.length)
      errors.push(
        `public/data is out of date (${diff.length} files differ, e.g. ${diff.slice(0, 5).join(', ')}). Run pnpm content:build.`,
      );
  } else {
    // An inspection run (--out) keeps its reports beside its data, never over the committed ones.
    const DOCS_DIR = OUT ? path.join(target, 'docs') : COMMITTED_DOCS;
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DOCS_DIR, 'versification-log.md'),
      versificationLog(plan, mappings, resolution, sectionFiles),
    );
    fs.writeFileSync(
      path.join(DOCS_DIR, 'esther-daniel-map.md'),
      estherDanielMap(plan, mappings, maps, resolution, sectionFiles),
    );
    fs.writeFileSync(
      path.join(DOCS_DIR, 'pipeline-report.md'),
      pipelineReport({
        ok: errors.length === 0,
        errors,
        plan,
        parsed,
        mappings,
        resolution,
        records,
        sectionFiles,
        sizes: result.sectionSizes,
        emitted: errors.length === 0 || !!OUT,
      }),
    );
    console.log(
      'wrote docs/versification-log.md, docs/esther-daniel-map.md, docs/pipeline-report.md',
    );
  }

  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    if (!CHECK && !OUT)
      console.error('\npublic/data was not updated. See docs/pipeline-report.md.');
    process.exit(1);
  }
  console.log('\nOK');
}

/** §16.6: emitted section files reproduce the parsed source text exactly, for a random sample of 300 verses. */
function checkFidelity(dir: string, mappings: Map<string, BookMapping>): string[] {
  const source = new Map<string, string>();
  for (const m of mappings.values()) for (const u of m.units) source.set(u.ref, u.text);
  const emitted: { ref: string; text: string }[] = [];
  for (const f of fs.readdirSync(path.join(dir, 'sections'))) {
    const sf = JSON.parse(fs.readFileSync(path.join(dir, 'sections', f), 'utf8')) as SectionFile;
    for (const v of sf.verses) emitted.push({ ref: v.ref, text: verseText(v) });
  }
  const errs: string[] = [];
  if (emitted.length !== source.size)
    errs.push(`Fidelity: emitted ${emitted.length} verses, source has ${source.size}`);
  for (let i = 0; i < 300 && emitted.length; i++) {
    const e = emitted[Math.floor(Math.random() * emitted.length)]!;
    if (source.get(e.ref) !== e.text) errs.push(`Fidelity: ${e.ref} differs from the WEBC source`);
  }
  return errs;
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
