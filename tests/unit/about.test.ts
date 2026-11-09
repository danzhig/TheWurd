import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABOUT_GROUPS, aboutData } from '@/app/about/about';
import { GROUP_LABEL, GROUP_ORDER } from '@/components/vault/data';

const m = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8'));
const a = aboutData(m);

describe('About this path', () => {
  it('counts and orders the books from the plan', () => {
    expect(a.ot.length + a.nt.length).toBe(a.pathBooks.length);
    expect(a.pathBooks.length + a.offpathCount + (a.detour ? 1 : 0)).toBe(m.books.length);
    expect(a.otTotal + a.ntTotal).toBe(m.books.length);
    expect(a.first).toBe('Gen');
    expect(a.last).toBe('Acts');
  });

  it('describes the detour from the plan', () => {
    expect(a.detour).toEqual({ bookId: 'John', hostId: 'Luke', afterRange: '19:27' });
  });

  it('has a description for every group of books outside the path, and no others', () => {
    const groups = new Set(a.offpath.map((b) => GROUP_LABEL[b.group]));
    expect([...groups].every((g) => g && ABOUT_GROUPS[g])).toBe(true);
    expect(Object.keys(ABOUT_GROUPS).every((g) => GROUP_ORDER.includes(g) && groups.has(g))).toBe(
      true,
    );
  });
});
