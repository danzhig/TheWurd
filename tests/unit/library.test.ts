import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkLibrary,
  libraryBooks,
  libraryFingerprint,
  readLibrary,
  unsectioned,
} from '../../scripts/library';
import { ReadingPlanSchema, type Library } from '@/lib/types';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

const book = (over: Partial<Library['books'][number]> = {}): Library['books'][number] => ({
  id: 'Lev',
  sections: [
    { id: 'lev-01', title: 'Offerings', range: '1-7', status: 'read' },
    { id: 'lev-02', title: 'Holiness', range: '8-27', status: 'read' },
  ],
  ...over,
});
const approved = (b = book()) => ({
  ...b,
  approval: { by: 'owner', date: '2026-11-10', fingerprint: libraryFingerprint(b) },
});

describe('library (Phase 5)', () => {
  it('reads the committed library, which passes its own checks', () => {
    const lib = readLibrary();
    expect(checkLibrary(lib, plan)).toEqual([]);
    expect(unsectioned(lib, plan).length + lib.books.length).toBe(49);
  });

  it('needs an approval whose fingerprint matches the sections', () => {
    expect(checkLibrary({ books: [book()] }, plan)[0]).toMatch(/Lev: not approved \(fingerprint/);
    expect(checkLibrary({ books: [approved()] }, plan)).toEqual([]);
    const edited = approved();
    edited.sections[1]!.range = '8-26';
    expect(checkLibrary({ books: [edited] }, plan)[0]).toMatch(/changed since it was approved/);
  });

  it('refuses path books, repeats, reused ids and statuses other than read', () => {
    const errs = checkLibrary(
      {
        books: [
          approved(book({ id: 'Gen' })),
          approved(),
          approved(),
          approved(
            book({
              id: 'Ps',
              sections: [
                { id: 'gen-01', title: 'x', range: '1', status: 'read' },
                { id: 'ps-002', title: 'y', range: '2', status: 'skim' },
              ],
            }),
          ),
        ],
      },
      plan,
    ).join('\n');
    expect(errs).toMatch(/Gen is on the path/);
    expect(errs).toMatch(/Lev appears twice/);
    expect(errs).toMatch(/section id gen-01 is already used/);
    expect(errs).toMatch(/ps-002 must have status "read"/);
  });

  it('turns library books into resolvable books, named from the canon', () => {
    const [b] = libraryBooks({ books: [approved()] }, { Lev: 'Sacrifice and holiness' });
    expect(b).toMatchObject({ id: 'Lev', name: 'Leviticus', tagline: 'Sacrifice and holiness' });
    expect(b!.sections).toHaveLength(2);
  });

  it('fingerprints only what decides placement', () => {
    const a = book();
    const b = book();
    b.sections[0]!.summary = 'a note';
    expect(libraryFingerprint(a)).toBe(libraryFingerprint(b));
    b.sections[0]!.title = 'Sacrifices';
    expect(libraryFingerprint(a)).not.toBe(libraryFingerprint(b));
  });
});
