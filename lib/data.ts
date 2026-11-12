/** Build-time access to public/data (server components only). */
import fs from 'node:fs';
import path from 'node:path';
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

let full: Manifest | null = null;
let manifest: Manifest | null = null;

/** Every section, the path's and the library's (Phase 5). */
export function getFullManifest(): Manifest {
  full ??= JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8')) as Manifest;
  return full;
}

/**
 * The path as the site uses it: the manifest without library sections, which never join the path
 * (its sequence, progress, the spiral's reading times or the timeline).
 */
export function getManifest(): Manifest {
  manifest ??= {
    ...getFullManifest(),
    sections: getFullManifest().sections.filter((s) => !s.library),
  };
  return manifest;
}

/**
 * The library in reading order: books in canonical order (as the manifest lists them), each
 * book's sections in order.
 */
export function librarySequence(): SectionIndexEntry[] {
  const m = getFullManifest();
  return m.books
    .filter((b) => b.library)
    .flatMap((b) =>
      m.sections.filter((s) => s.library && s.bookId === b.id).sort((a, z) => a.order - z.order),
    );
}

export function getSection(id: string): SectionFile {
  return JSON.parse(
    fs.readFileSync(path.join(DATA, 'sections', `${id}.json`), 'utf8'),
  ) as SectionFile;
}
