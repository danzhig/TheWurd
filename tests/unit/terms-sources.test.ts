import { describe, expect, it } from 'vitest';
import { parseLewisShort } from '../../scripts/terms/lewis-short';
import { lxxTokens, readLxxLemmas, readLxxTei } from '../../scripts/terms/lxx';
import {
  byVerse,
  parseBriefLexicon,
  parseMorphCodes,
  parseTagnt,
  parseTahot,
} from '../../scripts/terms/stepbible';
import { readUsfmVerses } from '../../scripts/terms/usfm-verses';

const F = 'tests/fixtures/terms';

describe('Phase 3 sources: STEPBible', () => {
  const heb = byVerse(parseTahot(`${F}/tahot.txt`, 'TAHOT'));

  it('reads TAHOT words with their verse, position, Strong’s and source line', () => {
    const v = heb.get('Gen.1.2')!;
    expect(v.map((t) => t.wordIndex)).toEqual(v.map((_, i) => i + 1));
    const ruach = v.find((t) => t.lexeme === 'H7307G')!;
    expect(ruach.strongs).toContain('H7307G');
    expect(ruach.grammar).toMatch(/^HC\/Nc/);
    expect(ruach.text).toBe(ruach.text.normalize('NFC'));
    expect(ruach.line).toBeGreaterThan(1);
  });

  it('keeps the Hebrew numbering where it differs from the English', () => {
    const v = heb.get('Gen.31.55')!;
    expect(v[0]!.sourceRef).toBe('Gen.32.1');
  });

  it('reads TAGNT words with lemma, grammar and editions, without the source transliteration', () => {
    const v = parseTagnt(`${F}/tagnt.txt`, 'TAGNT').filter((t) => t.ref === 'Luk.1.28');
    expect(v.length).toBeGreaterThan(10);
    expect(v[0]!.text).not.toMatch(/\(/);
    expect(v[0]!.editions).toMatch(/NA28/);
    expect(v.some((t) => t.grammar.startsWith('V-'))).toBe(true);
  });

  it('reads TBESH by extended Strong’s number, with meanings free of HTML', () => {
    const lex = parseBriefLexicon(`${F}/tbesh.txt`, 'TBESH');
    expect(lex.get('H7307G')!.gloss).toBe('spirit');
    expect(lex.get('H0430G')!.gloss).toBe('God');
    expect(lex.get('H7307G')!.meaning).not.toMatch(/<br/i);
  });

  it('expands grammar codes', () => {
    const m = parseMorphCodes(`${F}/tehmc.txt`);
    expect(m.get('HVqp3ms')).toMatch(/Stem=Qal/);
  });
});

describe('Phase 3 sources: Vulgate and English texts', () => {
  it('drops the Vulgate’s Glossa Ordinaria footnotes', () => {
    const v = readUsfmVerses(`${F}/vulgate`);
    const text = v.get('GEN.1.2')!;
    expect(text).toMatch(/^Terra autem erat inanis/);
    expect(text).not.toMatch(/BEDA|\\f/);
  });

  it('removes word markup, including nested small capitals', () => {
    const v = readUsfmVerses(`${F}/kjv`);
    expect(v.get('JON.1.17')).toMatch(/the LORD had prepared a great fish/);
    expect(v.get('JON.2.1')).not.toMatch(/strong=|\\/);
  });
});

describe('Phase 3 sources: Septuagint', () => {
  const verses = readLxxTei(`${F}/lxx-tei-gen.xml`);
  const tokens = lxxTokens(verses, readLxxLemmas(`${F}/lxx-gen.txt`), 'Gen', 'LXX Gen');

  it('keeps the words after a marginal note (the analysed file drops them)', () => {
    expect(verses.get('1.2')).toMatch(/ἀόρατος/);
    expect(verses.get('1.2')).not.toMatch(/marginal|\bA\b/);
    const v2 = tokens.filter((t) => t.ref === 'Gen.1.2');
    expect(v2.length).toBeGreaterThan(15);
  });

  it('adds Morpheus lemmas where a form matches, and never invents one', () => {
    const v2 = tokens.filter((t) => t.ref === 'Gen.1.2');
    expect(v2.find((t) => t.text === 'θεοῦ')!.lemma).toBe('θεός');
    expect(v2.find((t) => t.text === 'ἀόρατος')!.lemma).toBeUndefined();
  });
});

describe('Phase 3 sources: Lewis & Short', () => {
  it('reads senses with their Perseus ids, citations removed', () => {
    const ls = parseLewisShort(`${F}/lewis-short.xml`);
    const m = ls.get('misericordia')!;
    expect(m.orth).toMatch(/ĭ/);
    expect(m.senses[0]!.id).toMatch(/^n\d+\.0$/);
    expect(m.senses[0]!.text).toMatch(/compassion, mercy/);
    expect(JSON.stringify(m)).not.toMatch(/<bibl|<author/);
  });
});
