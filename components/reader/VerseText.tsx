import type { VerseOut } from '@/lib/types';

interface Line {
  style: string;
  parts: { verse: VerseOut; text: string; first: boolean }[];
}

const POETRY: Record<string, number> = { q1: 1, q2: 2, q3: 3 };

/** Group WEBC blocks into paragraphs and poetry lines, keeping each verse's number at its start. */
function toLines(verses: VerseOut[]): Line[] {
  const lines: Line[] = [];
  for (const v of verses) {
    v.blocks.forEach((b, i) => {
      const last = lines.at(-1);
      const part = { verse: v, text: b.text, first: i === 0 };
      if (!last || b.brk || POETRY[b.style] || POETRY[last.style])
        lines.push({ style: b.style, parts: [part] });
      else last.parts.push(part);
    });
  }
  return lines;
}

/**
 * Renders WEBC verses as paragraphs and poetry lines. Verse numbers are WEBC's (PLAN D10). With
 * `dropCap`, the first paragraph opens with a gold drop cap and its verse number is left out.
 */
export function VerseText({ verses, dropCap = false }: { verses: VerseOut[]; dropCap?: boolean }) {
  const lines = toLines(verses);
  return (
    <div className="prose">
      {lines.map((line, i) => {
        const level = POETRY[line.style];
        const cls = [level ? `poetry indent-${level}` : '', i === 0 && dropCap ? 'drop-cap' : '']
          .filter(Boolean)
          .join(' ');
        const content = line.parts.map((p, j) => (
          <span
            key={j}
            id={p.first ? `v-${p.verse.c}-${p.verse.v}${p.verse.part ?? ''}` : undefined}
          >
            {p.first && !(i === 0 && j === 0 && dropCap) ? (
              <sup className="verse-num">{p.verse.v}</sup>
            ) : null}
            {p.text}{' '}
          </span>
        ));
        return level ? (
          <div key={i} className={cls}>
            {content}
          </div>
        ) : (
          <p key={i} className={cls || undefined}>
            {content}
          </p>
        );
      })}
    </div>
  );
}
