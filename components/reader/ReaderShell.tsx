'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SettingsSheet } from '@/components/ui/SettingsSheet';
import { CHANGE_EVENT, markRead, markUnread, readProgress, writeLast } from '@/lib/store';
import { animationsOn, paperCover, reveal, transition } from '@/lib/transition';
import type { PageNav } from '@/lib/nav';
import styles from './reader.module.css';

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
  nav: PageNav;
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
  nav,
  children,
}: ReaderShellProps) {
  const router = useRouter();
  // Up a level: a section returns to its book's map; a bridge to all books.
  const upHref = bookId ? `/book/${bookId}/` : '/';
  // Up to the book's map: the page shrinks back into its station there (see BookMap).
  const goUp = useCallback(
    (e?: { preventDefault: () => void }) => {
      if (!bookId || !animationsOn()) {
        if (!e) router.push(upHref);
        return;
      }
      e?.preventDefault();
      paperCover(id, getComputedStyle(document.body).backgroundColor);
      router.push(upHref);
    },
    [bookId, id, router, upHref],
  );
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
    // Arriving from a book's map: the page that grew out of the station fades to show the verses.
    if (transition.pending?.kind === 'paper-in') void reveal();
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

  // Verse links (P2.4): tapping a verse number copies a link to that verse.
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    let hide = 0;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a.verse-link');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const hash = a.getAttribute('href')!;
      const [, c, v] = hash.match(/^#v-(\d+)-(\d+)/) ?? [];
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      window.history.replaceState(window.history.state, '', hash);
      const say = (msg: string) => {
        setCopied(msg);
        window.clearTimeout(hide);
        hide = window.setTimeout(() => setCopied(null), 2200);
      };
      const label = c ? `${c}:${v}` : 'this verse';
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(url)
          .then(() => say(`Link to ${label} copied`))
          .catch(() => say(`Link to ${label} is in the address bar`));
      } else say(`Link to ${label} is in the address bar`);
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      window.clearTimeout(hide);
    };
  }, []);

  // Keyboard: ← previous, → next, Esc up a level.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || settingsOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))) return;
      if (e.key === 'ArrowRight' && nav.next) router.push(nav.next.href);
      else if (e.key === 'ArrowLeft' && nav.prev) router.push(nav.prev.href);
      else if (e.key === 'Escape') goUp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, router, settingsOpen, goUp]);

  const next = nav.next;
  return (
    <>
      <header className={`${styles.topbar} ${hidden ? styles.topbarHidden : ''}`}>
        <Link
          href={upHref}
          onClick={goUp}
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
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <p className={styles.toast} role="status" aria-live="polite" data-testid="copied">
        {copied}
      </p>

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
        {nav.detours.map((d) => (
          <Link key={d.id} href={d.href} className={styles.detour} data-testid="detour-link">
            <span className="label">Optional detour</span>
            <span className={styles.detourTitle}>
              {d.bookId !== bookId ? `${d.bookName?.replace(/\s*\(excursion\)$/, '')} · ` : ''}
              {d.title}
            </span>
            {d.minutes ? <span className={styles.nextMeta}>{d.minutes} min</span> : null}
          </Link>
        ))}
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
