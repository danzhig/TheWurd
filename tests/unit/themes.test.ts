/** Phase 6 sources and taxonomy: parsers on excerpts, and the shape of the proposed taxonomy. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEntry } from '@/scripts/themes/naves';
import { parseOpenBible } from '@/scripts/themes/openbible';
import { readTaxonomy } from '@/scripts/themes/taxonomy';

describe("Nave's entries", () => {
  const rows = parseEntry('MERCY', fs.readFileSync('tests/fixtures/themes/nave-MERCY.xml', 'utf8'));

  it('splits an entry into cited rows of labels, references and cross-references', () => {
    expect(rows.map((r) => r.id)).toEqual(rows.map((_, i) => `Nave:MERCY#${i + 1}`));
    const general = rows[0]!;
    expect(general.refs[0]).toBe('2Sam.22.26');
    expect(general.refs.length).toBeGreaterThan(20);
    expect(rows.find((r) => r.see.includes('KINDNESS'))).toBeTruthy();
    // List items keep their ranges and their own words.
    const range = rows.find((r) => r.refs.includes('Gen.39.21-Gen.39.23'))!;
    expect(range.label.length).toBeGreaterThan(0);
    expect(range.label).not.toMatch(/[<>]/);
  });
});

describe('OpenBible topics', () => {
  it('reads rows with their line numbers as citations, skipping the header', () => {
    const rows = parseOpenBible(
      fs.readFileSync('tests/fixtures/themes/openbible-head.txt', 'utf8'),
    );
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ id: 'OpenBible:L2', ref: 'Exod.20.1-Exod.20.26' });
    expect(rows[0]!.score).toBeGreaterThan(0);
  });
});

describe('the taxonomy', () => {
  const tax = readTaxonomy();

  it('has 8–10 themes, each with sub-themes, all described, ids unique', () => {
    expect(tax.themes.length).toBeGreaterThanOrEqual(8);
    expect(tax.themes.length).toBeLessThanOrEqual(10);
    const ids = tax.themes.flatMap((t) => [t.id, ...t.subthemes.map((s) => s.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of tax.themes) {
      expect(t.description.length, t.id).toBeGreaterThan(20);
      expect(t.subthemes.length, t.id).toBeGreaterThanOrEqual(3);
      for (const s of t.subthemes) {
        expect(s.id.startsWith(`${t.id}-`)).toBe(true);
        expect(s.description.length, s.id).toBeGreaterThan(10);
      }
    }
  });

  it('is approved only with a named approval', () => {
    expect(tax.status === 'approved').toBe(tax.approval !== null);
  });
});
