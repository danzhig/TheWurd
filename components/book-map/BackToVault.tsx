'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { animationsOn, bookOut } from '@/lib/transition';
import { bookCover } from './BookCover';
import styles from './book-page.module.css';

/** "All books": the cover closes, then the closed book shrinks back into its medallion (PLAN §9). */
export function BackToVault({
  bookId,
  name,
  tagline,
}: {
  bookId: string;
  name: string;
  tagline: string;
}) {
  const router = useRouter();
  return (
    <Link
      href="/"
      className={styles.back}
      onClick={async (e) => {
        if (!animationsOn() || !bookCover.close) return;
        e.preventDefault();
        const rect = await bookCover.close();
        void bookOut(bookId, name, tagline, rect); // the closed book now lives on the transition layer
        router.push('/');
      }}
    >
      ← All books
    </Link>
  );
}
