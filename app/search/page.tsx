import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/app/about/about.module.css';
import { Search } from '@/components/search/Search';

export const metadata: Metadata = {
  title: 'Search · Scripture as Story',
  description: 'Search every section on the path; results open at the verse.',
};

/** Search (PLAN P2.3): Pagefind over the built section and bridge pages, in path order. */
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
