import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSequence, neighbours, stops } from '@/lib/path';
import type { PathInput } from '@/lib/path';

const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as PathInput;
const ids = (s = stops(manifest)) => s.map((x) => x.id);

describe('reading path', () => {
  it('places every section and bridge exactly once', () => {
    const seq = buildSequence(manifest);
    expect(new Set(seq.map((x) => x.id)).size).toBe(seq.length);
    // Library sections (Phase 5) are never on the path.
    const onPath = manifest.sections.filter((s) => !(s as { library?: boolean }).library);
    expect(seq.filter((x) => x.kind === 'section')).toHaveLength(onPath.length);
    expect(seq.some((x) => x.id.startsWith('lev-'))).toBe(false);
    expect(seq.filter((x) => x.kind === 'bridge')).toHaveLength(4);
  });

  it('by default starts at Genesis, puts Job after Genesis and ends in Acts', () => {
    const s = ids();
    expect(s[0]).toBe('gen-01');
    expect(s.indexOf('job-01')).toBe(s.indexOf('gen-20') + 1);
    expect(s.at(-1)).toBe('acts-14');
  });

  it('never stops at skipped sections, and leaves optional ones out', () => {
    const s = ids();
    for (const sec of manifest.sections) {
      if (sec.status === 'skip' || sec.status === 'optional')
        expect(s, sec.id).not.toContain(sec.id);
    }
  });

  it('puts each bridge between the books it joins', () => {
    const s = ids();
    expect(s.indexOf('br-inside')).toBe(s.indexOf('2kgs-10') + 1);
    expect(s.indexOf('jer-01')).toBe(s.indexOf('br-inside') + 1);
    expect(s.indexOf('luke-01')).toBe(s.indexOf('br-rome') + 1);
  });

  it('offers Deuteronomy 28 and John 11 as detours beside Next, and leads back onto the path', () => {
    const d = neighbours(manifest, 'deut-01');
    expect(d.next?.id).not.toBe('deut-02');
    expect(d.detours.map((x) => x.id)).toEqual(['deut-02']);
    const l = neighbours(manifest, 'luke-12');
    expect(l.next?.id).toBe('luke-13');
    expect(l.detours.map((x) => x.id)).toEqual(['john-01']);
    const j = neighbours(manifest, 'john-01');
    expect([j.prev?.id, j.next?.id, j.detours]).toEqual(['luke-12', 'luke-13', []]);
    expect(neighbours(manifest, 'gen-01').detours).toEqual([]);
  });

  it('gives skipped pages a Previous and Next on the path', () => {
    const n = neighbours(manifest, 'gen-x1');
    expect(n.prev?.id).toBe('gen-03');
    expect(n.next?.id).toBe('gen-04');
    expect(neighbours(manifest, 'gen-01').prev).toBeNull();
    expect(neighbours(manifest, 'acts-14').next).toBeNull();
  });
});
