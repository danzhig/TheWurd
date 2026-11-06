/**
 * The reading path (PLAN §6, §10): the ordered stops a reader walks with "Next".
 * Shared by the static pages (default settings), the client (the reader's own settings) and tests.
 *
 * - Book steps expand into their sections in book order. `read` and `skim` sections are stops;
 *   `optional` sections are stops only when optional sections are on; `skip` sections never are.
 * - Bridges are stops in their own right.
 * - Excursions (John 11) are inserted after the section named in `after`, only when optional
 *   sections are on.
 * - Job (movable) follows the book chosen in settings; the plan's default is Genesis.
 * Every section is still placed in the full sequence, so a page that is not a stop (a skipped
 * section) still has a sensible Previous and Next.
 */
import type { PlanStep, SectionIndexEntry } from './types';

export interface PathSettings {
  jobAfter: string;
  optionalSections: boolean;
}

export const DEFAULT_PATH_SETTINGS: PathSettings = { jobAfter: 'Gen', optionalSections: false };

export type PathItem =
  | { kind: 'section'; id: string; bookId: string; stop: boolean }
  | { kind: 'bridge'; id: string; stop: true };

export interface PathInput {
  steps: PlanStep[];
  sections: Pick<SectionIndexEntry, 'id' | 'bookId' | 'status'>[];
}

export function buildSequence(
  input: PathInput,
  settings: PathSettings = DEFAULT_PATH_SETTINGS,
): PathItem[] {
  const byBook = new Map<string, PathInput['sections']>();
  for (const s of input.sections) byBook.set(s.bookId, [...(byBook.get(s.bookId) ?? []), s]);
  const bookOf = new Map(input.sections.map((s) => [s.id, s.bookId]));

  // Order of book and bridge steps, with Job moved if the reader chose another place.
  let steps = input.steps.filter((s) => s.kind !== 'excursion');
  const job = steps.find((s) => s.kind === 'book' && s.movable);
  if (job && settings.jobAfter !== job.id) {
    const without = steps.filter((s) => s !== job);
    const at = without.findIndex((s) => s.kind === 'book' && s.id === settings.jobAfter);
    if (at >= 0) steps = [...without.slice(0, at + 1), job, ...without.slice(at + 1)];
  }
  const excursions = input.steps.filter((s) => s.kind === 'excursion');

  const isStop = (status: string) =>
    status === 'read' || status === 'skim' || (status === 'optional' && settings.optionalSections);

  const out: PathItem[] = [];
  for (const step of steps) {
    if (step.kind === 'bridge') {
      out.push({ kind: 'bridge', id: step.id, stop: true });
      continue;
    }
    for (const s of byBook.get(step.id) ?? []) {
      out.push({ kind: 'section', id: s.id, bookId: s.bookId, stop: isStop(s.status) });
      for (const ex of excursions.filter((e) => e.after === s.id)) {
        const exBook = bookOf.get(ex.id);
        const on = !ex.optional || settings.optionalSections;
        for (const es of byBook.get(exBook ?? '') ?? []) {
          out.push({ kind: 'section', id: es.id, bookId: es.bookId, stop: on && es.id === ex.id });
        }
      }
    }
  }
  return out;
}

/** Only the stops, in order. */
export function stops(input: PathInput, settings?: PathSettings): PathItem[] {
  return buildSequence(input, settings).filter((i) => i.stop);
}

export function neighbours(
  input: PathInput,
  id: string,
  settings?: PathSettings,
): { prev: PathItem | null; next: PathItem | null } {
  const seq = buildSequence(input, settings);
  const i = seq.findIndex((x) => x.id === id);
  if (i < 0) return { prev: null, next: null };
  const prev = [...seq.slice(0, i)].reverse().find((x) => x.stop) ?? null;
  const next = seq.slice(i + 1).find((x) => x.stop) ?? null;
  return { prev, next };
}

export function isDefaultPath(s: PathSettings): boolean {
  return (
    s.jobAfter === DEFAULT_PATH_SETTINGS.jobAfter &&
    s.optionalSections === DEFAULT_PATH_SETTINGS.optionalSections
  );
}
