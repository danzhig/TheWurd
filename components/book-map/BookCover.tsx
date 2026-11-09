'use client';

import { useLayoutEffect, useRef } from 'react';
import { coverGeometry, SPREAD_QUERY, type CoverGeometry } from '@/lib/book-geometry';
import { camera, prefersReducedMotion } from '@/lib/camera';
import { EASE, handoff, transition } from '@/lib/transition';
import { openedBooks } from './BookMap';
import styles from './book-cover.module.css';

export const OPEN_MS = 900;

/** The open book page's cover, so "All books" can close it before leaving. */
export const bookCover: { close: (() => Promise<DOMRect | null>) | null } = { close: null };

/**
 * The book's cover, hinged at the spine (PLAN §9). On arrival it opens: the cover swings over to
 * the left and becomes the inside of the cover, while the pages with the section map fade up from
 * beneath it. When the reader arrives from the Vault, a flying copy of this cover lands exactly here
 * first and hands over. Returning from a section, the book is already open. On leaving for the
 * Vault, the cover closes again. Reduced motion: no movement, the pages simply appear.
 */
export function BookCover({
  bookId,
  name,
  tagline,
}: {
  bookId: string;
  name: string;
  tagline: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = ref.current;
    const frame = shell?.parentElement;
    const pages = frame?.querySelector<HTMLElement>('[data-pages]');
    const hinge = shell?.querySelector<HTMLElement>('.book-hinge');
    if (!shell || !frame || !pages || !hinge) return;
    camera.fromBook = bookId; // the Vault returns the book to this medallion

    let g: CoverGeometry;
    const place = () => {
      g = coverGeometry(
        frame.clientWidth,
        window.matchMedia(SPREAD_QUERY).matches,
        window.innerHeight,
      );
      Object.assign(shell.style, { left: `${g.offsetX}px`, width: `${g.w}px`, height: `${g.h}px` });
    };
    place();

    const timing = { duration: OPEN_MS, easing: EASE, fill: 'forwards' as const };
    const setOpen = () => {
      shell.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      pages.getAnimations().forEach((a) => a.cancel());
      shell.hidden = true;
      frame.dataset.state = 'open';
    };
    const setClosed = () => {
      shell.hidden = false;
      shell.style.transform = `translateX(${g.shift}px)`;
      frame.dataset.state = 'closed';
    };
    const open = async () => {
      frame.dataset.state = 'opening';
      const anims = [
        shell.animate(
          [{ transform: `translateX(${g.shift}px)` }, { transform: 'translateX(0)' }],
          timing,
        ),
        hinge.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], timing),
        pages.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], timing),
      ];
      // The cover fades as it goes: on a phone it swings off the single page; on a spread its inside
      // would otherwise lie over the left page's content.
      const fadeAt = g.spread ? 0.55 : 0.4;
      anims.push(
        shell.animate([{ opacity: 1 }, { opacity: 1, offset: fadeAt }, { opacity: 0 }], timing),
      );
      await Promise.all(anims.map((a) => a.finished)).catch(() => {});
      setOpen();
    };
    bookCover.close = async () => {
      if (prefersReducedMotion()) return null;
      place();
      window.scrollTo({ top: 0, behavior: 'instant' });
      shell.hidden = false;
      shell.style.transform = 'translateX(0)';
      frame.dataset.state = 'closing';
      const anims = [
        pages.animate([{ opacity: 1 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }], timing),
        hinge.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], timing),
        shell.animate(
          [{ transform: 'translateX(0)' }, { transform: `translateX(${g.shift}px)` }],
          timing,
        ),
      ];
      anims.push(
        shell.animate(
          [{ opacity: 0 }, { opacity: 1, offset: g.spread ? 0.45 : 0.6 }, { opacity: 1 }],
          timing,
        ),
      );
      await Promise.all(anims.map((a) => a.finished)).catch(() => {});
      return shell.getBoundingClientRect();
    };

    const arriving = transition.pending?.kind === 'book-in' && transition.pending.bookId === bookId;
    if (prefersReducedMotion() || (openedBooks.has(bookId) && !arriving)) setOpen();
    else {
      setClosed();
      if (arriving) handoff(); // the flying book landed on exactly this spot
      requestAnimationFrame(() => void open());
    }
    openedBooks.add(bookId);

    const onResize = () => {
      place();
      if (frame.dataset.state === 'closed') shell.style.transform = `translateX(${g.shift}px)`;
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      bookCover.close = null;
    };
  }, [bookId]);

  return (
    <div
      ref={ref}
      className={`book-shell ${styles.shell}`}
      aria-hidden="true"
      data-testid="book-cover"
    >
      <div className="book-edge" />
      <div className="book-hinge">
        <div className="book-cover-face">
          <div className="book-cover-title">{name}</div>
          <div className="book-cover-rule" />
          <div className="book-cover-tagline">{tagline}</div>
        </div>
        <div className="book-cover-back" />
      </div>
    </div>
  );
}
