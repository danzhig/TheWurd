/** The Themes view's geometry (P6.3): constellations apart, stars inside them, flights between. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutThemes, starAt, STAGGER, type ThemeInput } from '@/components/vault/constellations';
import { GROUP_ORDER, vaultData } from '@/components/vault/data';
import { layoutVault } from '@/components/vault/layout';
import type { Point } from '@/components/vault/layout';
import { getManifest } from '@/lib/data';

const themes = JSON.parse(fs.readFileSync('public/data/themes.json', 'utf8')) as {
  themes: {
    id: string;
    subthemes: { id: string; passages: { ref: string; bookId: string; library: boolean }[] }[];
  }[];
};
const input: ThemeInput[] = themes.themes.map((t) => ({
  id: t.id,
  subthemes: t.subthemes.map((s) => ({
    id: s.id,
    passages: s.passages.map((p) => ({ key: p.ref, bookId: p.bookId, library: p.library })),
  })),
}));
const d = vaultData(getManifest());
const vault = layoutVault(d.path, d.bridges, d.satellites, d.offpath, GROUP_ORDER);
const homes = new Map<string, Point & { r: number }>();
for (const m of [...vault.medallions, ...vault.satellites])
  homes.set(m.id, { x: m.x, y: m.y, r: m.w / 2 });
for (const o of vault.offpath) homes.set(o.id, { x: o.x, y: o.y, r: o.size / 2 });
const l = layoutThemes(input, homes);

describe('constellations', () => {
  it('one per theme, apart from each other, inside the ceiling', () => {
    expect(l.constellations.map((c) => c.id)).toEqual(input.map((t) => t.id));
    for (const a of l.constellations)
      for (const b of l.constellations)
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r - 1);
    for (const c of l.constellations) expect(Math.hypot(c.x, c.y) + c.r).toBeLessThan(vault.radius);
  });

  it('a star for every passage, unique, inside its constellation', () => {
    const n = input.reduce((k, t) => k + t.subthemes.reduce((j, s) => j + s.passages.length, 0), 0);
    expect(l.stars).toHaveLength(n);
    expect(new Set(l.stars.map((s) => s.key)).size).toBe(n);
    const byId = new Map(l.constellations.map((c) => [c.id, c]));
    for (const s of l.stars) {
      const c = byId.get(s.themeId)!;
      expect(Math.hypot(s.x - c.x, s.y - c.y)).toBeLessThanOrEqual(c.r);
    }
  });

  it('every star starts inside its own book’s medallion', () => {
    for (const s of l.stars) {
      const h = homes.get(s.bookId)!;
      expect(h, s.bookId).toBeTruthy();
      expect(Math.hypot(s.home.x - h.x, s.home.y - h.y)).toBeLessThanOrEqual(h.r);
    }
  });

  it('flies from home to its place, and is between them mid-flight', () => {
    for (const s of l.stars) {
      expect(starAt(s, 0)).toEqual(s.home);
      const end = starAt(s, 1);
      expect(end.x).toBeCloseTo(s.x, 6);
      expect(end.y).toBeCloseTo(s.y, 6);
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThanOrEqual(STAGGER);
    }
    // Half-way, every star has left home and none has arrived.
    const mid = l.stars.map((s) => ({ s, at: starAt(s, 0.5) }));
    const moving = mid.filter(
      ({ s, at }) =>
        Math.hypot(at.x - s.home.x, at.y - s.home.y) > 1 && Math.hypot(at.x - s.x, at.y - s.y) > 1,
    );
    expect(moving.length / mid.length).toBeGreaterThan(0.95);
  });
});
