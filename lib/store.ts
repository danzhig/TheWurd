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
  jobAfter: string; // plan step id that Job follows (D8); default Genesis
  optionalSections: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  textSize: 2,
  verseNumbers: true,
  jobAfter: 'Gen',
  optionalSections: false,
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
    const s = { ...DEFAULT_SETTINGS, ...parsed };
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
