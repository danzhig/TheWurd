/** Build-time access to public/data (server components only). */
import fs from 'node:fs';
import path from 'node:path';
import { visibleTerms, type BuiltTerm } from './terms';
import type { Book, Bridge, PlanStep, SectionFile, SectionIndexEntry } from './types';

const DATA = path.join(process.cwd(), 'public/data');

export interface Manifest {
  planVersion: string;
  books: Book[];
  steps: PlanStep[];
  sections: SectionIndexEntry[];
  bridges: Bridge[];
  sources: PublicSource[];
}

/** A pinned source as published in the manifest (credited on /sources). */
export interface PublicSource {
  id: string;
  name: string;
  layer: string;
  homepage: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  usedFor: string;
  version: string;
}

let manifest: Manifest | null = null;
export function getManifest(): Manifest {
  manifest ??= JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8')) as Manifest;
  return manifest;
}

export function getSection(id: string): SectionFile {
  return JSON.parse(
    fs.readFileSync(path.join(DATA, 'sections', `${id}.json`), 'utf8'),
  ) as SectionFile;
}

/** Built key terms for a section, drafts included except on the production site. */
export function getTerms(sectionId: string): BuiltTerm[] {
  const file = path.join(DATA, 'terms', `${sectionId}.json`);
  if (!fs.existsSync(file)) return [];
  const { terms } = JSON.parse(fs.readFileSync(file, 'utf8')) as { terms: BuiltTerm[] };
  return visibleTerms(terms);
}

/** Every built key term, all statuses (for /review). */
export function getAllTerms(): BuiltTerm[] {
  const dir = path.join(DATA, 'terms');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap(
      (f) =>
        (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { terms: BuiltTerm[] }).terms,
    );
}
