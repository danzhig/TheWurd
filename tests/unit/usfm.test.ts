import { describe, expect, it } from 'vitest';
import { parseUsfm } from '@/scripts/parse-usfm';
import { CANON_BY_ID } from '@/scripts/lib/canon';

// Placeholder words only; no scripture is typed in tests.
const SAMPLE = String.raw`\id GEN test
\h Test
\mt1 Test
\c 1
\s1 A heading
\p
\v 1 \w Alpha|strong="H1"\w* beta\f + \fr 1:1 \ft A note.\f* gamma.
\v 2 Delta
\q1 epsilon \wj zeta eta\wj* theta.
\c 2
\p
\v 1 Iota\f + \fr 2:1 \ft Glued.\f*kappa.
`;

describe('USFM parser', () => {
  const book = CANON_BY_ID.get('Gen')!;
  const parsed = parseUsfm(SAMPLE, book);

  it('reads chapters and verses', () => {
    expect(parsed.chapterLengths).toEqual([2, 1]);
    expect(parsed.verses.map((v) => v.ref)).toEqual(['Gen.1.1', 'Gen.1.2', 'Gen.2.1']);
  });

  it('strips word markup and keeps footnotes with offsets', () => {
    const v = parsed.verses[0]!;
    expect(v.text).toBe('Alpha beta gamma.');
    expect(v.heading).toBe('A heading');
    expect(v.footnotes).toEqual([{ at: 10, text: 'A note.' }]);
  });

  it('keeps poetry blocks and words-of-Jesus spans', () => {
    const v = parsed.verses[1]!;
    expect(v.blocks.map((b) => b.style)).toEqual(['p', 'q1']);
    expect(v.text).toBe('Delta epsilon zeta eta theta.');
    const [a, b] = v.wj![0]!;
    expect(v.text.slice(a, b)).toBe('zeta eta');
  });

  it('inserts a space where a footnote glues two words', () => {
    expect(parsed.verses[2]!.text).toBe('Iota kappa.');
    expect(parsed.spacesInserted).toBe(1);
  });
});
