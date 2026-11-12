/** The site's view of the library (P5.3): every book has sections, the path is untouched. */
import { describe, expect, it } from 'vitest';
import { buildSequence } from '@/lib/path';
import { getFullManifest, getManifest, librarySequence } from '@/lib/data';

describe('library on the site', () => {
  const full = getFullManifest();
  const path = getManifest();

  it('every book of the Bible has sections to read, path or library', () => {
    const withSections = new Set(full.sections.map((s) => s.bookId));
    for (const b of full.books) expect(withSections.has(b.id), b.id).toBe(true);
  });

  it('the library sequence holds every library section once, in canonical book order', () => {
    const seq = librarySequence();
    expect(seq.map((s) => s.id).sort()).toEqual(
      full.sections
        .filter((s) => s.library)
        .map((s) => s.id)
        .sort(),
    );
    const bookOrder = full.books.map((b) => b.id);
    const idx = seq.map((s) => bookOrder.indexOf(s.bookId));
    expect(idx).toEqual([...idx].sort((a, z) => a - z));
  });

  it('library sections never join the path', () => {
    expect(path.sections.some((s) => s.library)).toBe(false);
    const lib = new Set(librarySequence().map((s) => s.id));
    expect(buildSequence(path).some((i) => lib.has(i.id))).toBe(false);
  });
});
