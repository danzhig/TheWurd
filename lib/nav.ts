/** Build-time navigation helpers for pages (server side). */
import { getManifest } from './data';
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

/** Position in the whole path sequence (search results sort by it), zero-padded for sorting. */
export function pathPosition(id: string): string {
  const i = buildSequence(getManifest()).findIndex((s) => s.id === id);
  return String(Math.max(0, i)).padStart(4, '0');
}

/** Does this page count toward progress (a stop on the path, or an optional detour)? */
export function canBeStop(id: string): boolean {
  return buildSequence(getManifest()).some((s) => s.id === id && (s.stop || s.detour));
}
