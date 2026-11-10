'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuiltTerm, Card } from '@/lib/terms';
import styles from './term-deck.module.css';

const CARD_TITLE: Record<Card['kind'], string> = {
  original: 'Original',
  septuagint: 'Septuagint',
  vulgate: 'Vulgate',
  english: 'English',
  debate: 'Why it is debated',
};

const VERSION: Record<string, string> = {
  webc: 'World English Bible Catholic',
  drc: 'Douay-Rheims',
  kjv: 'King James',
  brenton: 'Brenton (Septuagint)',
};

const LANG_ATTR = { hbo: 'he', arc: 'arc', grc: 'grc' } as const;

/** "Gen.1.2" or "GEN.1.2" → "1:2" (the book is the section's). */
function cv(ref: string): string {
  const [, c, v] = ref.split('.');
  return `${c}:${v}`;
}

/**
 * The card deck for one key term (PLAN §13): a horizontal deck of cards, moved by swipe, the arrow
 * keys or the dots. A bottom sheet on phones, a centred panel on wider screens.
 */
export function TermDeck({ term, onClose }: { term: BuiltTerm | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (term && !d.open) d.showModal();
    if (!term && d.open) d.close();
  }, [term]);

  // Which card is in view, as the reader swipes.
  useEffect(() => {
    const el = track.current;
    if (!el || !term) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setIndex(Number((e.target as HTMLElement).dataset.index));
      },
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll('[data-index]').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [term]);

  const go = (i: number) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: 'smooth' });
    setIndex(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!term) return;
    if (e.key === 'ArrowRight') go(Math.min(index + 1, term.cards.length - 1));
    else if (e.key === 'ArrowLeft') go(Math.max(index - 1, 0));
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={ref}
      className={styles.deck}
      onClose={onClose}
      onKeyDown={onKey}
      aria-labelledby="term-title"
      data-testid="term-deck"
    >
      {term ? (
        <>
          <header className={styles.head}>
            <div>
              <p className="label">
                {term.ref.split('.')[0]} {cv(term.ref)} · “{term.span.text}”
                {term.status !== 'verified' ? (
                  <span className={styles.draft} data-testid="term-draft">
                    {' '}
                    · Draft, not yet verified
                  </span>
                ) : null}
              </p>
              <h2 id="term-title" className={styles.title}>
                {term.title}
              </h2>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close word cards"
            >
              ×
            </button>
          </header>
          <ol className={styles.track} ref={track} aria-label="Word cards">
            {term.cards.map((card, i) => (
              <li
                key={card.kind}
                className={styles.card}
                data-index={i}
                data-card={card.kind}
                aria-label={`${CARD_TITLE[card.kind]}, card ${i + 1} of ${term.cards.length}`}
              >
                <h3 className="label">{CARD_TITLE[card.kind]}</h3>
                <CardBody card={card} />
              </li>
            ))}
          </ol>
          <nav className={styles.dots} aria-label="Cards">
            {term.cards.map((card, i) => (
              <button
                key={card.kind}
                type="button"
                className={styles.dot}
                aria-label={CARD_TITLE[card.kind]}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </nav>
        </>
      ) : null}
    </dialog>
  );
}

function CardBody({ card }: { card: Card }) {
  switch (card.kind) {
    case 'original':
      return (
        <>
          {card.words.map((w) => (
            <div key={w.cite} className={styles.word}>
              <p className={styles.form} lang={LANG_ATTR[card.lang]} dir="auto">
                {w.form}
              </p>
              <p className={styles.translit}>{w.translit}</p>
              <dl className={styles.facts}>
                {w.lemma ? (
                  <>
                    <dt>Dictionary form</dt>
                    <dd lang={LANG_ATTR[card.lang]} dir="auto">
                      {w.lemma}
                    </dd>
                  </>
                ) : null}
                {w.gloss ? (
                  <>
                    <dt>Gloss</dt>
                    <dd>{w.gloss}</dd>
                  </>
                ) : null}
                <dt>Strong’s</dt>
                <dd>{w.strongs}</dd>
                <dt>Grammar</dt>
                <dd>{w.grammarText ?? w.grammar}</dd>
              </dl>
              {w.meaning?.length ? (
                <details className={styles.range}>
                  <summary>Range of meaning</summary>
                  <ul>
                    {w.meaning.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <p className={styles.cite}>{w.cite}</p>
            </div>
          ))}
          <p className={styles.credit}>STEPBible.org (CC BY 4.0)</p>
        </>
      );
    case 'septuagint':
      return (
        <>
          {card.words.map((w) => (
            <div key={w.cite} className={styles.word}>
              <p className={styles.form} lang="grc">
                {w.form}
              </p>
              <p className={styles.translit}>{w.translit}</p>
              {w.lemma ? (
                <p>
                  Dictionary form <span lang="grc">{w.lemma}</span>
                </p>
              ) : null}
              <p className={styles.cite}>{w.cite}</p>
            </div>
          ))}
          {card.printCheck ? (
            <p className={styles.note}>Not yet checked against the printed Swete edition.</p>
          ) : null}
          <p className={styles.credit}>
            Swete’s Septuagint, First1KGreek; lemmas by Morpheus (CC BY-SA 4.0)
          </p>
        </>
      );
    case 'vulgate':
      return (
        <>
          <p className={styles.form} lang="la">
            {card.words}
          </p>
          <p className={styles.cite}>Clementine Vulgate {cv(card.ref)}</p>
          {card.sense ? (
            <p>
              <span lang="la">{card.sense.headword}</span>: {card.sense.text}
              <span className={styles.cite}> ({card.sense.cite})</span>
            </p>
          ) : null}
          {card.sense ? (
            <p className={styles.credit}>
              Lewis &amp; Short, Perseus Digital Library (CC BY-SA 4.0)
            </p>
          ) : null}
        </>
      );
    case 'english':
      return (
        <dl className={styles.renderings}>
          {card.renderings.map((r) => (
            <div key={r.version}>
              <dt>
                {VERSION[r.version] ?? r.version} <span className={styles.cite}>{cv(r.ref)}</span>
              </dt>
              <dd>“{r.words}”</dd>
            </div>
          ))}
        </dl>
      );
    case 'debate':
      return (
        <>
          <p className={styles.debate}>{card.text}</p>
          {card.sources.length ? (
            <ul className={styles.sources}>
              {card.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              Draft: sources for this explanation are still to be added.
            </p>
          )}
        </>
      );
  }
}
