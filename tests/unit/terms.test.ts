import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { plainGrammar } from '../../scripts/build-terms';
import { parseTahot } from '../../scripts/terms/stepbible';
import { transliterateGreek, transliterateHebrew } from '@/lib/translit';
import { TermFileSchema, visibleTerms, type BuiltTerm } from '@/lib/terms';
import { verseText, type SectionFile } from '@/lib/types';

const OUT = 'public/data/terms';
const built = fs.existsSync(OUT)
  ? fs
      .readdirSync(OUT)
      .flatMap(
        (f) =>
          (JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) as { terms: BuiltTerm[] }).terms,
      )
  : [];
const section = (id: string) =>
  JSON.parse(fs.readFileSync(`public/data/sections/${id}.json`, 'utf8')) as SectionFile;

describe('key terms: built data', () => {
  it('has a built deck for every authored term, and nothing else', () => {
    const authored = fs
      .readdirSync('content/terms')
      .flatMap(
        (f) =>
          TermFileSchema.parse(JSON.parse(fs.readFileSync(`content/terms/${f}`, 'utf8'))).terms,
      )
      .map((t) => t.id)
      .sort();
    expect(built.map((t) => t.id).sort()).toEqual(authored);
  });

  it('marks words that are exactly the WEBC text at that place (never typed)', () => {
    for (const t of built) {
      const v = section(t.sectionId).verses.find((x) => x.ref === t.span.verse)!;
      expect(verseText(v).slice(t.span.start, t.span.end), t.id).toBe(t.span.text);
    }
  });

  it('fills every placeholder and cites every original word', () => {
    for (const t of built) {
      expect(JSON.stringify(t.cards), t.id).not.toMatch(
        /\{(original|grammar|lxx|vulgate|webc|drc|kjv|brenton)\}/,
      );
      const original = t.cards.find((c) => c.kind === 'original');
      expect(original, t.id).toBeTruthy();
      if (original?.kind === 'original')
        for (const w of original.words) {
          expect(w.cite, t.id).toMatch(/TAHOT|TAGNT/);
          expect(w.translit, t.id).toMatch(/^[a-zāēīōūḥṭʾʿ\s'-]+$/i);
        }
      expect(t.citations.length, t.id).toBeGreaterThan(0);
    }
  });

  it('a verified term’s explanation cites its sources', () => {
    for (const t of built.filter((x) => x.status === 'verified')) {
      const debate = t.cards.find((c) => c.kind === 'debate');
      if (debate?.kind === 'debate') expect(debate.sources.length, t.id).toBeGreaterThan(0);
    }
  });
});

describe('key terms: drafts', () => {
  const fake = (status: BuiltTerm['status']) => ({ status }) as BuiltTerm;
  it('are hidden on the production site and shown elsewhere', () => {
    const list = [fake('draft'), fake('verified'), fake('candidate')];
    expect(visibleTerms(list, 'production').map((t) => t.status)).toEqual(['verified']);
    expect(visibleTerms(list, 'preview')).toHaveLength(3);
    expect(visibleTerms(list, undefined)).toHaveLength(3);
  });
});

describe('transliteration (generated, never typed)', () => {
  const tokens = parseTahot('tests/fixtures/terms/tahot.txt');

  it('turns every Hebrew word into Latin letters only', () => {
    for (const t of tokens) {
      const out = transliterateHebrew(t.text);
      expect(out, t.text).not.toMatch(/[֐-׿]/);
      expect(out.length, t.text).toBeGreaterThan(0);
    }
  });

  it('keeps one consonant sound per Hebrew consonant (roughly)', () => {
    for (const t of tokens) {
      const letters = t.text.replace(/[^א-ת]/g, '').length;
      const out = transliterateHebrew(t.text).replace(/sh|ts|kh|[aeiou-]/g, 'X').length;
      expect(Math.abs(out - letters), t.text).toBeLessThanOrEqual(letters);
    }
  });

  it('turns Greek into Latin letters, with rough breathing as h', () => {
    const words = fs
      .readFileSync('tests/fixtures/terms/tagnt.txt', 'utf8')
      .split('\n')
      .slice(1)
      .map((l) => (l.split('\t')[1] ?? '').replace(/\s*\(.*$/, ''))
      .filter(Boolean);
    for (const w of words)
      expect(transliterateGreek(w), w).not.toMatch(/[\u0370-\u03FF\u1F00-\u1FFF]/);
    const rough = words.filter((w) => w.normalize('NFD').includes('\u0314'));
    expect(rough.length).toBeGreaterThan(0);
    for (const w of rough) expect(transliterateGreek(w), w).toMatch(/^h/);
  });
});

describe('grammar in plain words', () => {
  it('drops the code table’s labels', () => {
    expect(plainGrammar('Function=Pronoun ; Form=Personal ; Person=Third; Gender=Masculine')).toBe(
      'Pronoun, personal, third person, masculine',
    );
    expect(plainGrammar('Function=Verb ; Stem=Qal (hence Action=Simple; Voice=Active)')).toMatch(
      /^Verb, qal \(hence simple/,
    );
  });
});
