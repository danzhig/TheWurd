'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { CHANGE_EVENT, readLast, readProgress } from '@/lib/store';
import type { TimelineGroup } from './timeline';
import styles from './path.module.css';

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

/** Progress as a stable string snapshot: completed ids | last section. */
function useProgressKey(): string {
  return useSyncExternalStore(
    subscribe,
    () => `${Object.keys(readProgress()).sort().join(',')}|${readLast()?.sectionId ?? ''}`,
    () => '|',
  );
}

/** The path as a vertical timeline: books as headings, sections and bridges as rows. */
export function PathTimeline({ groups }: { groups: TimelineGroup[] }) {
  const [doneList, current] = useProgressKey().split('|');
  const done = new Set((doneList ?? '').split(',').filter(Boolean));
  return (
    <ol className={styles.timeline}>
      {groups.map((g) =>
        g.kind === 'bridge' ? (
          <li key={g.id} className={styles.bridge}>
            <Link href={`/bridge/${g.id}/`} data-row={g.id}>
              <span className="label">Bridge</span> {g.name}
            </Link>
          </li>
        ) : (
          <li key={g.id} className={styles.book}>
            <h2>
              <Link href={`/book/${g.id}/`}>{g.name}</Link>
            </h2>
            <ol>
              {g.rows.map((r) =>
                r.kind === 'section' ? (
                  <li
                    key={r.id}
                    className={[
                      styles.row,
                      styles[r.status],
                      r.detour ? styles.detour : '',
                      done.has(r.id) ? styles.done : '',
                      current === r.id ? styles.current : '',
                    ].join(' ')}
                  >
                    <Link href={`/read/${r.id}/`} data-row={r.id}>
                      <span className={styles.mark} aria-hidden="true" />
                      <span className={styles.title}>{r.title}</span>{' '}
                      <span className={styles.meta}>
                        {r.range} · {r.minutes} min
                        {r.status === 'skim' ? ' · skim' : ''}
                        {r.detour ? ' · optional detour' : ''}
                        {done.has(r.id) ? ' · read' : ''}
                      </span>
                    </Link>
                  </li>
                ) : null,
              )}
            </ol>
          </li>
        ),
      )}
    </ol>
  );
}
