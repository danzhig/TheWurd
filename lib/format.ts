/** Display helpers shared by server and client. */
import type { PathItem } from './path';

/** Plan notation for display: en dashes in ranges, letters for Esther's additions kept. */
export function prettyRange(range: string): string {
  return range.replace(/(\d|[A-F]|end)-(\d|end)/g, '$1–$2').replace(/;\s*/g, '; ');
}

export interface NavTarget {
  kind: 'section' | 'bridge';
  id: string;
  href: string;
  title: string;
  bookId?: string;
  bookName?: string;
  minutes?: number;
}

export interface NavData {
  sections: { id: string; bookId: string; title: string; minutes: number }[];
  books: { id: string; name: string }[];
  bridges: { id: string; title: string }[];
}

export function hrefFor(item: Pick<PathItem, 'kind' | 'id'>): string {
  return item.kind === 'bridge' ? `/bridge/${item.id}/` : `/read/${item.id}/`;
}

export function toTarget(item: PathItem | null, data: NavData): NavTarget | null {
  if (!item) return null;
  if (item.kind === 'bridge') {
    const b = data.bridges.find((x) => x.id === item.id);
    return { kind: 'bridge', id: item.id, href: hrefFor(item), title: b?.title ?? item.id };
  }
  const s = data.sections.find((x) => x.id === item.id);
  const book = data.books.find((x) => x.id === item.bookId);
  return {
    kind: 'section',
    id: item.id,
    href: hrefFor(item),
    title: s?.title ?? item.id,
    bookId: item.bookId,
    bookName: book?.name,
    minutes: s?.minutes,
  };
}
