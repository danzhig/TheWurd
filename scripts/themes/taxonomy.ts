/**
 * The Phase 6 taxonomy (content/themes/taxonomy.json) and the link from dataset references to
 * built sections. Sources are `nave:KEY` (every row of a Nave entry), `nave:KEY#n` (one row) or
 * `openbible:topic` (every passage OpenBible lists for that topic).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { SectionFile } from '../../lib/types';
import type { NaveEntry } from './naves';
import type { OpenBibleRow } from './openbible';

export const TAXONOMY_FILE = path.join(process.cwd(), 'content/themes/taxonomy.json');

const Source = z.string().regex(/^(nave:[^#]+(#\d+)?|openbible:.+)$/);
export const TaxonomySchema = z.object({
  $comment: z.string(),
  status: z.enum(['proposed', 'approved']),
  approval: z.object({ by: z.string(), date: z.string() }).nullable(),
  themes: z.array(
    z.object({
      id: z.string().regex(/^[a-z]+$/),
      title: z.string(),
      description: z.string(),
      subthemes: z.array(
        z.object({
          id: z.string().regex(/^[a-z]+-[a-z]+$/),
          title: z.string(),
          description: z.string(),
          sources: z.array(Source).min(1),
        }),
      ),
    }),
  ),
});
export type Taxonomy = z.infer<typeof TaxonomySchema>;

export function readTaxonomy(file = TAXONOMY_FILE): Taxonomy {
  return TaxonomySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** One candidate: a dataset row and the OSIS reference it gives. */
export interface Candidate {
  ref: string;
  source: { dataset: 'naves' | 'openbible'; row: string };
  label?: string;
  score?: number;
}

/** Every candidate a source names; throws if the source names nothing in the data. */
export function candidatesFor(
  source: string,
  nave: Map<string, NaveEntry>,
  obByTopic: Map<string, OpenBibleRow[]>,
): Candidate[] {
  if (source.startsWith('openbible:')) {
    const rows = obByTopic.get(source.slice('openbible:'.length));
    if (!rows?.length) throw new Error(`${source}: no such OpenBible topic`);
    return rows.map((r) => ({
      ref: r.ref,
      source: { dataset: 'openbible', row: r.id },
      score: r.score,
    }));
  }
  const [key, row] = source.slice('nave:'.length).split('#') as [string, string | undefined];
  const entry = nave.get(key);
  if (!entry) throw new Error(`${source}: no such Nave entry`);
  const rows = row ? entry.rows.filter((r) => r.id === `Nave:${key}#${row}`) : entry.rows;
  if (!rows.length) throw new Error(`${source}: no such Nave row`);
  const out = rows.flatMap((r) =>
    r.refs.map((ref) => ({
      ref,
      source: { dataset: 'naves' as const, row: r.id },
      label: r.label,
    })),
  );
  if (!out.length) throw new Error(`${source}: no references (only cross-references)`);
  return out;
}

/** WEBC verse reference (`Gen.12.1`) → the section that holds it, path or library. */
export interface SectionIndex {
  sectionOf: Map<string, string>;
  library: Set<string>;
}

export function readSectionIndex(dataDir = path.join(process.cwd(), 'public/data')): SectionIndex {
  const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'manifest.json'), 'utf8')) as {
    sections: { id: string; library?: boolean }[];
  };
  const sectionOf = new Map<string, string>();
  for (const s of manifest.sections) {
    const f = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'sections', `${s.id}.json`), 'utf8'),
    ) as SectionFile;
    for (const v of f.verses) {
      // Split verses (`Esth.1.1!a`) are found by their whole-verse reference too.
      const whole = v.ref.split('!')[0]!;
      if (!sectionOf.has(whole)) sectionOf.set(whole, s.id);
    }
  }
  return {
    sectionOf,
    library: new Set(manifest.sections.filter((s) => s.library).map((s) => s.id)),
  };
}

/**
 * The section holding a reference's first verse: OSIS `Book.c.v`, a range `Book.c.v-Book.c.v`, or a
 * whole chapter `Book.c` (its first verse).
 */
export function sectionFor(ref: string, index: SectionIndex): string | undefined {
  const first = ref.split('-')[0]!;
  return index.sectionOf.get(first.split('.').length === 2 ? `${first}.1` : first);
}

// ---------------------------------------------------------------------------------------------
// Passages (P6.2): content/themes/themes.json, written by `pnpm themes:build`.
// ---------------------------------------------------------------------------------------------

export const THEMES_FILE = path.join(process.cwd(), 'content/themes/themes.json');

const PassageSchema = z.object({
  /** OSIS, WEBC (English) numbering: a verse, a range or a whole chapter. */
  ref: z.string(),
  /** The built section holding the first verse (path or library). */
  sectionId: z.string(),
  sources: z.array(z.object({ dataset: z.enum(['naves', 'openbible']), row: z.string() })).min(1),
  score: z.number(),
  status: z.enum(['draft', 'approved']),
});
export type ThemePassage = z.infer<typeof PassageSchema>;

const SubthemeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  passages: z.array(PassageSchema),
});

export const ThemesFileSchema = z.object({
  $comment: z.string(),
  themes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      subthemes: z.array(SubthemeSchema),
      approval: z.object({ by: z.string(), date: z.string(), fingerprint: z.string() }).nullable(),
    }),
  ),
});
export type ThemesFile = z.infer<typeof ThemesFileSchema>;

export function readThemes(file = THEMES_FILE): ThemesFile | null {
  if (!fs.existsSync(file)) return null;
  return ThemesFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** A theme's approval covers exactly these sub-themes and passages (ids, refs, sections, statuses). */
export function themesFingerprint(subthemes: z.infer<typeof SubthemeSchema>[]): string {
  const canonical = subthemes.map((s) => [
    s.id,
    s.passages.map((p) => [p.ref, p.sectionId, p.status]),
  ]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}
