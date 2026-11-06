import type { Metadata } from 'next';
import { ContentNote } from '@/components/reader/ContentNote';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { SectionBody } from '@/components/reader/SectionBody';
import styles from '@/components/reader/reader.module.css';
import { getManifest, getSection } from '@/lib/data';
import { prettyRange } from '@/lib/format';
import { canBeStop, defaultNav, jobOptions } from '@/lib/nav';

export const dynamicParams = false;

export function generateStaticParams() {
  return getManifest().sections.map((s) => ({ sectionId: s.id }));
}

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
  const article = (
    <article className={styles.page} data-section={s.id} data-status={s.status}>
      <header className={styles.header}>
        <p className="label">{s.bookName}</p>
        <h1 id="page-heading" tabIndex={-1} className="display">
          {s.title}
        </h1>
        <p className={styles.ref}>
          {s.bookName} {prettyRange(s.range)}
          {s.webcDiffers ? <> · WEBC numbers this passage {s.webcRange}</> : null}
          {' · '}
          {s.minutes} min
        </p>
        {s.versificationNote ? <p className={styles.ref}>{s.versificationNote}</p> : null}
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
            An optional detour, off the main path. Turn optional detours on in reading settings to
            include it.
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
      stop={canBeStop(s.id)}
      readOnOpen={s.status === 'skim'}
      defaults={defaultNav(s.id)}
      jobOptions={jobOptions()}
    >
      {article}
    </ReaderShell>
  );
}
