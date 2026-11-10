/** Finding the verse a search result should open at (pure, unit-tested). */
import { verseText, type VerseOut } from '@/lib/types';

/** Search words: lower-case, letters and digits only, at least two characters. */
export function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.replace(/'/g, ''))
    .filter((t) => t.length >= 2);
}

/**
 * The anchor of the first verse that contains every search word (as the start of a word, allowing
 * other endings, so "mose" finds "Moses" and "burning" finds "burned"); failing that, the first verse with any of them. Null when none match.
 */
export function firstMatch(verses: VerseOut[], query: string): string | null {
  const ts = terms(query);
  if (!ts.length) return null;
  const words = verses.map((v) => {
    const text = verseText(v).toLowerCase().replace(/[’']/g, '');
    return ts.map((t) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(stem(t))}`, 'u').test(text));
  });
  const i = words.findIndex((w) => w.every(Boolean));
  const j = i >= 0 ? i : words.findIndex((w) => w.some(Boolean));
  if (j < 0) return null;
  const v = verses[j]!;
  return `v-${v.c}-${v.v}${v.part ?? ''}`;
}

/** A rough stem, as search matches word forms: "burning" finds "burned", "kings" finds "king". */
export function stem(t: string): string {
  const base = t.replace(/(ing|ed|es|s)$/, '');
  return base.length >= 3 ? base : t;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
