import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/app/about/about.module.css';
import { getAllTerms } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Review · Scripture as Story',
  robots: { index: false, follow: false },
};

/**
 * Review (PLAN §18, check 13): every key term that is not yet verified, with the rows it cites, so
 * David can approve it. Drafts never appear on the production site, so there this page is empty.
 */
export default function ReviewPage() {
  const production = process.env.VERCEL_ENV === 'production';
  const terms = production ? [] : getAllTerms().filter((t) => t.status !== 'verified');
  return (
    <main className={styles.page} data-testid="review">
      <nav className={styles.nav}>
        <Link href="/">← All books</Link>
      </nav>
      <header className={styles.header}>
        <p className="label">Scripture as Story</p>
        <h1 id="page-heading" tabIndex={-1} className="display">
          Terms awaiting review
        </h1>
        <p className={styles.lede}>
          {production
            ? 'Drafts are shown on preview deployments only.'
            : `${terms.length} key terms are drafts. Open each in its section with Depth on; the rows each one cites are listed below.`}
        </p>
      </header>
      {terms.map((t) => (
        <section key={t.id} aria-labelledby={`t-${t.id}`} data-review={t.id}>
          <h2 id={`t-${t.id}`}>
            {t.title}{' '}
            <span className={styles.muted}>· {t.ref.replace('.', ' ').replace('.', ':')}</span>
          </h2>
          <p>
            “{t.span.text}” · {t.status} ·{' '}
            <Link href={`/read/${t.sectionId}/#v-${t.ref.split('.')[1]}-${t.ref.split('.')[2]}`}>
              Open in the reader
            </Link>
          </p>
          <ul className={styles.plain}>
            {t.citations.map((c) => (
              <li key={c} className={styles.muted}>
                {c}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
