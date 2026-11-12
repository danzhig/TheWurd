/**
 * Theme passages in the content build (Phase 6, P6.2): check content/themes/themes.json against the
 * built sections and write public/data/themes.json with approved passages only. Each passage gets
 * its reference for display, its section's title, and an excerpt cut from the built WEBC text of
 * its first verse (never typed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { verseText, type SectionFile } from '../../lib/types';
import { CANON_BY_ID } from '../lib/canon';
import { readThemes, themesFingerprint } from './taxonomy';

export interface PublicThemePassage {
  ref: string; // OSIS, WEBC numbering
  display: string; // "Luke 6:36", "Psalms 56:3–4"
  sectionId: string;
  sectionTitle: string;
  bookId: string;
  library: boolean;
  excerpt: string;
  sources: { dataset: 'naves' | 'openbible'; row: string }[];
}
export interface PublicThemes {
  themes: {
    id: string;
    title: string;
    description: string;
    subthemes: { id: string; title: string; description: string; passages: PublicThemePassage[] }[];
  }[];
}

const EXCERPT_CHARS = 160;

/** The first verse's text, cut at a word boundary. */
export function excerpt(text: string, max = EXCERPT_CHARS): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[\s,;:]+$/, '')}…`;
}

/** "Luke.6.36" → "Luke 6:36"; ranges within a chapter "6:36–38", across chapters "6:36–7:2". */
export function displayRef(ref: string, bookName: string): string {
  const [a, b] = ref.split('-') as [string, string | undefined];
  const [, c1, v1] = a.split('.');
  if (!v1) return `${bookName} ${c1}`;
  if (!b) return `${bookName} ${c1}:${v1}`;
  const [, c2, v2] = b.split('.');
  return c2 === c1 ? `${bookName} ${c1}:${v1}–${v2}` : `${bookName} ${c1}:${v1}–${c2}:${v2}`;
}

export function buildThemes(
  sectionFiles: SectionFile[],
  library: Set<string>,
  themesFile?: string,
): { data: PublicThemes | null; errors: string[] } {
  const file = readThemes(themesFile);
  if (!file) return { data: null, errors: [] };
  const errors: string[] = [];
  const bySection = new Map(sectionFiles.map((s) => [s.id, s]));
  const verseSection = new Map<string, string>();
  for (const s of sectionFiles)
    for (const v of s.verses) {
      const whole = v.ref.split('!')[0]!;
      if (!verseSection.has(whole)) verseSection.set(whole, s.id);
    }
  const first = (ref: string) => {
    const f = ref.split('-')[0]!;
    return f.split('.').length === 2 ? `${f}.1` : f;
  };
  const data: PublicThemes = { themes: [] };
  for (const t of file.themes) {
    const approved = t.approval && t.approval.fingerprint === themesFingerprint(t.subthemes);
    if (t.approval && !approved)
      errors.push(
        `themes.json ${t.id}: edited since its approval (fingerprint ${themesFingerprint(t.subthemes)})`,
      );
    const subthemes = [];
    for (const s of t.subthemes) {
      const passages: PublicThemePassage[] = [];
      for (const p of s.passages) {
        const where = `themes.json ${s.id} ${p.ref}`;
        const sec = bySection.get(p.sectionId);
        if (!sec) {
          errors.push(`${where}: no section ${p.sectionId}`);
          continue;
        }
        if (verseSection.get(first(p.ref)) !== p.sectionId)
          errors.push(`${where}: its first verse is not in ${p.sectionId}`);
        const end = p.ref.split('-')[1];
        if (end && !verseSection.has(end)) errors.push(`${where}: no verse ${end} in WEBC`);
        if (!p.sources.length) errors.push(`${where}: cites no dataset row`);
        // Drafts, and anything in a theme without a valid approval, stay out of the site.
        if (p.status !== 'approved' || !approved) continue;
        const v = sec.verses.find((x) => x.ref.split('!')[0] === first(p.ref));
        passages.push({
          ref: p.ref,
          // The book's own name, not the plan's label for the part it reads ("Daniel 1–6, 13–14").
          display: displayRef(p.ref, CANON_BY_ID.get(sec.bookId)?.name ?? sec.bookName),
          sectionId: p.sectionId,
          sectionTitle: sec.title,
          bookId: sec.bookId,
          library: library.has(p.sectionId),
          excerpt: v ? excerpt(verseText(v)) : '',
          sources: p.sources,
        });
      }
      subthemes.push({ id: s.id, title: s.title, description: s.description, passages });
    }
    data.themes.push({ id: t.id, title: t.title, description: t.description, subthemes });
  }
  return { data, errors };
}

export function writeThemes(dir: string, data: PublicThemes): void {
  fs.writeFileSync(path.join(dir, 'themes.json'), JSON.stringify(data) + '\n');
}
