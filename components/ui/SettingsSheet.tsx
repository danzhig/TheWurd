'use client';

import { useEffect, useRef } from 'react';
import { SettingsPanel } from './SettingsPanel';
import styles from './SettingsSheet.module.css';

/** Reading settings: theme, text size and verse numbers. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
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
    </dialog>
  );
}
