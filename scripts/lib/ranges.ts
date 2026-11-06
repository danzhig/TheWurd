/**
 * Plan range notation (reading-plan.json `rangeNotation`):
 *   'c' whole chapter; 'c-c' chapters; 'c:v-v' verses in one chapter; 'c:v-c:v' across chapters;
 *   'end' = last verse of that chapter; ';' joins parts. Chapters may be Esther's letters A–F.
 * Ranges are expanded against a book's plan-numbered verse inventory (see map-versification).
 */

export type ChapterKey = string; // '12' or 'A'
export type PlanKey = string; // '12:4' or 'A:3'

export interface Span {
  from: { c: ChapterKey; v: number | null }; // null = start of chapter
  to: { c: ChapterKey; v: number | 'end' | null }; // null = end of chapter
}

const CH = '(\\d+|[A-F])';

export function parseRange(range: string): Span[] {
  const spans: Span[] = [];
  for (const raw of range.split(';')) {
    const part = raw.trim();
    let m: RegExpExecArray | null;
    if ((m = new RegExp(`^${CH}$`).exec(part))) {
      spans.push({ from: { c: m[1]!, v: null }, to: { c: m[1]!, v: null } });
    } else if ((m = new RegExp(`^${CH}-${CH}$`).exec(part))) {
      spans.push({ from: { c: m[1]!, v: null }, to: { c: m[2]!, v: null } });
    } else if ((m = new RegExp(`^${CH}:(\\d+)$`).exec(part))) {
      spans.push({ from: { c: m[1]!, v: Number(m[2]) }, to: { c: m[1]!, v: Number(m[2]) } });
    } else if ((m = new RegExp(`^${CH}:(\\d+)-(\\d+|end)$`).exec(part))) {
      spans.push({
        from: { c: m[1]!, v: Number(m[2]) },
        to: { c: m[1]!, v: m[3] === 'end' ? 'end' : Number(m[3]) },
      });
    } else if ((m = new RegExp(`^${CH}:(\\d+)-${CH}:(\\d+|end)$`).exec(part))) {
      spans.push({
        from: { c: m[1]!, v: Number(m[2]) },
        to: { c: m[3]!, v: m[4] === 'end' ? 'end' : Number(m[4]) },
      });
    } else {
      throw new Error(`Cannot parse range part "${part}" in "${range}"`);
    }
  }
  return spans;
}

const isNum = (c: string) => /^\d+$/.test(c);

/** A book's verse inventory in plan numbering: chapter key → sorted verse numbers. */
export type Inventory = Map<ChapterKey, number[]>;

export function chapterOrder(inv: Inventory): ChapterKey[] {
  return [...inv.keys()].sort((a, b) => {
    if (isNum(a) && isNum(b)) return Number(a) - Number(b);
    if (isNum(a)) return 1; // lettered chapters (Esther additions) sort first; order among them is A–F
    if (isNum(b)) return -1;
    return a.localeCompare(b);
  });
}

/** Expand a range string into plan keys, in order. Throws with a precise message if any bound is missing. */
export function expandRange(range: string, inv: Inventory): PlanKey[] {
  const out: PlanKey[] = [];
  for (const span of parseRange(range)) {
    const { from, to } = span;
    if (from.c !== to.c && (!isNum(from.c) || !isNum(to.c))) {
      throw new Error(`Range "${range}": lettered chapters cannot span chapters`);
    }
    const chapters = isNum(from.c)
      ? chapterOrder(inv).filter(
          (c) => isNum(c) && Number(c) >= Number(from.c) && Number(c) <= Number(to.c),
        )
      : [from.c];
    for (const c of [from.c, to.c]) {
      if (!inv.has(c)) throw new Error(`Range "${range}": chapter ${c} does not exist`);
    }
    for (const c of chapters) {
      const verses = inv.get(c)!;
      const last = verses.at(-1)!;
      const lo = c === from.c && from.v !== null ? from.v : verses[0]!;
      const hi = c === to.c && to.v !== null ? (to.v === 'end' ? last : to.v) : last;
      if (c === from.c && from.v !== null && !verses.includes(from.v)) {
        throw new Error(`Range "${range}": verse ${c}:${from.v} does not exist`);
      }
      if (c === to.c && typeof to.v === 'number' && !verses.includes(to.v)) {
        throw new Error(`Range "${range}": verse ${c}:${to.v} does not exist`);
      }
      for (const v of verses) if (v >= lo && v <= hi) out.push(`${c}:${v}`);
    }
  }
  return out;
}

export function keyOf(c: ChapterKey | number, v: number): PlanKey {
  return `${c}:${v}`;
}

export function splitKey(key: PlanKey): { c: ChapterKey; v: number } {
  const [c, v] = key.split(':');
  return { c: c!, v: Number(v) };
}
