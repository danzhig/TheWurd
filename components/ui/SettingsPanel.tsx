'use client';

import { useEffect, useState } from 'react';
import {
  CHANGE_EVENT,
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type Settings,
  type ThemeSetting,
} from '@/lib/store';
import styles from './SettingsPanel.module.css';

const THEMES: { value: ThemeSetting; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'vault', label: 'Vault' },
  { value: 'vellum', label: 'Vellum' },
  { value: 'auto', label: 'Auto' },
];

/** Theme, text size and verse numbers. Reused by the reader's settings sheet in M3. */
export function SettingsPanel() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const sync = () => setS(readSettings());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group}>
        <legend className="label">Theme</legend>
        <div className={styles.segmented}>
          {THEMES.map((t) => (
            <label key={t.value} className={styles.option}>
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={s.theme === t.value}
                onChange={() => writeSettings({ theme: t.value })}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.group}>
        <legend className="label">Text size</legend>
        <div className={styles.segmented}>
          {([1, 2, 3, 4] as const).map((n) => (
            <label key={n} className={styles.option}>
              <input
                type="radio"
                name="text-size"
                value={n}
                checked={s.textSize === n}
                onChange={() => writeSettings({ textSize: n })}
              />
              <span style={{ fontSize: `${0.8 + n * 0.12}rem` }} aria-label={`Size ${n}`}>
                A
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={s.verseNumbers}
          onChange={(e) => writeSettings({ verseNumbers: e.target.checked })}
        />
        <span>Verse numbers</span>
      </label>
    </div>
  );
}
