import type { ReactNode } from 'react';
import type { VerseOut } from '@/lib/types';

const POETRY: Record<string, number> = { q1: 1, q2: 2, q3: 3 };

interface Part {
  verse: VerseOut;
  text: string;
  start: number; // offset of this block's text within the verse's plain text
  first: boolean; // first block of the verse
  last: boolean; // last block of the verse
}

interface Line {
  style: string;
  parts: Part[];
  cont?: boolean; // continues the previous paragraph after a note placed mid-paragraph
  split?: boolean; // the paragraph continues after a note
}

/** Group WEBC blocks into paragraphs and poetry lines, keeping each verse's number at its start. */
function toLines(verses: VerseOut[], breakAt: Set<string> = new Set()): Line[] {
  const lines: Line[] = [];
  for (const v of verses) {
    if (!v.blocks.length) {
      // A verse WEBC prints only as a footnote (e.g. Acts 8:37): keep its number and note in place.
      const part: Part = { verse: v, text: '', start: 0, first: true, last: true };
      const last = lines.at(-1);
      if (last && !POETRY[last.style]) last.parts.push(part);
      else lines.push({ style: 'p', parts: [part] });
      continue;
    }
    let offset = 0;
    v.blocks.forEach((b, i) => {
      const part: Part = {
        verse: v,
        text: b.text,
        start: offset,
        first: i === 0,
        last: i === v.blocks.length - 1,
      };
      offset += b.text.length + 1;
      const last = lines.at(-1);
      if (!last || b.brk || POETRY[b.style] || POETRY[last.style])
        lines.push({ style: b.style, parts: [part] });
      else if (i === 0 && breakAt.has(v.ref)) {
        // A note sits at this verse: end the paragraph here and continue it after the note.
        last.split = true;
        lines.push({ style: b.style, parts: [part], cont: true });
      } else last.parts.push(part);
    });
  }
  return lines;
}

/** Stable id for a footnote: verse ref plus its index within the verse. */
export function footnoteId(ref: string, i: number): string {
  return `fn-${ref.replace(/[.!]/g, '-')}-${i + 1}`;
}

export function verseAnchor(v: Pick<VerseOut, 'c' | 'v' | 'part'>): string {
  return `v-${v.c}-${v.v}${v.part ?? ''}`;
}

/** Render one block's text with footnote callers at their offsets. */
function withCallers(part: Part, numberOf: (ref: string, i: number) => number): ReactNode[] {
  const notes = (part.verse.footnotes ?? [])
    .map((n, i) => ({ ...n, i }))
    // A note belongs to the block it falls in; one at a block's end stays with that block.
    .filter((n) => n.at >= part.start && (part.last || n.at <= part.start + part.text.length));
  const out: ReactNode[] = [];
  let pos = 0;
  for (const n of notes) {
    const local = Math.min(Math.max(n.at - part.start, 0), part.text.length);
    out.push(part.text.slice(pos, local));
    const num = numberOf(part.verse.ref, n.i);
    out.push(
      <sup key={`f${n.i}`} className="footnote-call" data-pagefind-ignore="">
        <a
          href={`#${footnoteId(part.verse.ref, n.i)}`}
          id={`${footnoteId(part.verse.ref, n.i)}-call`}
          aria-label={`Footnote ${num}`}
        >
          {num}
        </a>
      </sup>,
    );
    pos = local;
  }
  out.push(part.text.slice(pos));
  return out;
}

export interface VerseTextProps {
  verses: VerseOut[];
  dropCap?: boolean;
  /** Content placed immediately before the paragraph or line where a verse starts (notes). */
  before?: Record<string, ReactNode>;
  /** Running footnote numbering shared across the section (default: per verse). */
  numberOf?: (ref: string, i: number) => number;
}

/**
 * Renders WEBC verses as paragraphs and poetry lines. Verse numbers are WEBC's (PLAN D10). With
 * `dropCap`, an opening prose paragraph starts with a gold drop cap and its verse number is left out.
 */
export function VerseText({
  verses,
  dropCap = false,
  before = {},
  numberOf = (_r, i) => i + 1,
}: VerseTextProps) {
  const lines = toLines(verses, new Set(Object.keys(before)));
  const useDropCap =
    dropCap && lines[0] && !POETRY[lines[0].style] && !lines[0].parts[0]?.verse.heading;
  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    for (const p of line.parts) {
      if (!p.first) continue;
      if (p.verse.heading) {
        nodes.push(
          <p key={`h-${p.verse.ref}`} className="verse-heading">
            {p.verse.heading}
          </p>,
        );
      }
      const aside = before[p.verse.ref];
      if (aside) nodes.push(<div key={`a-${p.verse.ref}`}>{aside}</div>);
    }
    const level = POETRY[line.style];
    const cls = [
      level ? `poetry indent-${level}` : '',
      i === 0 && useDropCap ? 'drop-cap' : '',
      line.split ? 'para-split' : '',
      line.cont ? 'para-cont' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const content = line.parts.map((p, j) => (
      <span
        key={j}
        id={p.first ? verseAnchor(p.verse) : undefined}
        data-verse={p.first ? p.verse.ref : undefined}
      >
        {p.first && !(i === 0 && j === 0 && useDropCap) ? (
          <sup className="verse-num" data-pagefind-ignore="">
            {p.verse.v}
          </sup>
        ) : null}
        {withCallers(p, numberOf)}{' '}
      </span>
    ));
    nodes.push(
      level ? (
        <div key={`l${i}`} className={cls}>
          {content}
        </div>
      ) : (
        <p key={`l${i}`} className={cls || undefined}>
          {content}
        </p>
      ),
    );
  });
  return <div className="prose">{nodes}</div>;
}
