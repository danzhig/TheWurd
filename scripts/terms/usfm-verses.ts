/**
 * Plain verse text from an eBible USFM folder (Douay-Rheims, KJV, Brenton, Clementine Vulgate):
 * footnotes, cross-references and word markup removed, nothing else changed. Keys use USFM book
 * codes in each text's own numbering, e.g. "GEN.1.2".
 */
import fs from 'node:fs';
import path from 'node:path';

export function readUsfmVerses(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of fs
    .readdirSync(dir)
    .filter((x) => x.endsWith('.usfm'))
    .sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const book = /\\id\s+([0-9A-Z]{3})/.exec(src)?.[1];
    if (!book) continue;
    let chapter = 0;
    let key: string | null = null;
    let buf: string[] = [];
    const flush = () => {
      if (key) out.set(key, clean(buf.join(' ')));
      key = null;
      buf = [];
    };
    // Notes can span lines: drop them from the whole book first.
    const body = src.replace(/\\f\s[\s\S]*?\\f\*/g, ' ').replace(/\\x\s[\s\S]*?\\x\*/g, ' ');
    for (const line of body.split(/\r?\n/)) {
      const c = /^\\c\s+(\d+)/.exec(line);
      if (c) {
        flush();
        chapter = Number(c[1]);
        continue;
      }
      const v = /^\\v\s+(\d+)\S*\s?(.*)$/.exec(line);
      if (v) {
        flush();
        key = `${book}.${chapter}.${v[1]}`;
        buf.push(v[2] ?? '');
        continue;
      }
      // Paragraph and poetry markers continue the current verse.
      if (key && /^\\(p|m|q\d?|pi\d?|li\d?|nb|b)\b/.test(line))
        buf.push(line.replace(/^\\\S+\s?/, ''));
      else if (key && !line.startsWith('\\')) buf.push(line);
    }
    flush();
  }
  return out;
}

function clean(s: string): string {
  return s
    .replace(/\\\+?(?!w\b|w\*)[a-z]+\d?\*?/g, '') // character styles inside words (\+nd …)
    .replace(/\\\+?w\s+([^|\\]*)(\|[^\\]*)?\\\+?w\*/g, '$1') // \w word|strong="…"\w*
    .replace(/\\\+?[a-z]+\d?\*?/g, '') // any other markers
    .replace(/\s+/g, ' ')
    .trim();
}
