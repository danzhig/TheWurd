'use client';

import { useLayoutEffect, useRef } from 'react';
import { openedBooks } from './BookMap';
import styles from './book-cover.module.css';

/**
 * The book's cover opening as two halves on a vertical spine (PLAN §9, 700 ms). Rendered on the
 * server so it plays on a fresh load before JavaScript arrives; hidden before paint when returning
 * to a map already opened in this session. Under reduced motion it is a short crossfade.
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
    if (openedBooks.has(bookId) && ref.current) ref.current.hidden = true;
    openedBooks.add(bookId);
  }, [bookId]);
  const face = (
    <div className={styles.face}>
      <div className={`gilt-frame ${styles.frame}`}>
        <span className={`book-name ${styles.name}`}>{name}</span>
        <span className="tagline">{tagline}</span>
      </div>
    </div>
  );
  return (
    <div
      ref={ref}
      className={styles.cover}
      aria-hidden="true"
      data-testid="book-cover"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.hidden = true;
      }}
    >
      <div className={`${styles.half} ${styles.left}`}>{face}</div>
      <div className={`${styles.half} ${styles.right}`}>{face}</div>
    </div>
  );
}
