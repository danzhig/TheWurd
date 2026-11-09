import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, vaultData } from '@/components/vault/data';
import { layoutVault, SIZE_MAX, SIZE_MIN } from '@/components/vault/layout';

const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8'));

describe('vault layout', () => {
  const d = vaultData(manifest);
  const l = layoutVault(d.path, d.bridges, d.satellites, d.offpath, GROUP_ORDER);
  const r = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

  it('places every plan book on the spiral in path order, moving inward', () => {
    expect(l.medallions.map((m) => m.id)).toEqual(d.path.map((b) => b.id));
    expect(l.medallions[0]!.id).toBe('Gen');
    expect(l.medallions.at(-1)!.id).toBe(d.path.at(-1)!.id); // Acts, unless Job follows it
    for (let i = 1; i < l.medallions.length; i++)
      expect(l.medallions[i]!.along).toBeGreaterThan(l.medallions[i - 1]!.along);
    expect(r(l.medallions[0]!)).toBeGreaterThan(r(l.medallions.at(-1)!));
  });

  it('sizes medallions by reading time within 64–140', () => {
    for (const m of l.medallions) {
      expect(m.w).toBeGreaterThanOrEqual(SIZE_MIN);
      expect(m.w).toBeLessThanOrEqual(SIZE_MAX);
    }
    const w = (id: string) => l.medallions.find((m) => m.id === id)!.w;
    expect(w('Gen')).toBe(SIZE_MAX);
    expect(w('Jonah')).toBe(SIZE_MIN);
  });

  it('keeps every medallion, satellite, star and outer book clear of the others', () => {
    const items = [
      ...l.medallions.map((m) => ({ id: m.id, x: m.x, y: m.y, rad: m.w / 2 })),
      ...l.satellites.map((m) => ({ id: m.id, x: m.x, y: m.y, rad: m.h / 2 })),
      ...l.offpath.map((o) => ({ id: o.id, x: o.x, y: o.y, rad: o.size / 2 })),
      ...l.bridges.map((b) => ({ id: b.id, x: b.x, y: b.y, rad: 8 })),
    ];
    // Ovals are treated as circles of their width (or height, for satellites beside their host).
    const clash: string[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.rad - b.rad;
        if (gap < 2) clash.push(`${a.id}/${b.id} ${gap.toFixed(0)}`);
      }
    }
    expect(clash).toEqual([]);
  });

  it('puts each bridge between the books it joins, John beside Luke, outer books in their bands', () => {
    expect(l.bridges.map((b) => b.id).sort()).toEqual(d.bridges.map((b) => b.id).sort());
    expect(l.satellites).toEqual([expect.objectContaining({ id: 'John', of: 'Luke' })]);
    expect(l.offpath).toHaveLength(49);
    for (const o of l.offpath) expect(r(o)).toBeGreaterThan(l.spiralRadius);
    expect(l.groups.map((g) => g.label)).toEqual(GROUP_ORDER);
  });

  it('draws a visible dashed branch from Luke to John 11', () => {
    expect(l.detours.map((t) => t.id)).toEqual(['John']);
    const [x1, y1, x2, y2] = l.detours[0]!.d.match(/-?[\d.]+/g)!.map(Number);
    expect(Math.hypot(x2! - x1!, y2! - y1!)).toBeGreaterThan(15);
  });
});
