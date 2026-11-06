/**
 * Reader for the "Condensed" part of STEPBible TVTMS. Each record compares the numbering of one
 * passage across traditions (English KJV, Hebrew, Latin, Greek, …), with TEST lines that tell which
 * tradition a given Bible follows there.
 */
import fs from 'node:fs';

export interface TvtmsRow {
  type: string; // OneToOne, SubdividedVerse, MergedVerse, …
  cells: string[]; // one per tradition column, aligned with record.columns
  line: number;
}

export interface TvtmsRecord {
  header: string; // e.g. 'Gen.31:55--32:32'
  book: string; // TVTMS book abbreviation, e.g. 'Gen'
  columns: string[]; // tradition names, e.g. ['English KJV', 'Hebrew', 'Latin', 'Greek']
  tests: string[][]; // one array of test cells per TEST line, aligned with columns
  rows: TvtmsRow[];
  line: number; // 1-based line number of the header in TVTMS.txt
}

export function readTvtmsCondensed(file: string): TvtmsRecord[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('#DataStart(Condensed)'));
  const end = lines.findIndex((l) => l.startsWith('#DataEnd(Condensed)'));
  if (start < 0 || end < 0) throw new Error('TVTMS: condensed data markers not found');
  const records: TvtmsRecord[] = [];
  let cur: TvtmsRecord | null = null;
  for (let i = start + 1; i < end; i++) {
    const raw = lines[i]!;
    const cols = raw.split('\t').map((c) => c.trim());
    const first = cols[0] ?? '';
    if (first.startsWith('$')) {
      if (first.startsWith('$Section')) continue; // column legend
      const header = first.slice(1);
      const book = header.split('.')[0]!;
      const columns = trimTrailing(cols.slice(1));
      cur = { header, book, columns, tests: [], rows: [], line: i + 1 };
      records.push(cur);
      continue;
    }
    if (!cur || !first || first.startsWith('#') || first.startsWith("'")) continue;
    if (first.startsWith('TEST')) {
      cur.tests.push(cols.slice(1, 1 + cur.columns.length));
      continue;
    }
    cur.rows.push({ type: first, cells: cols.slice(1, 1 + cur.columns.length), line: i + 1 });
  }
  return records;
}

function trimTrailing(a: string[]): string[] {
  const out = [...a];
  while (out.length && !out.at(-1)) out.pop();
  return out;
}

export interface CV {
  c: number;
  v: number;
}

/**
 * Parse a TVTMS cell such as 'Gen.32:2-33', '1Sa.20:42; 21:1', 'Neh.4:1-6'. Annotations in square
 * brackets are ignored. Returns null for 'Absent…' or 'NoVerse'. Subverse suffixes (.0-3, !a) are
 * collapsed onto their verse. Cross-chapter ranges are rejected: no row the plan needs uses one.
 */
export function parseTvtmsCell(cell: string): CV[] | null {
  const s = cell.replace(/\[[^\]]*\]/g, '').trim();
  if (!s || /^Absent/i.test(s) || /^NoVerse/i.test(s)) return null;
  const out: CV[] = [];
  let chapter: number | null = null;
  for (const partRaw of s.split(';')) {
    const part = partRaw.trim().replace(/^[1-3]?[A-Za-z]+\./, '');
    const m = /^(?:(\d+):)?(\d+)(?:\.\d+(?:-\d+)?)?(?:-(\d+)(?:\.\d+)?)?\*?$/.exec(part);
    if (!m) throw new Error(`TVTMS: cannot parse reference "${cell}"`);
    if (m[1]) chapter = Number(m[1]);
    if (chapter === null) throw new Error(`TVTMS: reference without chapter "${cell}"`);
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    for (let v = from; v <= to; v++) out.push({ c: chapter, v });
  }
  return out;
}

export type TestResult = 'pass' | 'fail' | 'unknown';

/**
 * Evaluate one TEST cell against a Bible's chapter lengths. Supports Ref=Last, Ref=Exist and
 * Ref=NotExist (including subverse forms, which never exist in WEBC). Word-count comparisons are
 * reported as 'unknown' and ignored.
 */
export function evaluateTest(cell: string, chapterLengths: number[], book: string): TestResult {
  const s = cell.trim();
  if (!s) return 'unknown';
  const m = /^([1-3]?[A-Za-z]+)\.(\d+):(\d+)(?:\.(\d+))?=(Last|Exist|NotExist)$/.exec(s);
  if (!m) return 'unknown';
  if (m[1] !== book) return 'unknown';
  const c = Number(m[2]);
  const v = Number(m[3]);
  const sub = m[4];
  const last = chapterLengths[c - 1] ?? 0;
  const exists = sub && Number(sub) > 0 ? false : v >= 1 && v <= last;
  switch (m[5]) {
    case 'Last':
      return !sub && last === v ? 'pass' : 'fail';
    case 'Exist':
      return exists ? 'pass' : 'fail';
    default:
      return exists ? 'fail' : 'pass';
  }
}
