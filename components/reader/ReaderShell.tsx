'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SettingsSheet, type JobOption } from '@/components/ui/SettingsSheet';
import { toTarget, type NavData, type NavTarget } from '@/lib/format';
import { isDefaultPath, neighbours, type PathInput } from '@/lib/path';
import {
  CHANGE_EVENT,
  markRead,
  markUnread,
  readProgress,
  readSettings,
  writeLast,
} from '@/lib/store';
import styles from './reader.module.css';

interface Nav {
  prev: NavTarget | null;
  next: NavTarget | null;
}

let manifestPromise: Promise<PathInput & NavData> | null = null;
function loadManifest() {
  manifestPromise ??= fetch('/data/manifest.json').then(
    (r) => r.json() as Promise<PathInput & NavData>,
  );
  return manifestPromise;
}

/** Previous/next with the reader's own path settings (Job's place, optional detours). */
function useNav(id: string, defaults: Nav): Nav {
  const [nav, setNav] = useState(defaults);
  useEffect(() => {
    let alive = true;
    const update = async () => {
      const s = readSettings();
      if (isDefaultPath(s)) {
        setNav(defaults);
        return;
      }
      try {
        const m = await loadManifest();
        const n = neighbours(m, id, { jobAfter: s.jobAfter, optionalSections: s.optionalSections });
        if (alive) setNav({ prev: toTarget(n.prev, m), next: toTarget(n.next, m) });
      } catch {
        /* offline or blocked: keep the default path */
      }
    };
    void update();
    window.addEventListener(CHANGE_EVENT, update);
    return () => {
      alive = false;
      window.removeEventListener(CHANGE_EVENT, update);
    };
  }, [id, defaults]);
  return nav;
}

export interface ReaderShellProps {
  id: string;
  kind: 'section' | 'bridge';
  heading: string; // top bar text
  bookId?: string;
  bookName?: string;
  /** Is this page a stop on the path (counts toward progress)? */
  stop: boolean;
  /** Mark as read as soon as the page is seen (whole-section skims). */
  readOnOpen?: boolean;
  defaults: Nav;
  jobOptions: JobOption[];
  children: ReactNode;
}

export function ReaderShell({
  id,
  kind,
  heading,
  bookId,
  bookName,
  stop,
  readOnOpen,
  defaults,
  jobOptions,
  children,
}: ReaderShellProps) {
  const router = useRouter();
  const nav = useNav(id, defaults);
  // Up a level: a section returns to its book's map; a bridge to all books.
  const upHref = bookId ? `/book/${bookId}/` : '/';
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Focus the page heading after every navigation (PLAN §10 accessibility), and mark the page as
  // interactive (tests wait for this before using the keyboard).
  useEffect(() => {
    document.querySelector<HTMLElement>('#page-heading')?.focus({ preventScroll: true });
    document.documentElement.dataset.reader = id;
  }, [id]);

  // Progress: read state, completion when the end is in view, "Continue" position.
  useEffect(() => {
    const sync = () => setDone(readProgress()[id] ?? null);
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    if (stop && readOnOpen) markRead(id);
    if (kind === 'section') writeLast({ sectionId: id });
    const end = endRef.current;
    let io: IntersectionObserver | null = null;
    if (stop && end && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) markRead(id);
      });
      io.observe(end);
    }
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      io?.disconnect();
    };
  }, [id, kind, stop, readOnOpen]);

  // Top bar hides while scrolling down and returns on scroll up; gold hairline tracks progress.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    let lastSaved = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrolled(max > 0 ? Math.min(1, y / max) : 1);
        setHidden(y > lastY && y > 80);
        lastY = y;
        const now = Date.now();
        if (kind === 'section' && now - lastSaved > 1500) {
          lastSaved = now;
          const verse = [...document.querySelectorAll<HTMLElement>('[data-verse]')].find(
            (el) => el.getBoundingClientRect().bottom > 72,
          );
          if (verse?.dataset.verse) writeLast({ sectionId: id, verse: verse.dataset.verse });
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [id, kind]);

  // Keyboard: ← previous, → next, Esc up a level.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || settingsOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))) return;
      if (e.key === 'ArrowRight' && nav.next) router.push(nav.next.href);
      else if (e.key === 'ArrowLeft' && nav.prev) router.push(nav.prev.href);
      else if (e.key === 'Escape') router.push(upHref);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, router, settingsOpen, upHref]);

  const next = nav.next;
  return (
    <>
      <header className={`${styles.topbar} ${hidden ? styles.topbarHidden : ''}`}>
        <Link
          href={upHref}
          className={styles.up}
          aria-label={bookId ? `${bookName ?? 'Book'} map` : 'All books'}
        >
          <span aria-hidden="true">←</span>
        </Link>
        <p className={styles.topTitle}>{heading}</p>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setSettingsOpen(true)}
          aria-label="Reading settings"
        >
          Aa
        </button>
        <span
          className={styles.hairline}
          style={{ transform: `scaleX(${scrolled})` }}
          aria-hidden="true"
        />
      </header>
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        jobOptions={jobOptions}
      />

      {children}

      <div ref={endRef} className={styles.end} aria-hidden="true" />
      <nav className={styles.pathNav} aria-label="Reading path">
        {stop ? (
          <div className={styles.readState}>
            {done ? (
              <>
                <span className={styles.readMark}>Read</span>
                <button type="button" className={styles.linkButton} onClick={() => markUnread(id)}>
                  Mark as unread
                </button>
              </>
            ) : (
              <button type="button" className={styles.quietButton} onClick={() => markRead(id)}>
                Mark as read
              </button>
            )}
          </div>
        ) : null}
        {next ? (
          <Link
            href={next.href}
            className={styles.nextCard}
            data-testid="next-link"
            data-next={next.id}
          >
            <span className="label">{next.kind === 'bridge' ? 'Next · Bridge' : 'Next'}</span>
            <span className={`display ${styles.nextTitle}`}>{next.title}</span>
            <span className={styles.nextMeta}>
              {next.kind === 'section' && next.bookId !== bookId ? `${next.bookName} · ` : ''}
              {next.minutes
                ? `${next.minutes} min`
                : next.kind === 'bridge'
                  ? 'Between the books'
                  : ''}
            </span>
          </Link>
        ) : (
          <div className={styles.nextCard} data-testid="path-end">
            <span className="label">The end of the path</span>
            <span className={`display ${styles.nextTitle}`}>The story is left open.</span>
            <Link href="/">Back to all books</Link>
          </div>
        )}
        {nav.prev ? (
          <Link href={nav.prev.href} className={styles.prev} data-testid="prev-link">
            ← {nav.prev.title}
            {nav.prev.kind === 'section' && nav.prev.bookId !== bookId
              ? ` · ${nav.prev.bookName}`
              : ''}
          </Link>
        ) : null}
        {bookName ? <p className={styles.keys}>Keys: ← previous · → next · Esc book map</p> : null}
      </nav>
    </>
  );
}
