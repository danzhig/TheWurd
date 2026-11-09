/**
 * The reading path (PLAN §6, §10): the ordered stops a reader walks with "Next".
 * Shared by the static pages and tests.
 *
 * - Book steps expand into their sections in book order, in the plan's order (Job after Genesis).
 *   `read` and `skim` sections are stops; `skip` sections never are.
 * - Bridges are stops in their own right.
 * - Optional sections and the John 11 excursion are detours: always on the maps, never a stop for
 *   "Next". The page just before a detour offers it as a link, and the detour's own Previous and
 *   Next lead back onto the path.
 * Every section is still placed in the full sequence, so a page that is not a stop (a skipped
 * section or a detour) still has a sensible Previous and Next.
 */
import type { PlanStep, SectionIndexEntry } from './types';

export type PathItem =
  | { kind: 'section'; id: string; bookId: string; stop: boolean; detour: boolean }
  | { kind: 'bridge'; id: string; stop: true; detour: false };

export interface PathInput {
  steps: PlanStep[];
  sections: Pick<SectionIndexEntry, 'id' | 'bookId' | 'status'>[];
}

export function buildSequence(input: PathInput): PathItem[] {
  const byBook = new Map<string, PathInput['sections']>();
  for (const s of input.sections) byBook.set(s.bookId, [...(byBook.get(s.bookId) ?? []), s]);
  const bookOf = new Map(input.sections.map((s) => [s.id, s.bookId]));
  const steps = input.steps.filter((s) => s.kind !== 'excursion');
  const excursions = input.steps.filter((s) => s.kind === 'excursion');

  const out: PathItem[] = [];
  for (const step of steps) {
    if (step.kind === 'bridge') {
      out.push({ kind: 'bridge', id: step.id, stop: true, detour: false });
      continue;
    }
    for (const s of byBook.get(step.id) ?? []) {
      out.push({
        kind: 'section',
        id: s.id,
        bookId: s.bookId,
        stop: s.status === 'read' || s.status === 'skim',
        detour: s.status === 'optional',
      });
      for (const ex of excursions.filter((e) => e.after === s.id)) {
        for (const es of byBook.get(bookOf.get(ex.id) ?? '') ?? []) {
          out.push({
            kind: 'section',
            id: es.id,
            bookId: es.bookId,
            stop: false,
            detour: es.id === ex.id,
          });
        }
      }
    }
  }
  return out;
}

/** Only the stops, in order. */
export function stops(input: PathInput): PathItem[] {
  return buildSequence(input).filter((i) => i.stop);
}

export function neighbours(
  input: PathInput,
  id: string,
): { prev: PathItem | null; next: PathItem | null; detours: PathItem[] } {
  const seq = buildSequence(input);
  const i = seq.findIndex((x) => x.id === id);
  if (i < 0) return { prev: null, next: null, detours: [] };
  const prev = [...seq.slice(0, i)].reverse().find((x) => x.stop) ?? null;
  const n = seq.findIndex((x, j) => j > i && x.stop);
  const next = n >= 0 ? seq[n]! : null;
  // Detours that branch off between this stop and the next one.
  const detours = seq[i]!.stop
    ? seq.slice(i + 1, n >= 0 ? n : undefined).filter((x) => x.detour)
    : [];
  return { prev, next, detours };
}
