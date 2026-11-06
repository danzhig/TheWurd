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
    expect(seq.filter((x) => x.kind === 'section')).toHaveLength(manifest.sections.length);
    expect(seq.filter((x) => x.kind === 'bridge')).toHaveLength(4);
  });

  it('by default starts at Genesis, puts Job after Genesis and ends in Acts', () => {
    const s = ids();
    expect(s[0]).toBe('gen-01');
    expect(s.indexOf('job-01')).toBe(s.indexOf('gen-20') + 1);
    expect(s.at(-1)).toBe('acts-14');
  });

  it('never stops at skipped sections, and leaves optional ones out by default', () => {
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

  it('adds Deuteronomy 28 and John 11 when optional sections are on', () => {
    const s = ids(stops(manifest, { jobAfter: 'Gen', optionalSections: true }));
    expect(s.indexOf('deut-02')).toBe(s.indexOf('deut-01') + 1);
    expect(s.indexOf('john-01')).toBe(s.indexOf('luke-12') + 1);
    expect(s.indexOf('luke-13')).toBe(s.indexOf('john-01') + 1);
  });

  it('moves Job when the reader chooses', () => {
    const s = ids(stops(manifest, { jobAfter: 'Ruth', optionalSections: false }));
    expect(s.indexOf('job-01')).toBe(s.indexOf('ruth-04') + 1);
    expect(s.indexOf('exod-01')).toBe(s.indexOf('gen-20') + 1);
  });

  it('gives skipped pages a Previous and Next on the path', () => {
    const n = neighbours(manifest, 'gen-x1');
    expect(n.prev?.id).toBe('gen-03');
    expect(n.next?.id).toBe('gen-04');
    expect(neighbours(manifest, 'gen-01').prev).toBeNull();
    expect(neighbours(manifest, 'acts-14').next).toBeNull();
  });
});
