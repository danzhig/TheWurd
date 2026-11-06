'use client';

import { useSyncExternalStore } from 'react';
import { CHANGE_EVENT, dismiss, readDismissed } from '@/lib/store';
import styles from './reader.module.css';

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

/** A gentle warning before a violent passage; once dismissed it stays hidden for this section. */
export function ContentNote({ sectionId, text }: { sectionId: string; text: string }) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => readDismissed().includes(sectionId),
    () => false,
  );
  if (hidden) return null;
  return (
    <aside className={styles.contentNote} aria-label="Content note" data-testid="content-note">
      <p className="label">Content note</p>
      <p>{text}</p>
      <button type="button" className={styles.quietButton} onClick={() => dismiss(sectionId)}>
        Hide this note
      </button>
    </aside>
  );
}
