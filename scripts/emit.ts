/**
 * Step 6 — emit: write public/data (manifest, per-book and per-section JSON, checksums) and the
 * Markdown copies of bridges and notes under content/plan/.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type {
  Book,
  FoldOut,
  NoteOut,
  ReadingPlan,
  SectionFile,
  SectionIndexEntry,
  Verse,
  VerseOut,
} from '../lib/types';
import { CANON } from './lib/canon';
import type { BookMapping } from './map-versification';
import { numberingDiff } from './lib/numbering';
import type { ParsedBook } from './parse-usfm';
import type { Resolution, ResolvedSection } from './resolve-plan';
import type { Source } from './fetch-sources';

export const WORDS_PER_MINUTE = 230;

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Human-readable WEBC range for a list of contiguous unit refs, e.g. '31:55–32:32'. */
export function formatUnits(units: string[]): string {
  if (!units.length) return '';
  const parse = (r: string) => {
    const [, c, rest] = r.split('.');
    const [v, part] = rest!.split('!');
    return { c: Number(c), v: Number(v), part };
  };
  const label = (x: { v: number; part?: string }) => `${x.v}${x.part ?? ''}`;
  const a = parse(units[0]!);
  const b = parse(units.at(-1)!);
  if (units.length === 1) return `${a.c}:${label(a)}`;
  return a.c === b.c ? `${a.c}:${label(a)}–${label(b)}` : `${a.c}:${label(a)}–${b.c}:${label(b)}`;
}

function minutes(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export interface EmitInput {
  plan: ReadingPlan;
  parsed: Map<string, ParsedBook>;
  mappings: Map<string, BookMapping>;
  resolution: Resolution;
  sources: Source[];
  outDir: string;
  contentDir: string | null; // where to write bridge/note Markdown; null to skip
}

export interface EmitResult {
  sectionSizes: { id: string; bytes: number; gzipBytes: number }[];
  files: number;
}

function writeJson(file: string, data: unknown): number {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify(data);
  fs.writeFileSync(file, body + '\n');
  return Buffer.byteLength(body);
}

export function buildSectionFiles(input: EmitInput): SectionFile[] {
  const { plan, mappings, resolution } = input;
  const out: SectionFile[] = [];
  for (const rs of resolution.sections) {
    const m = mappings.get(rs.bookId)!;
    const byRef = new Map(m.units.map((u) => [u.ref, u]));
    const verses: Verse[] = rs.units.map((r) => byRef.get(r)!);
    const book = plan.books.find((b) => b.id === rs.bookId)!;
    const folds: FoldOut[] = rs.folds
      .filter((f) => f.units.length)
      .map((f) => ({
        status: f.status,
        label: f.label,
        range: f.range,
        webcRange: formatUnits(f.units),
        from: f.units[0]!,
        to: f.units.at(-1)!,
      }));
    const notes: NoteOut[] = (rs.section.noteIds ?? []).map((id) => {
      const n = plan.notes.find((x) => x.id === id)!;
      if (n.section !== rs.section.id) return { id, at: 'start', text: n.text }; // shared note, shown at start
      if (n.at === 'start' || n.at === 'end' || n.at === 'fold')
        return { id, at: n.at, text: n.text };
      const verseRef = m.planToUnits.get(n.at)?.[0];
      if (!verseRef || !rs.units.includes(verseRef)) {
        throw new Error(`Note ${id}: position ${n.at} is not inside ${rs.section.id}`);
      }
      return { id, at: 'verse', verseRef, text: n.text };
    });
    const stored: VerseOut[] = verses.map(({ text, ...rest }) => {
      if (rest.blocks.map((b) => b.text).join(' ') !== text)
        throw new Error(`${rest.ref}: blocks do not reproduce the verse text`);
      return rest;
    });
    out.push({
      ...indexEntry(rs, verses, numberingDiff(rs.section.range, rs.units, m).differs),
      bookName: book.name,
      verses: stored,
      folds,
      notes,
      ...(rs.section.versificationNote ? { versificationNote: rs.section.versificationNote } : {}),
    });
  }
  return out;
}

function indexEntry(rs: ResolvedSection, verses: Verse[], webcDiffers: boolean): SectionIndexEntry {
  const s = rs.section;
  const words = verses.reduce((n, v) => n + countWords(v.text), 0);
  const e: SectionIndexEntry = {
    id: s.id,
    bookId: rs.bookId,
    order: rs.order,
    title: s.title,
    range: s.range,
    webcRange: formatUnits(rs.units),
    status: s.status,
    verseCount: verses.length,
    words,
    minutes: minutes(words),
  };
  if (s.summary) e.summary = s.summary;
  if (s.highlight) e.highlight = true;
  if (s.contentNote) e.contentNote = s.contentNote;
  if (webcDiffers) e.webcDiffers = true;
  return e;
}

export function bookChecksum(units: Verse[]): string {
  const h = createHash('sha256');
  for (const u of units) h.update(`${u.ref}\t${u.text}\n`);
  return h.digest('hex');
}

export function emit(input: EmitInput, sectionFiles: SectionFile[]): EmitResult {
  const { plan, parsed, mappings, sources, outDir } = input;
  fs.rmSync(path.join(outDir, 'sections'), { recursive: true, force: true });
  fs.rmSync(path.join(outDir, 'books'), { recursive: true, force: true });
  const planBooks = new Map(plan.books.map((b) => [b.id, b]));
  const books: Book[] = CANON.map((c, i) => {
    const p = parsed.get(c.id)!;
    const pb = planBooks.get(c.id);
    const b: Book = {
      id: c.id,
      name: pb?.name ?? c.name,
      testament: c.testament,
      group: c.group,
      canonOrder: i + 1,
      inPlan: !!pb,
      tagline: pb?.tagline ?? '',
      chapters: p.chapterLengths.length,
      verses: p.verses.length,
    };
    if (pb?.setting) b.setting = pb.setting;
    return b;
  });

  const sectionSizes: EmitResult['sectionSizes'] = [];
  let files = 0;
  for (const sf of sectionFiles) {
    const file = path.join(outDir, 'sections', `${sf.id}.json`);
    writeJson(file, sf);
    const raw = fs.readFileSync(file);
    sectionSizes.push({
      id: sf.id,
      bytes: raw.length,
      gzipBytes: gzipSync(raw, { level: 9 }).length,
    });
    files++;
  }
  const index: SectionIndexEntry[] = sectionFiles.map((sf) => {
    const e: SectionIndexEntry = {
      id: sf.id,
      bookId: sf.bookId,
      order: sf.order,
      title: sf.title,
      range: sf.range,
      webcRange: sf.webcRange,
      status: sf.status,
      verseCount: sf.verseCount,
      words: sf.words,
      minutes: sf.minutes,
    };
    if (sf.summary) e.summary = sf.summary;
    if (sf.highlight) e.highlight = true;
    if (sf.contentNote) e.contentNote = sf.contentNote;
    if (sf.webcDiffers) e.webcDiffers = true;
    return e;
  });
  for (const pb of plan.books) {
    const m = mappings.get(pb.id)!;
    writeJson(path.join(outDir, 'books', `${pb.id}.json`), {
      ...books.find((b) => b.id === pb.id),
      planName: pb.name,
      movable: pb.movable ?? false,
      excursion: pb.excursion ?? false,
      chapterLengths: parsed.get(pb.id)!.chapterLengths,
      versification: m.kind,
      sections: index.filter((s) => s.bookId === pb.id),
    });
    files++;
  }
  writeJson(path.join(outDir, 'manifest.json'), {
    planVersion: plan.version,
    baseText: plan.baseText,
    wordsPerMinute: WORDS_PER_MINUTE,
    books,
    steps: plan.steps,
    sections: index,
    bridges: plan.bridges,
    sources: sources.map(
      ({ id, name, layer, homepage, license, licenseUrl, attribution, usedFor, version }) => ({
        id,
        name,
        layer,
        homepage,
        license,
        licenseUrl,
        attribution,
        usedFor,
        version,
      }),
    ),
  });
  files++;
  const checksums: Record<string, string> = {};
  for (const pb of plan.books) checksums[pb.id] = bookChecksum(mappings.get(pb.id)!.units);
  writeJson(path.join(outDir, 'checksums.json'), checksums);
  files++;

  if (input.contentDir) writeMarkdownCopies(plan, input.contentDir);
  return { sectionSizes, files };
}

/** content/plan/bridges/<id>.md and content/plan/notes/<id>.md, generated from reading-plan.json. */
export function writeMarkdownCopies(plan: ReadingPlan, contentDir: string) {
  const bridgesDir = path.join(contentDir, 'plan/bridges');
  const notesDir = path.join(contentDir, 'plan/notes');
  for (const d of [bridgesDir, notesDir]) {
    fs.rmSync(d, { recursive: true, force: true });
    fs.mkdirSync(d, { recursive: true });
  }
  const note =
    '<!-- Generated from content/plan/reading-plan.json by pnpm content:build. Edit the JSON, not this file. -->';
  for (const b of plan.bridges) {
    fs.writeFileSync(
      path.join(bridgesDir, `${b.id}.md`),
      `---\nid: ${b.id}\nafter: ${b.after}\ntitle: ${JSON.stringify(b.title)}\n---\n\n${note}\n\n${b.text}\n`,
    );
  }
  for (const n of plan.notes) {
    fs.writeFileSync(
      path.join(notesDir, `${n.id}.md`),
      `---\nid: ${n.id}\nsection: ${n.section}\nat: ${JSON.stringify(n.at)}\n---\n\n${note}\n\n${n.text}\n`,
    );
  }
}
