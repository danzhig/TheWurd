/**
 * The one module for client state (PLAN §10, §15). localStorage only, every key prefixed `sas:v1:`,
 * every access wrapped so the site still works when storage is blocked (an in-memory copy is used).
 * Later this can be swapped for a synced store without touching callers.
 */
export const PREFIX = 'sas:v1:';
export const CHANGE_EVENT = 'sas:store';

export type ThemeSetting = 'default' | 'vault' | 'vellum' | 'auto';

export interface Settings {
  theme: ThemeSetting; // 'default' = Vault on the maps, Vellum in the reader
  textSize: 1 | 2 | 3 | 4;
  verseNumbers: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  textSize: 2,
  verseNumbers: true,
};

const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: string): string | null {
  try {
    const s = storage();
    if (s) return s.getItem(PREFIX + key);
  } catch {
    /* blocked: fall through to memory */
  }
  return memory.get(key) ?? null;
}

export function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  try {
    storage()?.setItem(PREFIX + key, value);
  } catch {
    /* blocked or full: the in-memory copy still serves this page view */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  }
}

export function readSettings(): Settings {
  const raw = readRaw('settings');
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Only known keys (older versions stored path settings that no longer exist).
    const s: Settings = {
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      textSize: parsed.textSize ?? DEFAULT_SETTINGS.textSize,
      verseNumbers: parsed.verseNumbers ?? DEFAULT_SETTINGS.verseNumbers,
    };
    if (!['default', 'vault', 'vellum', 'auto'].includes(s.theme)) s.theme = 'default';
    if (![1, 2, 3, 4].includes(s.textSize)) s.textSize = DEFAULT_SETTINGS.textSize;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch };
  writeRaw('settings', JSON.stringify(next));
  return next;
}

// ---------------------------------------------------------------------------
// Reading progress (PLAN §10): `progress` = { [sectionId]: completedAtISO }, `last` = where to continue.
// The library (Phase 5) keeps its own ledger, `library`, in the same shape: reading there never
// changes the path's progress.
// ---------------------------------------------------------------------------

export type Progress = Record<string, string>;
/** Which record a page's reading goes to: the path's or the library's. */
export type Ledger = 'progress' | 'library';

export function readProgress(ledger: Ledger = 'progress'): Progress {
  try {
    const p = JSON.parse(readRaw(ledger) ?? '{}') as unknown;
    return p && typeof p === 'object' ? (p as Progress) : {};
  } catch {
    return {};
  }
}

export function markRead(sectionId: string, ledger: Ledger = 'progress'): void {
  const p = readProgress(ledger);
  if (p[sectionId]) return;
  p[sectionId] = new Date().toISOString();
  writeRaw(ledger, JSON.stringify(p));
}

export function markUnread(sectionId: string, ledger: Ledger = 'progress'): void {
  const p = readProgress(ledger);
  delete p[sectionId];
  writeRaw(ledger, JSON.stringify(p));
}

export interface LastPlace {
  sectionId: string;
  verse?: string;
}

export function readLast(): LastPlace | null {
  try {
    const l = JSON.parse(readRaw('last') ?? 'null') as LastPlace | null;
    return l && typeof l.sectionId === 'string' ? l : null;
  } catch {
    return null;
  }
}

export function writeLast(place: LastPlace): void {
  writeRaw('last', JSON.stringify(place));
}

/** Content notes the reader has dismissed, by section id. */
export function readDismissed(): string[] {
  try {
    const d = JSON.parse(readRaw('dismissed') ?? '[]') as unknown;
    return Array.isArray(d) ? (d as string[]) : [];
  } catch {
    return [];
  }
}

export function dismiss(sectionId: string): void {
  const d = readDismissed();
  if (!d.includes(sectionId)) writeRaw('dismissed', JSON.stringify([...d, sectionId]));
}
