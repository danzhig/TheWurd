import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const RAW_DIR = path.join(ROOT, 'sources/raw');
export const SOURCES_MANIFEST = path.join(ROOT, 'sources/manifest.json');
export const PLAN_FILE = path.join(ROOT, 'content/plan/reading-plan.json');
export const STRUCTURE_MAPS = path.join(ROOT, 'content/plan/structure-maps.json');
export const DATA_DIR = path.join(ROOT, 'public/data');
export const DOCS_DIR = path.join(ROOT, 'docs');
export const CONTENT_DIR = path.join(ROOT, 'content');
