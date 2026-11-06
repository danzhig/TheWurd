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
