/**
 * The library (PLAN §15, Phase 5): sections for the books outside the path, kept in
 * content/plan/library.json and run through the same resolution and checks as the path.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LibrarySchema, type Library, type PlanBook, type ReadingPlan } from '../lib/types';
import { CANON, CANON_BY_ID } from './lib/canon';
import { CONTENT_DIR } from './lib/paths';

export const LIBRARY_FILE = path.join(CONTENT_DIR, 'plan', 'library.json');

export function readLibrary(file = LIBRARY_FILE): Library {
  if (!fs.existsSync(file)) return { books: [] };
  return LibrarySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Fingerprint of a book's sections: ids, titles and ranges, in order. */
export function libraryFingerprint(book: Library['books'][number]): string {
  const sections = book.sections.map(({ id, title, range, status }) => ({
    id,
    title,
    range,
    status,
  }));
  return createHash('sha256').update(JSON.stringify(sections)).digest('hex').slice(0, 16);
}

/**
 * Every library book must be off the path, appear once, and carry an approval whose fingerprint
 * matches its sections; section ids must be unique across the plan and the library.
 */
export function checkLibrary(lib: Library, plan: ReadingPlan): string[] {
  const errors: string[] = [];
  const onPath = new Set(plan.books.map((b) => b.id));
  const ids = new Set(plan.books.flatMap((b) => b.sections.map((s) => s.id)));
  const seen = new Set<string>();
  for (const b of lib.books) {
    if (!CANON_BY_ID.has(b.id)) errors.push(`library.json: unknown book ${b.id}`);
    if (onPath.has(b.id)) errors.push(`library.json: ${b.id} is on the path, not in the library`);
    if (seen.has(b.id)) errors.push(`library.json: ${b.id} appears twice`);
    seen.add(b.id);
    for (const s of b.sections) {
      if (ids.has(s.id)) errors.push(`library.json: section id ${s.id} is already used`);
      ids.add(s.id);
      if (s.status !== 'read') errors.push(`library.json: ${s.id} must have status "read"`);
    }
    const fp = libraryFingerprint(b);
    if (!b.approval) errors.push(`library.json ${b.id}: not approved (fingerprint ${fp})`);
    else if (b.approval.fingerprint !== fp)
      errors.push(
        `library.json ${b.id}: changed since it was approved on ${b.approval.date} (approved ${b.approval.fingerprint}, now ${fp}); needs re-approval`,
      );
  }
  return errors;
}

/** Library books in the shape the resolver and emitter use (name from the canon, no setting). */
export function libraryBooks(lib: Library, taglines: Record<string, string>): PlanBook[] {
  return lib.books.map((b) => ({
    id: b.id,
    name: CANON_BY_ID.get(b.id)!.name,
    setting: '',
    tagline: taglines[b.id] ?? '',
    sections: b.sections,
  }));
}

/** Off-path books with no approved sections yet, in canonical order (for the report). */
export function unsectioned(lib: Library, plan: ReadingPlan): string[] {
  const done = new Set([...plan.books.map((b) => b.id), ...lib.books.map((b) => b.id)]);
  return CANON.filter((c) => !done.has(c.id)).map((c) => c.id);
}
