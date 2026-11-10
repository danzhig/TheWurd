import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstMatch, stem, terms } from '@/components/search/match';
import type { SectionFile } from '@/lib/types';

const section = (id: string) =>
  JSON.parse(fs.readFileSync(`public/data/sections/${id}.json`, 'utf8')) as SectionFile;

describe('search: the verse a result opens at', () => {
  it('stems word endings roughly', () => {
    expect(['burning', 'kings', 'washed', 'is', 'moses'].map(stem)).toEqual([
      'burn',
      'king',
      'wash',
      'is',
      'mos',
    ]);
  });

  it('splits a query into words', () => {
    expect(terms('  Moses,  the  LORD! a ')).toEqual(['moses', 'the', 'lord']);
    expect(terms("Pharaoh's")).toEqual(['pharaohs']);
  });

  it('finds the first verse that names Zacchaeus', () => {
    const s = section('luke-12');
    const anchor = firstMatch(s.verses, 'Zacchaeus');
    expect(anchor).toMatch(/^v-19-\d+$/);
    // It is the first such verse in the section.
    const first = s.verses.find((v) => v.blocks.some((b) => /Zacchaeus/.test(b.text)))!;
    expect(anchor).toBe(`v-${first.c}-${first.v}${first.part ?? ''}`);
  });

  it('prefers a verse with every word, matches word starts, and returns null for no match', () => {
    const s = section('exod-02');
    const both = firstMatch(s.verses, 'burning bush')!;
    const v = s.verses.find((x) => `v-${x.c}-${x.v}${x.part ?? ''}` === both)!;
    const text = v.blocks
      .map((b) => b.text)
      .join(' ')
      .toLowerCase();
    expect(text).toMatch(/\bburn/);
    expect(text).toContain('bush');
    expect(firstMatch(s.verses, 'mose')).not.toBeNull();
    expect(firstMatch(s.verses, 'zzqx')).toBeNull();
  });
});
