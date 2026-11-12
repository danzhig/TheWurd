import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/app/about/about.module.css';
import { Search } from '@/components/search/Search';

export const metadata: Metadata = {
  title: 'Search · Scripture as Story',
  description: 'Search the whole Bible, the path and the library; results open at the verse.',
};

/**
 * Search (PLAN P2.3, P5.4): Pagefind over every section and bridge page; the path first, then
 * the library, with a filter for either.
 */
export default function SearchPage() {
  return (
    <main className={styles.page} data-testid="search">
      <nav className={styles.nav}>
        <Link href="/">← All books</Link>
      </nav>
      <header className={styles.header}>
        <p className="label">Scripture as Story</p>
        <h1 id="page-heading" tabIndex={-1} className="display">
          Search
        </h1>
      </header>
      <Search />
    </main>
  );
}
