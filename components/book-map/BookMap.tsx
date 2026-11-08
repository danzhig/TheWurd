'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CHANGE_EVENT, readLast, readProgress } from '@/lib/store';
import type { Status } from '@/lib/types';
import { layoutStations, type MapLayout } from './layout';
import styles from './book-map.module.css';

export interface StationData {
  id: string;
  title: string;
  range: string; // plan reference, for display
  status: Status;
  highlight?: boolean;
  minutes: number;
  href: string;
}

/** Map positions kept for this browsing session, so returning from a section lands where you left. */
const savedScroll = new Map<string, number>();
/** Books whose cover has already opened in this session (it does not replay on return). */
export const openedBooks = new Set<string>();

const STATUS_WORD: Record<Status, string> = {
  read: 'read',
  skim: 'skim',
  optional: 'optional detour',
  skip: 'skipped',
};

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

/** Progress as a stable string snapshot (useSyncExternalStore needs referential stability). */
function useProgressKey(): string {
  return useSyncExternalStore(
    subscribe,
    () => `${Object.keys(readProgress()).sort().join(',')}|${readLast()?.sectionId ?? ''}`,
    () => '|',
  );
}

export function BookMap({
  bookId,
  bookName,
  stations,
}: {
  bookId: string;
  bookName: string;
  stations: StationData[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const holdTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const progressKey = useProgressKey();
  const [doneList, current] = progressKey.split('|');
  const done = new Set((doneList ?? '').split(',').filter(Boolean));

  // Measure and lay out; re-run on resize.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setLayout(layoutStations(stations, box.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [stations]);

  // Once laid out, return to where the reader left this map.
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!layout || restored.current) return;
    restored.current = true;
    const y = savedScroll.get(bookId);
    if (y !== undefined) window.scrollTo({ top: y, behavior: 'instant' });
    document.documentElement.dataset.bookMap = bookId; // laid out and interactive (used by tests)
  }, [layout, bookId]);

  const startHold = (id: string) => {
    if (layout?.mode !== 'meander') return;
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      setHeld(id);
      window.setTimeout(() => setHeld((h) => (h === id ? null : h)), 2500);
    }, 450);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const stops = stations.filter((s) => s.status === 'read' || s.status === 'skim');
  const read = stops.filter((s) => done.has(s.id)).length;

  return (
    <>
      <p className={styles.progress} data-testid="book-progress">
        {read} of {stops.length} sections read
      </p>
      <div
        ref={boxRef}
        className={`${styles.map} ${layout ? styles[layout.mode] : styles.list}`}
        style={layout ? { height: layout.height } : undefined}
      >
        {layout ? (
          <svg
            className={styles.line}
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            <path d={layout.path} className={styles.thread} />
            {layout.stations
              .filter((p) => p.branchFrom)
              .map((p) => (
                <path
                  key={p.id}
                  d={`M ${p.branchFrom!.x} ${p.branchFrom!.y} L ${p.x} ${p.y}`}
                  className={styles.branch}
                />
              ))}
          </svg>
        ) : null}
        <ol className={styles.stations} aria-label={`Sections of ${bookName}`}>
          {stations.map((s, i) => {
            const p = layout?.stations[i];
            const isDone = done.has(s.id);
            return (
              <li
                key={s.id}
                data-station={s.id}
                data-status={s.status}
                className={[
                  styles.station,
                  styles[s.status],
                  p ? styles[p.label] : '',
                  s.highlight ? styles.highlight : '',
                  isDone ? styles.done : '',
                  current === s.id ? styles.current : '',
                  held === s.id ? styles.held : '',
                ].join(' ')}
                style={
                  p
                    ? { left: p.x, top: p.y, ['--label-w' as string]: `${p.labelWidth}px` }
                    : undefined
                }
              >
                <Link
                  href={s.href}
                  onClick={(e) => {
                    if (suppressClick.current) {
                      e.preventDefault();
                      suppressClick.current = false;
                      return;
                    }
                    savedScroll.set(bookId, window.scrollY);
                  }}
                  onPointerDown={() => startHold(s.id)}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onContextMenu={(e) => layout?.mode === 'meander' && e.preventDefault()}
                >
                  <span className={styles.mark} aria-hidden="true" />
                  {/* The visible title and range are the link's name; extra detail is for screen readers. */}
                  <span className={styles.text}>
                    <span className={styles.title}>{s.title}</span>{' '}
                    <span className={styles.range}>
                      {s.range}
                      {s.status !== 'read' ? ` · ${STATUS_WORD[s.status]}` : ''}
                    </span>
                    <span className="visually-hidden">
                      {s.highlight ? ', slow down' : ''}, {s.minutes} min{isDone ? ', read' : ''}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
