import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/app/about/about.module.css';
import { PathTimeline } from '@/components/path/PathTimeline';
import { timeline } from '@/components/path/timeline';
import { getManifest } from '@/lib/data';

export const metadata: Metadata = {
  title: 'The path · Scripture as Story',
  description: 'Every stop on the path, in order, as one timeline.',
};

/** The Path (PLAN §9): the whole sequence as a vertical timeline, grouped by book. */
export default function PathPage() {
  const m = getManifest();
  const groups = timeline(m);
  const stops = groups.flatMap((g) => g.rows).filter((r) => r.kind === 'section' && !r.detour);
  const minutes = stops.reduce((n, r) => n + (r.kind === 'section' ? r.minutes : 0), 0);
  return (
    <main className={styles.page} data-testid="path">
      <nav className={styles.nav}>
        <Link href="/">← All books</Link>
      </nav>
      <header className={styles.header}>
        <p className="label">Scripture as Story</p>
        <h1 id="page-heading" tabIndex={-1} className="display">
          The path
        </h1>
        <p className={styles.lede}>
          {stops.length} sections in {groups.filter((g) => g.kind === 'book').length} books, about{' '}
          {Math.round(minutes / 60)} hours of reading. Dashed rings are optional detours.
        </p>
      </header>
      <PathTimeline groups={groups} />
      <p className={styles.footer}>
        <Link href="/about/">About this path</Link> · <Link href="/sources/">Sources</Link>
      </p>
    </main>
  );
}
