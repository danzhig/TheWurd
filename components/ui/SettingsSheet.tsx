'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CHANGE_EVENT,
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type Settings,
} from '@/lib/store';
import { SettingsPanel } from './SettingsPanel';
import styles from './SettingsSheet.module.css';

export interface JobOption {
  id: string;
  name: string;
}

/** Reading settings: display (theme, size, verse numbers) and path (Job's place, optional detours). */
export function SettingsSheet({
  open,
  onClose,
  jobOptions,
}: {
  open: boolean;
  onClose: () => void;
  jobOptions: JobOption[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const sync = () => setS(readSettings());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.sheet} onClose={onClose} aria-labelledby="settings-title">
      <div className={styles.head}>
        <h2 id="settings-title" className="display">
          Reading settings
        </h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </div>
      <SettingsPanel />
      <hr className="gilt-rule" />
      <div className={styles.path}>
        <label className={styles.field}>
          <span className="label">Read Job after</span>
          <select value={s.jobAfter} onChange={(e) => writeSettings({ jobAfter: e.target.value })}>
            {jobOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.id === DEFAULT_SETTINGS.jobAfter ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={s.optionalSections}
            onChange={(e) => writeSettings({ optionalSections: e.target.checked })}
          />
          <span>Include optional detours (Deuteronomy 28, John 11)</span>
        </label>
      </div>
    </dialog>
  );
}
