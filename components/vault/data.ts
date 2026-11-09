/** Shapes the manifest into Vault input (shared by the page, the client and tests). */
import type { Book, Bridge, PlanStep, SectionIndexEntry } from '@/lib/types';
import type { OffpathInput, VaultBookInput } from './layout';

/** The plan's own names for the outer-band groups (PLAN §9). */
export const GROUP_LABEL: Record<string, string> = {
  Pentateuch: 'Law',
  Historical: 'Histories',
  Wisdom: 'Wisdom',
  Prophets: 'Prophets',
  Gospels: 'Gospels',
  Letters: 'Letters',
  Apocalypse: 'Apocalypse',
};
export const GROUP_ORDER = [
  'Law',
  'Histories',
  'Wisdom',
  'Prophets',
  'Gospels',
  'Letters',
  'Apocalypse',
];

export interface VaultData {
  path: VaultBookInput[]; // plan books in path order
  satellites: { id: string; of: string; minutes: number }[];
  offpath: OffpathInput[];
  bridges: { id: string; after: string }[];
}

export function vaultData(
  m: { books: Book[]; steps: PlanStep[]; sections: SectionIndexEntry[]; bridges: Bridge[] },
  jobAfter = 'Gen',
): VaultData {
  const minutes = (id: string) =>
    m.sections
      .filter((s) => s.bookId === id && (s.status === 'read' || s.status === 'skim'))
      .reduce((n, s) => n + s.minutes, 0);
  let steps = m.steps.filter((s) => s.kind === 'book');
  const job = steps.find((s) => s.movable);
  if (job && jobAfter !== job.id && steps.some((s) => s.id === jobAfter)) {
    steps = steps.filter((s) => s !== job);
    steps.splice(steps.findIndex((s) => s.id === jobAfter) + 1, 0, job);
  }
  const sectionBook = new Map(m.sections.map((s) => [s.id, s.bookId]));
  const satellites = m.steps
    .filter((s) => s.kind === 'excursion')
    .map((s) => ({
      id: sectionBook.get(s.id)!,
      of: sectionBook.get(s.after ?? '')!,
      minutes: m.sections.find((x) => x.id === s.id)?.minutes ?? 10,
    }));
  // Bridges sit after the book named in the plan; with Job moved they still follow that book.
  return {
    path: steps.map((s) => ({ id: s.id, minutes: Math.max(1, minutes(s.id)) })),
    satellites,
    offpath: m.books
      .filter((b) => !b.inPlan)
      .map((b) => ({ id: b.id, group: GROUP_LABEL[b.group] ?? b.group })),
    bridges: m.bridges.map((b) => ({ id: b.id, after: b.after })),
  };
}
