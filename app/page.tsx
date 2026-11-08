import Link from 'next/link';
import { getManifest } from '@/lib/data';
import styles from './page.module.css';

/** Temporary home until the Vault (M5): the plan's books in path order, each opening its map. */
export default function Home() {
  const m = getManifest();
  const books = m.steps
    .filter((s) => s.kind === 'book')
    .map((s) => m.books.find((b) => b.id === s.id)!)
    .concat(m.books.filter((b) => b.id === 'John' && b.inPlan));
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Scripture as Story</h1>
      <p className={styles.tagline}>A guided path through the Catholic Bible.</p>
      <ol className={styles.books} aria-label="Books on the path">
        {books.map((b) => (
          <li key={b.id}>
            <Link href={`/book/${b.id}/`} className={styles.book}>
              <span className="book-name">{b.name}</span>
              <span className="tagline">{b.tagline}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className={styles.note}>The full map of the canon arrives in the next milestone.</p>
    </main>
  );
}
