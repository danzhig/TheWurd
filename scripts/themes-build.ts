/**
 * pnpm themes:build — choose each sub-theme's passages from the theme datasets (Phase 6, P6.2) and
 * write content/themes/themes.json plus one review document per theme, docs/themes/<id>-passages.md.
 *
 * The rule is fixed so the choice is reproducible and reviewable, never picked from memory:
 * - every candidate comes from a source the approved taxonomy names, and keeps its dataset rows;
 * - its score is OpenBible's vote score scaled to 0–10 within its topic, plus NAVE_WEIGHT for each
 *   Nave row that cites it; candidates starting on the same verse are merged;
 * - a sub-theme takes the best PER_SUBTHEME, at most one per section and MAX_PER_BOOK per book;
 *   ties go to canonical order;
 * - a reference that falls outside every built section is listed for review, never placed.
 *
 * Approvals: the owner pre-approved the passages of every theme (2026-11-12). Each theme records
 * its approval with a fingerprint of its passages; `pnpm content:build` refuses an edited theme.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { readNave } from './themes/naves';
import { readOpenBible, type OpenBibleRow } from './themes/openbible';
import {
  candidatesFor,
  readSectionIndex,
  readTaxonomy,
  sectionFor,
  themesFingerprint,
  THEMES_FILE,
  type ThemesFile,
  type ThemePassage,
} from './themes/taxonomy';

const PER_SUBTHEME = 12;
const MAX_PER_BOOK = 3;
const NAVE_WEIGHT = 4;
const APPROVAL = { by: 'the owner', date: '2026-11-12' };

const tax = readTaxonomy();
if (tax.status !== 'approved') throw new Error('The taxonomy is not approved yet.');
const nave = readNave(path.join(RAW_DIR, 'naves'));
const obByTopic = new Map<string, OpenBibleRow[]>();
for (const r of readOpenBible(path.join(RAW_DIR, 'openbible-topics')))
  obByTopic.set(r.topic, [...(obByTopic.get(r.topic) ?? []), r]);
const index = readSectionIndex();
const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
  books: { id: string; name: string }[];
  sections: { id: string; bookId: string; title: string }[];
};
const bookOrder = new Map(manifest.books.map((b, i) => [b.id, i]));
const sectionInfo = new Map(manifest.sections.map((s) => [s.id, s]));
const startKey = (ref: string) => {
  const first = ref.split('-')[0]!;
  return first.split('.').length === 2 ? `${first}.1` : first;
};
const canon = (ref: string) => {
  const [b, c, v] = startKey(ref).split('.');
  return (bookOrder.get(b!) ?? 999) * 1e6 + Number(c) * 1e3 + Number(v);
};

const out: ThemesFile = {
  $comment:
    'Phase 6 passages (docs/PLAN.md §16), written by pnpm themes:build from the approved taxonomy and the pinned datasets. Each passage cites its dataset rows; refs are OSIS in WEBC (English) numbering. Each theme carries the owner’s approval and a fingerprint of its passages.',
  themes: [],
};

for (const t of tax.themes) {
  const doc: string[] = [
    `# ${t.title}: passages`,
    '',
    `**Status: approved by ${APPROVAL.by} on ${APPROVAL.date}** (the owner approved every theme’s passages in advance; this record lists them so any can still be changed).`,
    '',
    `${t.description}`,
    '',
    `Chosen by \`pnpm themes:build\`: OpenBible’s vote score (0–10 within its topic) plus ${NAVE_WEIGHT} per Nave row citing the passage; the best ${PER_SUBTHEME} per sub-theme, at most one per section and ${MAX_PER_BOOK} per book. References are WEBC (English) numbering; titles are the sections’ own.`,
    '',
  ];
  const passagesOfTheme: { sub: string; p: ThemePassage }[] = [];
  for (const s of t.subthemes) {
    const merged = new Map<
      string,
      { ref: string; score: number; best: number; rows: ThemePassage['sources'] }
    >();
    for (const src of s.sources) {
      const cands = candidatesFor(src, nave, obByTopic);
      const max = Math.max(1, ...cands.map((c) => c.score ?? 0));
      for (const c of cands) {
        const pts = c.source.dataset === 'openbible' ? ((c.score ?? 0) / max) * 10 : NAVE_WEIGHT;
        const k = startKey(c.ref);
        const m = merged.get(k) ?? { ref: c.ref, score: 0, best: -1, rows: [] };
        m.score += pts;
        if (pts > m.best) {
          m.best = pts;
          m.ref = c.ref;
        }
        if (!m.rows.some((r) => r.row === c.source.row)) m.rows.push(c.source);
        merged.set(k, m);
      }
    }
    const ranked = [...merged.values()].sort(
      (a, z) => z.score - a.score || canon(a.ref) - canon(z.ref),
    );
    const usedSections = new Set<string>();
    const perBook = new Map<string, number>();
    const chosen: ThemePassage[] = [];
    const unplaced: string[] = [];
    for (const c of ranked) {
      if (chosen.length >= PER_SUBTHEME) break;
      const sectionId = sectionFor(c.ref, index);
      if (!sectionId) {
        unplaced.push(`${c.ref} (${c.rows.map((r) => r.row).join(', ')})`);
        continue;
      }
      const book = c.ref.split('.')[0]!;
      if (usedSections.has(sectionId) || (perBook.get(book) ?? 0) >= MAX_PER_BOOK) continue;
      usedSections.add(sectionId);
      perBook.set(book, (perBook.get(book) ?? 0) + 1);
      chosen.push({
        ref: c.ref,
        sectionId,
        sources: c.rows,
        score: Math.round(c.score * 10) / 10,
        status: 'approved',
      });
    }
    chosen.sort((a, z) => canon(a.ref) - canon(z.ref));
    passagesOfTheme.push(...chosen.map((p) => ({ sub: s.id, p })));
    doc.push(`## ${s.title} (\`${s.id}\`)`, '', s.description, '');
    doc.push('| Passage | Section | Score | Sources |', '| --- | --- | --- | --- |');
    for (const p of chosen) {
      const sec = sectionInfo.get(p.sectionId)!;
      const lib = index.library.has(p.sectionId) ? ' · library' : '';
      const rows = p.sources.map((r) => `\`${r.row}\``).join(', ');
      doc.push(`| ${p.ref} | ${sec.title} (\`${p.sectionId}\`${lib}) | ${p.score} | ${rows} |`);
    }
    if (unplaced.length)
      doc.push('', `Not placed (no built section holds the first verse): ${unplaced.join('; ')}.`);
    doc.push('');
  }
  const subthemes = t.subthemes.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    passages: passagesOfTheme.filter((x) => x.sub === s.id).map((x) => x.p),
  }));
  out.themes.push({
    id: t.id,
    title: t.title,
    description: t.description,
    subthemes,
    approval: { ...APPROVAL, fingerprint: themesFingerprint(subthemes) },
  });
  fs.writeFileSync(`docs/themes/${t.id}-passages.md`, doc.join('\n'));
}

fs.writeFileSync(THEMES_FILE, JSON.stringify(out, null, 2) + '\n');
const n = out.themes.reduce(
  (k, t) => k + t.subthemes.reduce((j, s) => j + s.passages.length, 0),
  0,
);
console.log(
  `wrote ${path.relative(process.cwd(), THEMES_FILE)}: ${out.themes.length} themes, ${n} passages`,
);
