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

let manifest: Manifest | null = null;
/**
 * The manifest as the site uses it. Library sections (Phase 5) are left out until the site shows
 * the library (P5.3); they are built and checked in `public/data` already.
 */
export function getManifest(): Manifest {
  if (!manifest) {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8')) as Manifest;
    manifest = { ...raw, sections: raw.sections.filter((s) => !s.library) };
  }
  return manifest;
}

export function getSection(id: string): SectionFile {
  return JSON.parse(
    fs.readFileSync(path.join(DATA, 'sections', `${id}.json`), 'utf8'),
  ) as SectionFile;
}
