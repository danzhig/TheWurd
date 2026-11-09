import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutStations } from '@/components/book-map/layout';
import { ReadingPlanSchema } from '@/lib/types';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

describe.each([
  ['phone', 390],
  ['desktop', 1440],
  ['narrow desktop', 760],
])('book map layout (%s)', (_name, width) => {
  for (const book of plan.books) {
    it(`${book.id}: every section placed once, on screen, without collisions`, () => {
      const l = layoutStations(book.sections, width);
      expect(l.stations.map((s) => s.id)).toEqual(book.sections.map((s) => s.id));
      for (const s of l.stations) {
        expect(s.x, s.id).toBeGreaterThan(0);
        expect(s.x, s.id).toBeLessThan(width);
        expect(s.y, s.id).toBeGreaterThan(0);
        expect(s.y, s.id).toBeLessThan(l.height);
      }
      for (let i = 0; i < l.stations.length; i++) {
        for (let j = i + 1; j < l.stations.length; j++) {
          const a = l.stations[i]!;
          const b = l.stations[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} vs ${b.id}`).toBeGreaterThan(40);
        }
      }
      const optional = book.sections.filter((s) => s.status === 'optional').map((s) => s.id);
      for (const s of l.stations) expect(!!s.branchFrom, s.id).toBe(optional.includes(s.id));
      expect(l.path.startsWith('M')).toBe(true);
    });
  }
});

describe('layout modes', () => {
  it('meanders down the page on a phone and runs a serpentine on desktop', () => {
    const gen = plan.books.find((b) => b.id === 'Gen')!.sections;
    const phone = layoutStations(gen, 390);
    expect(phone.mode).toBe('meander');
    const ys = phone.stations.map((s) => s.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys); // always downward
    const desk = layoutStations(gen, 1440);
    expect(desk.mode).toBe('serpentine');
    expect(desk.path).toContain(' A '); // turns at the row ends
    // Second row runs right to left.
    const row1 = desk.stations.filter((s) => s.y === desk.stations[0]!.y);
    const row2 = desk.stations.filter(
      (s) => s.y > desk.stations[0]!.y && s.y < desk.stations[0]!.y + 250,
    );
    expect(row2[0]!.x).toBeCloseTo(row1.at(-1)!.x);
  });
});
