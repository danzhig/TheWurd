/**
 * pnpm terms:lookup <ref> [--ls] — print every Phase 3 layer for one verse, for drafting cards:
 * the tagged Hebrew or Greek words (with lexicon glosses and parsed grammar), the Septuagint, and
 * the Vulgate, Douay-Rheims, KJV and Brenton texts. Refs are OSIS in English numbering ("Gen.1.2").
 * The Septuagint, Vulgate and Douay-Rheims follow their own numbering: where it differs, the
 * verse shown may not be the parallel one, so check TVTMS before citing it.
 */
import { keysFor, loadTermSources, LXX_BOOKS } from './terms/sources';

const ref = process.argv[2];
if (!ref) {
  console.error('Usage: pnpm terms:lookup <OSIS ref, e.g. Gen.1.2> [--ls]');
  process.exit(1);
}
const s = loadTermSources({ lewisShort: process.argv.includes('--ls') });
const k = keysFor(ref);
const [, c, v] = ref.split('.');

const words = s.hebrew.get(k.step) ?? s.greek.get(k.step) ?? [];
console.log(`\n${ref}: ${words.length} tagged words`);
for (const w of words) {
  const lex = (w.dataset === 'TAHOT' ? s.tbesh : s.tbesg).get(w.lexeme);
  const morph = (w.dataset === 'TAHOT' ? s.hebrewMorph : s.greekMorph).get(w.grammar);
  console.log(
    `  #${String(w.wordIndex).padStart(2, '0')} ${w.text}  ${w.lexeme} ${w.grammar}  “${w.gloss}”` +
      (lex ? `  lemma ${lex.lemma} = ${lex.gloss}` : '') +
      `  [${w.file}:${w.line}]`,
  );
  if (morph) console.log(`        ${morph}`);
}
// Where the Hebrew numbers this verse differently, the Greek and Latin usually follow it.
const alt = words
  .find((w) => w.sourceRef)
  ?.sourceRef?.split('.')
  .slice(1);
const places = [[c, v], ...(alt ? [alt] : [])] as [string, string][];
for (const { abbr } of LXX_BOOKS[k.book] ?? [])
  for (const [pc, pv] of places) {
    const g = s.lxx.get(`${abbr}.${pc}.${pv}`);
    if (g)
      console.log(
        `\nLXX ${abbr} ${pc}:${pv}: ${g.map((t) => (t.lemma ? `${t.text}[${t.lemma}]` : t.text)).join(' ')}  [${g[0]!.file}]`,
      );
  }
for (const [name, map] of [
  ['Vulgate', s.vulgate],
  ['Douay-Rheims', s.drc],
  ['KJV', s.kjv],
  ['Brenton', s.brenton],
] as const) {
  for (const [pc, pv] of places) {
    const key = `${k.usfm.split('.')[0]}.${pc}.${pv}`;
    const text = map.get(key);
    if (text) console.log(`\n${name} ${key}: ${text}`);
  }
}
if (s.lewisShort.size) console.log(`\nLewis & Short: ${s.lewisShort.size} entries loaded`);
