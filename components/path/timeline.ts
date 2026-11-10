/** The whole path as timeline rows, grouped by book (PLAN §9, "The Path"). Pure, unit-tested. */
import type { Book, Bridge, PlanStep, SectionIndexEntry } from '@/lib/types';
import { buildSequence } from '@/lib/path';

export type TimelineRow =
  | {
      kind: 'section';
      id: string;
      title: string;
      range: string;
      minutes: number;
      status: 'read' | 'skim' | 'optional';
      detour: boolean;
    }
  | { kind: 'bridge'; id: string; title: string };

export interface TimelineGroup {
  /** A book on the path, or a bridge between books. */
  kind: 'book' | 'bridge';
  id: string;
  name: string;
  rows: TimelineRow[];
}

export function timeline(m: {
  books: Pick<Book, 'id' | 'name'>[];
  steps: PlanStep[];
  sections: SectionIndexEntry[];
  bridges: Bridge[];
}): TimelineGroup[] {
  const section = new Map(m.sections.map((s) => [s.id, s]));
  const name = (id: string) => m.books.find((b) => b.id === id)?.name ?? id;
  const groups: TimelineGroup[] = [];
  for (const item of buildSequence(m)) {
    if (!item.stop && !item.detour) continue;
    if (item.kind === 'bridge') {
      const b = m.bridges.find((x) => x.id === item.id)!;
      groups.push({
        kind: 'bridge',
        id: b.id,
        name: b.title,
        rows: [{ kind: 'bridge', id: b.id, title: b.title }],
      });
      continue;
    }
    const s = section.get(item.id)!;
    // A detour into another book (John 11) stays inside its host book's group.
    const last = groups.at(-1);
    const group =
      last?.kind === 'book' && (last.id === s.bookId || item.detour)
        ? last
        : (groups[
            groups.push({ kind: 'book', id: s.bookId, name: name(s.bookId), rows: [] }) - 1
          ] as TimelineGroup);
    group.rows.push({
      kind: 'section',
      id: s.id,
      title: s.title,
      range:
        item.detour && s.bookId !== group.id
          ? `${name(s.bookId).replace(/(\s+\d+)?\s*\(excursion\)$/, '')} ${s.range}`
          : s.range,
      minutes: s.minutes,
      status: s.status as 'read' | 'skim' | 'optional',
      detour: item.detour,
    });
  }
  return groups;
}
