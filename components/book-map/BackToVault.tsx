'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { prefersReducedMotion } from '@/lib/camera';
import styles from './book-page.module.css';

/** "All books": the cover closes over the map, then the Vault pulls the camera back (PLAN §9). */
export function BackToVault() {
  const router = useRouter();
  return (
    <Link
      href="/"
      className={styles.back}
      onClick={(e) => {
        const cover = document.querySelector<HTMLElement>('[data-testid="book-cover"]');
        if (!cover || prefersReducedMotion()) return;
        e.preventDefault();
        cover.hidden = false;
        cover.dataset.closing = '';
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          router.push('/');
        };
        cover.addEventListener('animationend', (ev) => ev.target === cover && go());
        window.setTimeout(go, 700); // in case animations are unavailable
      }}
    >
      ← All books
    </Link>
  );
}
