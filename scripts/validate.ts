/**
 * Step 5 — validate: plan integrity checks that are not part of range resolution (docs/PLAN.md §16):
 * references between steps, sections, notes and bridges; required chapter ends; and the
 * "no hand-written scripture" scan over everything under content/.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ReadingPlan } from '../lib/types';
import type { ParsedBook } from './parse-usfm';

export function checkReferences(plan: ReadingPlan): string[] {
  const errors: string[] = [];
  const sectionIds = new Map<string, string>();
  for (const b of plan.books) {
    for (const s of b.sections) {
      if (sectionIds.has(s.id)) errors.push(`Duplicate section id ${s.id}`);
      sectionIds.set(s.id, b.id);
    }
  }
  const noteIds = new Set(plan.notes.map((n) => n.id));
  const bridgeIds = new Set(plan.bridges.map((b) => b.id));
  const bookIds = new Set(plan.books.map((b) => b.id));
  if (noteIds.size !== plan.notes.length) errors.push('Duplicate note id');
  for (const n of plan.notes) {
    if (!sectionIds.has(n.section))
      errors.push(`Note ${n.id}: section ${n.section} does not exist`);
    const s = plan.books.flatMap((b) => b.sections).find((x) => x.id === n.section);
    if (s && !(s.noteIds ?? []).includes(n.id))
      errors.push(`Note ${n.id}: section ${n.section} does not list it`);
    if (!/^(start|end|fold|\d+:\d+)$/.test(n.at))
      errors.push(`Note ${n.id}: unknown position "${n.at}"`);
  }
  for (const b of plan.books) {
    for (const s of b.sections) {
      for (const id of s.noteIds ?? [])
        if (!noteIds.has(id)) errors.push(`${s.id}: note ${id} does not exist`);
      if (s.status !== 'read' && s.status !== 'optional' && !s.summary)
        errors.push(`${s.id}: ${s.status} section has no summary`);
    }
  }
  const usedBridges = new Set<string>();
  for (const step of plan.steps) {
    if (step.kind === 'book' && !bookIds.has(step.id))
      errors.push(`Step: book ${step.id} does not exist`);
    if (step.kind === 'bridge') {
      if (!bridgeIds.has(step.id)) errors.push(`Step: bridge ${step.id} does not exist`);
      usedBridges.add(step.id);
    }
    if (step.kind === 'excursion') {
      if (!sectionIds.has(step.id)) errors.push(`Step: excursion ${step.id} does not exist`);
      if (step.after && !sectionIds.has(step.after))
        errors.push(`Step: excursion anchor ${step.after} does not exist`);
    }
  }
  for (const id of bridgeIds)
    if (!usedBridges.has(id)) errors.push(`Bridge ${id} is not placed in steps`);
  const stepBooks = new Set(plan.steps.filter((s) => s.kind === 'book').map((s) => s.id));
  const excursionBooks = new Set(
    plan.steps.filter((s) => s.kind === 'excursion').map((s) => sectionIds.get(s.id)),
  );
  for (const b of plan.books) {
    if (!stepBooks.has(b.id) && !excursionBooks.has(b.id))
      errors.push(`Book ${b.id} is not on the path`);
  }
  return errors;
}

/** docs/PLAN.md §16.5: these boundaries must be the last verse of their chapter in WEBC. */
export const REQUIRED_CHAPTER_ENDS = [
  'Gen.11.32',
  'Deut.32.52',
  'Judg.3.31',
  'Neh.12.47',
  '1Macc.4.61',
  'Luke.2.52',
  'Luke.3.38',
  'Exod.40.38',
];

export function checkChapterEnds(parsed: Map<string, ParsedBook>): string[] {
  const errors: string[] = [];
  for (const ref of REQUIRED_CHAPTER_ENDS) {
    const [book, c, v] = ref.split('.');
    const last = parsed.get(book!)?.chapterLengths[Number(c) - 1];
    if (last !== Number(v))
      errors.push(`${ref} is not the last verse of its chapter in WEBC (last is ${c}:${last})`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// No hand-written scripture (§16.7): no 12 consecutive words of any file under content/ may match
// 12 consecutive words of WEBC.
// ---------------------------------------------------------------------------

const SHINGLE = 12;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function buildShingles(parsed: Map<string, ParsedBook>): Set<string> {
  const set = new Set<string>();
  for (const b of parsed.values()) {
    const w = words(b.verses.map((v) => v.text).join(' '));
    for (let i = 0; i + SHINGLE <= w.length; i++) set.add(w.slice(i, i + SHINGLE).join(' '));
  }
  return set;
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : /\.(json|md|txt)$/.test(e.name) ? [p] : [];
  });
}

export function checkNoHandwrittenScripture(contentDir: string, shingles: Set<string>): string[] {
  const errors: string[] = [];
  for (const file of listFiles(contentDir)) {
    const w = words(fs.readFileSync(file, 'utf8'));
    for (let i = 0; i + SHINGLE <= w.length; i++) {
      const s = w.slice(i, i + SHINGLE).join(' ');
      if (shingles.has(s)) {
        errors.push(`${path.relative(contentDir, file)}: 12 consecutive words match WEBC: "${s}"`);
        break;
      }
    }
  }
  return errors;
}
