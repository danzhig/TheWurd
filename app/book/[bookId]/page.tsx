import type { Metadata } from 'next';
import { BackToVault } from '@/components/book-map/BackToVault';
import { BookCover } from '@/components/book-map/BookCover';
import { BookMap, type StationData } from '@/components/book-map/BookMap';
import styles from '@/components/book-map/book-page.module.css';
import { getFullManifest } from '@/lib/data';
import { prettyRange } from '@/lib/format';

export const dynamicParams = false;

// Every book with sections: the path's and the library's (Phase 5).
export function generateStaticParams() {
  return getFullManifest()
    .books.filter((b) => b.inPlan || b.library)
    .map((b) => ({ bookId: b.id }));
}

type Params = { params: Promise<{ bookId: string }> };

function readingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 30) / 2; // nearest half hour
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function book(id: string) {
  const m = getFullManifest();
  const b = m.books.find((x) => x.id === id && (x.inPlan || x.library));
  if (!b) throw new Error(`Unknown book ${id}`);
  return { book: b, sections: m.sections.filter((s) => s.bookId === id) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { bookId } = await params;
  const { book: b } = book(bookId);
  return {
    title: `${b.name} · Scripture as Story`,
    description: `${b.tagline}. ${b.setting ?? ''}`.trim(),
  };
}

/** Level 1: a book's sections as stations along a path (PLAN §9). */
export default async function BookPage({ params }: Params) {
  const { bookId } = await params;
  const { book: b, sections } = book(bookId);
  const minutes = sections
    .filter((s) => s.status === 'read' || s.status === 'skim')
    .reduce((n, s) => n + s.minutes, 0);
  const stations: StationData[] = sections.map((s) => ({
    id: s.id,
    title: s.title,
    range: prettyRange(s.range),
    status: s.status,
    highlight: s.highlight,
    minutes: s.minutes,
    href: `/read/${s.id}/`,
  }));
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <BackToVault bookId={b.id} name={b.name} tagline={b.tagline} />
      </nav>
      {/* The open book: its cover (which opens on arrival) over pages carrying the section map. */}
      <div className={styles.frame} data-book-frame={b.id} data-state="open">
        <BookCover bookId={b.id} name={b.name} tagline={b.tagline} />
        {/* The cover's shadow on the pages while it swings (BookCover animates it). */}
        <div className="book-cover-cast" data-cover-shadow="" aria-hidden="true" />
        <div className={styles.pages} data-pages data-theme="vellum">
          <header className={styles.header}>
            <h1 id="page-heading" tabIndex={-1} className={`book-name ${styles.name}`}>
              {b.name}
            </h1>
            <p className={`tagline ${styles.tagline}`}>{b.tagline}</p>
            {b.library ? (
              <p className={`label ${styles.library}`} data-testid="library-label">
                Library · not on the path
              </p>
            ) : null}
            <p className={styles.meta}>
              {b.setting ? <>{b.setting} · </> : null}
              about {readingTime(minutes)}
              {' · '}
              {sections.length} sections
            </p>
          </header>
          <BookMap bookId={b.id} bookName={b.name} stations={stations} library={!!b.library} />
        </div>
      </div>
      <noscript>
        <style>{`[data-map-pending]{visibility:visible!important}`}</style>
      </noscript>
    </main>
  );
}
