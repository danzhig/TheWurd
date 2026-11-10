import type { ReactNode } from 'react';
import { prettyRange } from '@/lib/format';
import type { FoldOut, NoteOut, SectionFile, VerseOut } from '@/lib/types';
import { footnoteId, VerseText, verseAnchor } from './VerseText';
import styles from './reader.module.css';

type Segment =
  { kind: 'text'; verses: VerseOut[] } | { kind: 'fold'; fold: FoldOut; verses: VerseOut[] };

function segments(verses: VerseOut[], folds: FoldOut[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < verses.length) {
    const fold = folds.find((f) => f.from === verses[i]!.ref);
    if (fold) {
      const end = verses.findIndex((v) => v.ref === fold.to);
      out.push({ kind: 'fold', fold, verses: verses.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    const last = out.at(-1);
    if (last?.kind === 'text') last.verses.push(verses[i]!);
    else out.push({ kind: 'text', verses: [verses[i]!] });
    i++;
  }
  return out;
}

export function NoteCard({ note }: { note: NoteOut }) {
  return (
    <aside className={styles.note} data-note={note.id} aria-label="Reader's note">
      <p className="label">Note</p>
      <p>{note.text}</p>
    </aside>
  );
}

function FootnoteList({
  verses,
  numberOf,
}: {
  verses: VerseOut[];
  numberOf: (ref: string, i: number) => number;
}) {
  const items = verses.flatMap((v) => (v.footnotes ?? []).map((f, i) => ({ v, f, i })));
  if (!items.length) return null;
  return (
    <section
      className={styles.footnotes}
      aria-label="Translator's footnotes"
      data-pagefind-ignore=""
    >
      <p className="label">Footnotes</p>
      <ol>
        {items.map(({ v, f, i }) => (
          <li key={footnoteId(v.ref, i)} id={footnoteId(v.ref, i)} value={numberOf(v.ref, i)}>
            <a href={`#${footnoteId(v.ref, i)}-call`} className={styles.backref}>
              {v.c}:{v.v}
            </a>{' '}
            {f.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The text of a section with its folds and notes; whole-section skim and skip wrap it in a card. */
export function SectionBody({ section }: { section: SectionFile }) {
  const numbers = new Map<string, number>();
  let n = 0;
  for (const v of section.verses)
    (v.footnotes ?? []).forEach((_, i) => numbers.set(`${v.ref}#${i}`, ++n));
  const numberOf = (ref: string, i: number) => numbers.get(`${ref}#${i}`) ?? 0;

  const notesAt = (at: NoteOut['at']) => section.notes.filter((x) => x.at === at);
  const verseNotes = section.notes.filter((x) => x.at === 'verse');
  const segs = segments(section.verses, section.folds);

  const body: ReactNode[] = [];
  segs.forEach((seg, si) => {
    const before: Record<string, ReactNode> = {};
    for (const note of verseNotes) {
      if (!seg.verses.some((v) => v.ref === note.verseRef)) continue;
      if (seg.verses[0]!.ref === note.verseRef) body.push(<NoteCard key={note.id} note={note} />);
      else before[note.verseRef!] = <NoteCard note={note} />;
    }
    if (seg.kind === 'text') {
      body.push(
        <VerseText
          key={`s${si}`}
          verses={seg.verses}
          dropCap={si === 0 && section.status !== 'skip'}
          before={before}
          numberOf={numberOf}
        />,
      );
    } else {
      body.push(
        <details key={`s${si}`} className={styles.fold} data-fold={seg.fold.from}>
          <summary>
            <span className="label">{seg.fold.status === 'skim' ? 'Skim' : 'Skipped'}</span>
            <span className={styles.foldRange}>{prettyRange(seg.fold.webcRange)}</span>
            <span className={styles.foldLabel}>{seg.fold.label}</span>
            <span className={styles.foldAction} aria-hidden="true">
              Read it anyway
            </span>
          </summary>
          <VerseText verses={seg.verses} before={before} numberOf={numberOf} />
        </details>,
      );
    }
  });

  const text = (
    <>
      {body}
      <FootnoteList verses={section.verses} numberOf={numberOf} />
    </>
  );
  const ref = `${section.bookName} ${prettyRange(section.webcRange)}`;

  return (
    <>
      {notesAt('start').map((x) => (
        <NoteCard key={x.id} note={x} />
      ))}
      {section.status === 'skim' ? (
        <div className={styles.statusCard} data-status="skim">
          <p className="label">Skim</p>
          <p>{section.summary}</p>
          <details className={styles.wholeFold} data-fold={section.verses[0]?.ref}>
            <summary>Open the text · {ref}</summary>
            {text}
          </details>
        </div>
      ) : section.status === 'skip' ? (
        <div className={styles.statusCard} data-status="skip">
          <p className="label">Skipped · {ref}</p>
          <p>{section.summary}</p>
          {notesAt('fold').map((x) => (
            <NoteCard key={x.id} note={x} />
          ))}
          <details className={styles.wholeFold} data-fold={section.verses[0]?.ref}>
            <summary>Show the text</summary>
            {text}
          </details>
        </div>
      ) : (
        <>
          {notesAt('fold').map((x) => (
            <NoteCard key={x.id} note={x} />
          ))}
          {text}
        </>
      )}
      {notesAt('end').map((x) => (
        <NoteCard key={x.id} note={x} />
      ))}
    </>
  );
}

export { verseAnchor };
