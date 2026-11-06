import type { BookMapping } from '../map-versification';
import { expandRange, type Inventory } from './ranges';

/** WEBC's own chapter/verse inventory (split verse parts collapsed onto their verse). */
export function webcInventory(m: BookMapping): Inventory {
  const inv: Inventory = new Map();
  for (const u of m.units) {
    if (u.part) continue;
    const list = inv.get(String(u.c)) ?? [];
    list.push(u.v);
    inv.set(String(u.c), list);
  }
  return inv;
}

/**
 * Compare a section's resolved WEBC verses with what a reader would get by looking up the plan's
 * numbers directly in WEBC. `error` is set when the plan numbers do not exist in WEBC at all.
 */
export function numberingDiff(range: string, actual: string[], m: BookMapping) {
  let naive: string[] = [];
  let error: string | undefined;
  try {
    naive = expandRange(range, webcInventory(m)).map((k) => `${m.book.id}.${k.replace(':', '.')}`);
  } catch (err) {
    error = (err as Error).message.replace(/^Range "[^"]*": /, '');
  }
  const a = new Set(actual);
  const n = new Set(naive);
  const movesIn = actual.filter((r) => !n.has(r));
  const movesOut = naive.filter((r) => !a.has(r));
  return {
    movesIn,
    movesOut,
    error,
    differs: !!error || movesIn.length > 0 || movesOut.length > 0,
  };
}
