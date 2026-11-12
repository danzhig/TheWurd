/** Build-time navigation helpers for pages (server side). */
import { getFullManifest, getManifest, librarySequence } from './data';
import { toTarget, type NavTarget } from './format';
import { neighbours, buildSequence } from './path';

export interface PageNav {
  prev: NavTarget | null;
  next: NavTarget | null;
  /** Optional detours that branch off right after this page (offered beside Next). */
  detours: NavTarget[];
}

export function defaultNav(id: string): PageNav {
  const m = getManifest();
  const n = neighbours(m, id);
  return {
    prev: toTarget(n.prev, m),
    next: toTarget(n.next, m),
    detours: n.detours.map((d) => toTarget(d, m)!),
  };
}

/** Does this page count toward progress (a stop on the path, or an optional detour)? */
export function canBeStop(id: string): boolean {
  return buildSequence(getManifest()).some((s) => s.id === id && (s.stop || s.detour));
}

/**
 * Library pages (Phase 5) lead through the library in canonical order: section by section, then on
 * into the next library book. They never lead onto the path or count toward its progress.
 */
export function libraryNav(id: string): PageNav {
  const seq = librarySequence();
  const i = seq.findIndex((s) => s.id === id);
  const m = getFullManifest();
  const at = (j: number) => {
    const s = seq[j];
    return s
      ? toTarget({ kind: 'section', id: s.id, bookId: s.bookId, stop: false, detour: false }, m)
      : null;
  };
  return { prev: i > 0 ? at(i - 1) : null, next: i >= 0 ? at(i + 1) : null, detours: [] };
}

/**
 * Position for search results (zero-padded for sorting): the whole path in order, then the
 * library in canonical order.
 */
export function pathPosition(id: string): string {
  const p = buildSequence(getManifest()).findIndex((s) => s.id === id);
  const i = p >= 0 ? p : 5000 + librarySequence().findIndex((s) => s.id === id);
  return String(Math.max(0, i)).padStart(4, '0');
}
