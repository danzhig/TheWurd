/**
 * Integrity checks over the committed public/data (docs/PLAN.md §16). They need no source
 * downloads, so they run in every CI job. Skipped until the pipeline has emitted data.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ReadingPlanSchema,
  verseText,
  type SectionFile,
  type SectionIndexEntry,
} from '@/lib/types';

const DATA = process.env.SAS_DATA_DIR ?? 'public/data';
const hasData = fs.existsSync(path.join(DATA, 'manifest.json'));
const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

describe.skipIf(!hasData)('public/data', () => {
  const manifest = hasData
    ? (JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8')) as {
        books: { id: string; inPlan: boolean; library?: boolean; verses: number }[];
        sections: SectionIndexEntry[];
      })
    : { books: [], sections: [] };
  const read = (id: string) =>
    JSON.parse(fs.readFileSync(path.join(DATA, 'sections', `${id}.json`), 'utf8')) as SectionFile;

  it('lists all 73 books and every plan section in plan order', () => {
    expect(manifest.books).toHaveLength(73);
    expect(manifest.sections.filter((s) => !s.library).map((s) => s.id)).toEqual(
      plan.books.flatMap((b) => b.sections.map((s) => s.id)),
    );
  });

  it('lists every approved library section, flagged, for books off the path (Phase 5)', () => {
    const lib = JSON.parse(fs.readFileSync('content/plan/library.json', 'utf8')) as {
      books: { id: string; sections: { id: string }[] }[];
    };
    const libSections = manifest.sections.filter((s) => s.library);
    expect(libSections.map((s) => s.id)).toEqual(
      lib.books.flatMap((b) => b.sections.map((s) => s.id)),
    );
    for (const b of lib.books) {
      const book = manifest.books.find((x) => x.id === b.id)!;
      expect(book.inPlan, b.id).toBe(false);
      expect(book.library, b.id).toBe(true);
      // Every WEBC verse of the book, exactly once.
      const refs = b.sections.flatMap((s) => read(s.id).verses.map((v) => v.ref));
      expect(new Set(refs).size, b.id).toBe(refs.length);
      expect(new Set(refs.map((r) => r.replace(/!.$/, ''))).size, b.id).toBe(book.verses);
    }
  });

  it('covers every WEBC verse of each plan book exactly once', () => {
    for (const b of plan.books) {
      const book = JSON.parse(fs.readFileSync(path.join(DATA, 'books', `${b.id}.json`), 'utf8'));
      const refs = b.sections.flatMap((s) => read(s.id).verses.map((v) => v.ref));
      expect(new Set(refs).size, b.id).toBe(refs.length);
      const whole = new Set(refs.map((r) => r.replace(/!.$/, '')));
      expect(whole.size, b.id).toBe(book.verses);
    }
  });

  it('keeps folds inside their section and notes at real verses', () => {
    for (const s of manifest.sections) {
      const sf = read(s.id);
      const refs = sf.verses.map((v) => v.ref);
      for (const f of sf.folds) {
        expect(refs, `${s.id} fold`).toContain(f.from);
        expect(refs, `${s.id} fold`).toContain(f.to);
      }
      for (const n of sf.notes) if (n.verseRef) expect(refs).toContain(n.verseRef);
    }
  });

  it('keeps word-of-Jesus spans and footnotes inside their verse', () => {
    for (const s of manifest.sections) {
      for (const v of read(s.id).verses) {
        const len = verseText(v).length;
        for (const [a, b] of v.wj ?? []) expect(a < b && b <= len, v.ref).toBe(true);
        for (const n of v.footnotes ?? []) expect(n.at <= len, v.ref).toBe(true);
      }
    }
  });
});
