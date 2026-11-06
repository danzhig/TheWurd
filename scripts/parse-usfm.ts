/**
 * Step 2 — parse-usfm: WEBC USFM → Verse[] per book, keeping paragraph, poetry and heading
 * structure, words of Jesus as character spans, and translator footnotes. Cross-references are
 * dropped (Phase 4 uses its own dataset).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Footnote, Verse, VerseBlock } from '../lib/types';
import { CANON, type CanonBook } from './lib/canon';

export interface ParsedBook {
  book: CanonBook;
  file: string;
  verses: Verse[];
  /** Verse count per chapter, index 0 = chapter 1. */
  chapterLengths: number[];
  /** Spaces inserted where a footnote caller sat between two words (see parseUsfm). */
  spacesInserted: number;
}

// Private-use sentinels used while parsing, removed before output.
const WJ_OPEN = '\uE000';
const WJ_CLOSE = '\uE001';
// Each footnote becomes one private-use character carrying its index (U+E100 + i).
const FN_BASE = 0xe100;
const isFn = (ch: string) => ch.charCodeAt(0) >= FN_BASE && ch.charCodeAt(0) <= 0xf8ff;
const FN_RE = /[\uE100-\uF8FF]/g;

const PARA_STYLES = new Set(['p', 'm', 'pi1', 'li1', 'q1', 'q2', 'q3', 'pc', 'nb', 'mi', 'b']);
const HEADING_MARKERS = new Set(['s1', 'ms1', 'sp', 'd']);
const SKIP_MARKERS = new Set([
  'id',
  'ide',
  'h',
  'toc1',
  'toc2',
  'toc3',
  'mt1',
  'mt2',
  'mt3',
  'is1',
  'ip',
  'ili',
  'cl',
]);

function cleanInline(s: string): string {
  return s
    .replace(/\\\+?w ([^|\\]*?)(\|[^\\]*?)?\\\+?w\*/g, '$1') // \w word|strong="…"\w*
    .replace(/\\\+?wh ([^\\]*?)\\\+?wh\*/g, '$1')
    .replace(/\\\+?(bk|qs)\*/g, '')
    .replace(/\\\+?(bk|qs) /g, '');
}

function footnoteText(raw: string): string {
  // raw is the body between "\f + " and "\f*"
  return cleanInline(raw)
    .replace(/\\fr [^\\]*/, '')
    .replace(/\\f(t|qa|q|l) /g, '')
    .replace(/\\f(t|qa|q|l)\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseUsfm(source: string, book: CanonBook, file = ''): ParsedBook {
  const footnotes: string[] = [];
  let text = source.replace(/\r\n?/g, '\n');
  text = text.replace(/\\x .*?\\x\*/gs, '');
  text = text.replace(/\\f \+ (.*?)\\f\*/gs, (_m, body: string) => {
    footnotes.push(footnoteText(body));
    if (footnotes.length > 0xf8ff - FN_BASE) throw new Error(`${book.id}: too many footnotes`);
    return String.fromCharCode(FN_BASE + footnotes.length - 1);
  });
  text = cleanInline(text)
    .replace(/\\wj /g, WJ_OPEN)
    .replace(/\\wj\*/g, WJ_CLOSE);
  // In a few places WEBC puts a footnote caller between two words with no space ("things\f…\f*in").
  // Removing the caller would glue the words, so a space is inserted there (counted in the report).
  let spacesInserted = 0;
  text = text.replace(/([\p{L},.;:])([\uE100-\uF8FF]+)(?=\p{L})/gu, (_m, a: string, fn: string) => {
    spacesInserted++;
    return `${a}${fn} `;
  });

  const verses: Verse[] = [];
  const chapterLengths: number[] = [];
  let chapter = 0;
  let style = 'p';
  let pendingBreak = true;
  let pendingHeading: string[] = [];
  let mode: 'text' | 'skip' | 'heading' = 'skip';
  const usedFootnotes = new Set<number>();
  let current: {
    c: number;
    v: number;
    blocks: { style: string; brk: boolean; raw: string }[];
    heading?: string;
  } | null = null;

  const flush = () => {
    if (!current) return;
    verses.push(finishVerse(book, current, footnotes, usedFootnotes));
    current = null;
  };

  const appendText = (s: string) => {
    if (mode === 'skip') return;
    if (mode === 'heading') {
      // Footnotes on headings (Psalm titles) are kept as text-free markers: record them as used.
      for (const ch of s.match(FN_RE) ?? []) usedFootnotes.add(ch.charCodeAt(0) - FN_BASE);
      pendingHeading.push(s.replace(FN_RE, ''));
      return;
    }
    if (!current) {
      // Text before verse 1 (e.g. the title of Sirach 51) is kept as the next verse's heading.
      if (s.trim()) pendingHeading.push(s.replace(FN_RE, ''));
      for (const ch of s.match(FN_RE) ?? []) usedFootnotes.add(ch.charCodeAt(0) - FN_BASE);
      return;
    }
    if (!s.trim() && !FN_RE.test(s)) {
      // whitespace only
      const last = current.blocks.at(-1);
      if (last) last.raw += s;
      return;
    }
    const last = current.blocks.at(-1);
    if (!last || pendingBreak) {
      current.blocks.push({ style, brk: pendingBreak, raw: s });
      pendingBreak = false;
    } else {
      last.raw += s;
    }
  };

  const markerRe = /\\([a-z]+[0-9]*)(\*?)\s?/g;
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text))) {
    appendText(text.slice(pos, m.index));
    pos = markerRe.lastIndex;
    const marker = m[1]!;
    if (m[2]) throw new Error(`${book.id}: unexpected closing marker \\${marker}*`);

    if (marker === 'c') {
      const num = /^(\d+)/.exec(text.slice(pos));
      if (!num) throw new Error(`${book.id}: bad \\c`);
      flush();
      chapter = Number(num[1]);
      chapterLengths[chapter - 1] = 0;
      pos += num[0].length;
      markerRe.lastIndex = pos;
      mode = 'skip';
      pendingBreak = true;
      style = 'p';
      continue;
    }
    if (marker === 'v') {
      const num = /^(\d+)(?:-(\d+))?\s?/.exec(text.slice(pos));
      if (!num) throw new Error(`${book.id} ${chapter}: bad \\v`);
      flush();
      const v = Number(num[1]);
      current = { c: chapter, v, blocks: [] };
      if (pendingHeading.length) {
        current.heading = pendingHeading.join(' ').replace(/\s+/g, ' ').trim();
        pendingHeading = [];
      }
      chapterLengths[chapter - 1] = Math.max(chapterLengths[chapter - 1] ?? 0, Number(num[2] ?? v));
      pos += num[0].length;
      markerRe.lastIndex = pos;
      mode = 'text';
      continue;
    }
    if (PARA_STYLES.has(marker)) {
      if (marker !== 'b') style = marker;
      pendingBreak = marker !== 'nb';
      mode = chapter > 0 ? 'text' : 'skip';
      continue;
    }
    if (HEADING_MARKERS.has(marker)) {
      mode = 'heading';
      continue;
    }
    if (SKIP_MARKERS.has(marker)) {
      mode = 'skip';
      continue;
    }
    throw new Error(`${book.id} ${chapter}: unhandled USFM marker \\${marker}`);
  }
  appendText(text.slice(pos));
  flush();
  if (usedFootnotes.size !== footnotes.length) {
    throw new Error(
      `${book.id}: ${footnotes.length - usedFootnotes.size} footnote(s) fell outside verses`,
    );
  }
  return { book, file, verses, chapterLengths, spacesInserted };
}

function finishVerse(
  book: CanonBook,
  cur: {
    c: number;
    v: number;
    blocks: { style: string; brk: boolean; raw: string }[];
    heading?: string;
  },
  footnotes: string[],
  used: Set<number>,
): Verse {
  const takeFn = (ch: string): string => {
    const i = ch.charCodeAt(0) - FN_BASE;
    used.add(i);
    return footnotes[i]!;
  };
  const blocks: VerseBlock[] = [];
  const wj: [number, number][] = [];
  const notes: Footnote[] = [];
  let joined = '';
  let wjStart = -1;
  for (const b of cur.blocks) {
    const normalized = b.raw.replace(/\s+/g, ' ').trim();
    if (!normalized.replace(FN_RE, '').trim()) {
      // A block holding only footnote markers attaches the notes to the end of the verse so far.
      for (const ch of normalized.match(FN_RE) ?? [])
        notes.push({ at: joined.length, text: takeFn(ch) });
      continue;
    }
    const sep = joined ? 1 : 0;
    let out = '';
    for (const ch of normalized) {
      // Tidy spaces left where a sentinel was removed, so recorded offsets stay valid.
      if (ch === ' ' && (out === '' || out.endsWith(' '))) continue;
      const offset = joined.length + sep + out.length;
      if (ch === WJ_OPEN) wjStart = offset;
      else if (ch === WJ_CLOSE) {
        if (wjStart >= 0 && offset > wjStart) wj.push([wjStart, offset]);
        wjStart = -1;
      } else if (isFn(ch)) notes.push({ at: offset, text: takeFn(ch) });
      else out += ch;
    }
    if (out.endsWith(' ')) out = out.slice(0, -1);
    if (!out) continue; // only markers in this block
    blocks.push({ text: out, style: b.style, brk: b.brk });
    joined += (sep ? ' ' : '') + out;
  }
  // Offsets recorded just past a trimmed trailing space point one past the end; clamp them.
  for (const n of notes) n.at = Math.min(n.at, joined.length);
  for (const span of wj) span[1] = Math.min(span[1], joined.length);
  if (wjStart >= 0 && joined.length > wjStart) wj.push([wjStart, joined.length]); // runs past verse end
  const verse: Verse = {
    ref: `${book.id}.${cur.c}.${cur.v}`,
    c: cur.c,
    v: cur.v,
    text: joined,
    blocks,
  };
  if (cur.heading) verse.heading = cur.heading;
  if (wj.length) verse.wj = wj;
  if (notes.length) verse.footnotes = notes;
  return verse;
}

export function parseAllBooks(webcDir: string): Map<string, ParsedBook> {
  const files = fs.readdirSync(webcDir).filter((f) => f.endsWith('.usfm'));
  const out = new Map<string, ParsedBook>();
  for (const book of CANON) {
    const file = files.find((f) => new RegExp(`^\\d+-${book.usfm}eng-web-c\\.usfm$`).test(f));
    if (!file) throw new Error(`WEBC file for ${book.id} (${book.usfm}) not found in ${webcDir}`);
    const src = fs.readFileSync(path.join(webcDir, file), 'utf8');
    out.set(book.id, parseUsfm(src, book, file));
  }
  return out;
}
