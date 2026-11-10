/**
 * Lewis & Short, A Latin Dictionary (Perseus TEI, CC BY-SA 4.0): headword → its senses, each with
 * its Perseus id (e.g. "n45053.0") so a card cites the exact sense it uses. Citations (author,
 * work, quotation) are removed from the sense text; the definitions and labels are kept.
 * The 77 MB file is scanned once with regular expressions.
 */
import fs from 'node:fs';

export interface LsSense {
  id: string; // "n45053.0"
  level: number;
  n: string; // "I", "A", "1", …
  text: string;
}

export interface LsEntry {
  key: string; // "spiritus"
  id: string; // "n45053"
  orth: string; // "spīrĭtus"
  senses: LsSense[];
}

export function parseLewisShort(file: string): Map<string, LsEntry> {
  const xml = fs.readFileSync(file, 'utf8');
  const map = new Map<string, LsEntry>();
  const entry = /<entryFree\b([^>]*)>([\s\S]*?)<\/entryFree>/g;
  for (let m: RegExpExecArray | null; (m = entry.exec(xml));) {
    const attrs = m[1]!;
    const key = /\bkey="([^"]+)"/.exec(attrs)?.[1];
    if (!key || map.has(key)) continue;
    const body = m[2]!;
    const senses: LsSense[] = [];
    for (const s of body.matchAll(/<sense\b([^>]*)>([\s\S]*?)<\/sense>/g)) {
      const a = s[1]!;
      const text = clean(s[2]!);
      if (!text) continue;
      senses.push({
        id: /\bid="([^"]+)"/.exec(a)?.[1] ?? '',
        level: Number(/\blevel="(\d+)"/.exec(a)?.[1] ?? 1),
        n: /\bn="([^"]+)"/.exec(a)?.[1] ?? '',
        text: text.length > 400 ? `${text.slice(0, 399)}…` : text,
      });
    }
    map.set(key, {
      key,
      id: /\bid="([^"]+)"/.exec(attrs)?.[1] ?? '',
      orth: clean(/<orth\b[^>]*>([\s\S]*?)<\/orth>/.exec(body)?.[1] ?? key),
      senses,
    });
  }
  return map;
}

function clean(s: string): string {
  return s
    .replace(/<(bibl|cit|quote)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*[;:,]\s*(?=[;:,.])/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s;:,]+|[\s;:,]+$/g, '')
    .trim();
}
