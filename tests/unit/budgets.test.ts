import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// PLAN §12 budgets: a section page's text arrives as its own JSON file under 60 KB gzipped.
describe('budgets', () => {
  it('every section file is under 60 KB gzipped', () => {
    const dir = 'public/data/sections';
    const over = fs
      .readdirSync(dir)
      .map((f) => ({ f, kb: gzipSync(fs.readFileSync(path.join(dir, f))).length / 1024 }))
      .filter((x) => x.kb >= 60);
    expect(over).toEqual([]);
  });
});
