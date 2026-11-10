import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { timeline } from '@/components/path/timeline';
import { buildSequence } from '@/lib/path';

const m = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8'));
const groups = timeline(m);
const rows = groups.flatMap((g) => g.rows);

describe('path timeline', () => {
  it('lists every stop and detour once, in path order', () => {
    const expected = buildSequence(m)
      .filter((i) => i.stop || i.detour)
      .map((i) => i.id);
    expect(rows.map((r) => r.id)).toEqual(expected);
  });

  it('groups by book, with bridges between them and John 11 inside Luke', () => {
    expect(groups[0]).toMatchObject({ kind: 'book', id: 'Gen' });
    expect(groups.at(-1)).toMatchObject({ kind: 'book', id: 'Acts' });
    expect(groups.filter((g) => g.kind === 'bridge')).toHaveLength(4);
    const luke = groups.find((g) => g.id === 'Luke')!;
    const john = luke.rows.find((r) => r.id === 'john-01');
    expect(john).toMatchObject({ detour: true });
    expect(john && 'range' in john && john.range).toBe('John 11');
    expect(new Set(groups.filter((g) => g.kind === 'book').map((g) => g.id)).size).toBe(
      groups.filter((g) => g.kind === 'book').length,
    );
  });
});
