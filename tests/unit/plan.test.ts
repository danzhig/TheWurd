import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { ReadingPlanSchema } from '@/lib/types';
import { checkReferences } from '@/scripts/validate';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

describe('reading-plan.json', () => {
  it('matches the schema and has 252 sections in 24 books', () => {
    expect(plan.books).toHaveLength(24);
    expect(plan.books.flatMap((b) => b.sections)).toHaveLength(252);
  });

  it('has consistent references between steps, sections, notes and bridges', () => {
    expect(checkReferences(plan)).toEqual([]);
  });

  it('has a Markdown copy of every bridge and note, and no others', () => {
    const bridges = fs.readdirSync('content/plan/bridges').map((f) => f.replace(/\.md$/, ''));
    const notes = fs.readdirSync('content/plan/notes').map((f) => f.replace(/\.md$/, ''));
    expect(bridges.sort()).toEqual(plan.bridges.map((b) => b.id).sort());
    expect(notes.sort()).toEqual(plan.notes.map((n) => n.id).sort());
    for (const n of plan.notes) {
      expect(fs.readFileSync(`content/plan/notes/${n.id}.md`, 'utf8')).toContain(n.text);
    }
  });
});
