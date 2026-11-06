/** Build-time navigation helpers for pages (server side, default path settings). */
import type { JobOption } from '@/components/ui/SettingsSheet';
import { getManifest } from './data';
import { toTarget, type NavTarget } from './format';
import { neighbours, stops } from './path';

export function defaultNav(id: string): { prev: NavTarget | null; next: NavTarget | null } {
  const m = getManifest();
  const n = neighbours(m, id);
  return { prev: toTarget(n.prev, m), next: toTarget(n.next, m) };
}

/** Books Job can follow: every book step on the path except Job itself. */
export function jobOptions(): JobOption[] {
  const m = getManifest();
  return m.steps
    .filter((s) => s.kind === 'book' && !s.movable)
    .map((s) => ({ id: s.id, name: m.books.find((b) => b.id === s.id)?.name ?? s.id }));
}

/** Can this section be a stop on the path (with optional sections switched on)? */
export function canBeStop(id: string): boolean {
  return stops(getManifest(), { jobAfter: 'Gen', optionalSections: true }).some((s) => s.id === id);
}
