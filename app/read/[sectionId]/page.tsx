import type { Metadata } from 'next';
import { ContentNote } from '@/components/reader/ContentNote';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { SectionBody } from '@/components/reader/SectionBody';
import styles from '@/components/reader/reader.module.css';
import Link from 'next/link';
import { getFullManifest, getSection } from '@/lib/data';
import { prettyRange } from '@/lib/format';
import { canBeStop, defaultNav, libraryNav, pathPosition } from '@/lib/nav';

export const dynamicParams = false;

// Every section: the path's and the library's (Phase 5).
export function generateStaticParams() {
  return getFullManifest().sections.map((s) => ({ sectionId: s.id }));
}

const isLibrary = (id: string) => !!getFullManifest().sections.find((s) => s.id === id)?.library;

type Params = { params: Promise<{ sectionId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { sectionId } = await params;
  const s = getSection(sectionId);
  return {
    title: `${s.title} · ${s.bookName} ${prettyRange(s.range)} · Scripture as Story`,
    description:
      s.summary ?? `${s.bookName} ${prettyRange(s.range)}, World English Bible Catholic Edition.`,
  };
}

const STATUS_LABEL = { read: null, skim: 'Skim', optional: 'Detour', skip: 'Skipped' } as const;

export default async function ReadPage({ params }: Params) {
  const { sectionId } = await params;
  const s = getSection(sectionId);
  const statusLabel = STATUS_LABEL[s.status];
  const library = isLibrary(s.id);
  const article = (
    <article
      className={styles.page}
      data-section={s.id}
      data-status={s.status}
      // Search index (Pagefind): this article is the page's content, sorted by path position.
      data-pagefind-body=""
      data-pagefind-sort={`order:${pathPosition(s.id)}`}
      data-pagefind-meta={`status:${s.status}`}
    >
      <header className={styles.header}>
        <p className="label" data-pagefind-meta="book" data-pagefind-ignore="index">
          {s.bookName}
        </p>
        <h1 id="page-heading" tabIndex={-1} className="display">
          {s.title}
        </h1>
        <p
          className={styles.ref}
          data-pagefind-meta={`range:${prettyRange(s.range).replace(/,/g, ';')}`}
          data-pagefind-ignore="index"
        >
          {s.bookName} {prettyRange(s.range)}
          {s.webcDiffers ? <> · WEBC numbers this passage {s.webcRange}</> : null}
          {' · '}
          {s.minutes} min
        </p>
        {s.versificationNote ? <p className={styles.ref}>{s.versificationNote}</p> : null}
        {library ? (
          <p className={styles.library} data-testid="library-label" data-pagefind-ignore="all">
            <span className="label">Library · not on the path</span>{' '}
            <Link href="/path/">Back to the path</Link>
          </p>
        ) : null}
        {statusLabel || s.highlight ? (
          <p className={styles.badges}>
            {statusLabel ? <span className={styles.badge}>{statusLabel}</span> : null}
            {s.highlight ? <span className={styles.badge}>Slow down</span> : null}
          </p>
        ) : null}
      </header>
      {s.contentNote ? <ContentNote sectionId={s.id} text={s.contentNote} /> : null}
      {s.status === 'optional' ? (
        <div className={styles.detour}>
          <p>
            An optional detour, off the main path. Read it or carry on: Next leads back onto the
            path.
          </p>
        </div>
      ) : null}
      <div className={s.highlight ? styles.highlight : undefined}>
        <SectionBody section={s} />
      </div>
    </article>
  );
  return (
    <ReaderShell
      id={s.id}
      kind="section"
      heading={`${s.bookName} · ${s.title}`}
      bookId={s.bookId}
      bookName={s.bookName}
      stop={!library && canBeStop(s.id)}
      readOnOpen={s.status === 'skim'}
      library={library}
      nav={library ? libraryNav(s.id) : defaultNav(s.id)}
    >
      {article}
    </ReaderShell>
  );
}
