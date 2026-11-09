/**
 * The Vault's geometry (PLAN §9, Level 0): plan books on a spiral of about two and a half turns,
 * Genesis on the outer rim and Acts at the oculus; books outside the path in an outer band grouped
 * by type; bridges as stars on the thread. World units are pixels at zoom 1, centred on (0, 0).
 */

export interface VaultBookInput {
  id: string;
  minutes: number; // reading time of its stops, for medallion size
}

export interface OffpathInput {
  id: string;
  group: string; // display group: Law, Histories, Wisdom, Prophets, Gospels, Letters, Apocalypse
}

export interface Point {
  x: number;
  y: number;
}

export interface Medallion extends Point {
  id: string;
  w: number; // oval width
  h: number; // oval height
  along: number; // arc length along the spiral (thread position)
}

export interface VaultLayout {
  medallions: Medallion[]; // plan books in path order
  satellites: (Medallion & { of: string })[]; // excursion books placed beside their host
  detours: { id: string; d: string }[]; // dashed branch from each host to its excursion
  offpath: (Point & { id: string; size: number; group: string })[];
  groups: (Point & { label: string; angle: number })[];
  bridges: (Point & { id: string })[];
  thread: string; // SVG path along the spiral from the first to the last medallion
  threadPoint: (along: number) => Point;
  threadUpTo: (along: number) => string;
  radius: number; // radius of everything, for fitting the whole ceiling
  spiralRadius: number; // outer radius of the spiral, for the base zoom
}

export const SIZE_MIN = 64;
export const SIZE_MAX = 140;
const OVAL = 0.78; // height / width
const DETOUR_GAP = 30; // room between a host and its excursion for the dashed branch
const R_OUTER = 440;
const R_INNER = 92;
const TURNS = 2.5;
const START_ANGLE = -Math.PI * 0.75; // Genesis at upper left
const GAP = 14;
const BRIDGE_GAP = 30;
const OFFPATH_RADIUS = 590;
const OFFPATH_SIZE = 46;

export function medallionWidth(minutes: number, min: number, max: number): number {
  if (max <= min) return (SIZE_MIN + SIZE_MAX) / 2;
  const t = (Math.log(minutes) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return Math.round(SIZE_MIN + (SIZE_MAX - SIZE_MIN) * Math.min(1, Math.max(0, t)));
}

/** The spiral, sampled densely with cumulative arc length. */
function spiral() {
  const n = 3000;
  const total = TURNS * 2 * Math.PI;
  const pts: (Point & { l: number })[] = [];
  let l = 0;
  for (let i = 0; i <= n; i++) {
    const th = (total * i) / n;
    const r = R_OUTER - ((R_OUTER - R_INNER) * th) / total;
    const a = START_ANGLE + th;
    const p = { x: r * Math.cos(a), y: r * Math.sin(a) };
    if (i > 0) l += Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y);
    pts.push({ ...p, l });
  }
  const at = (along: number): Point => {
    if (along <= 0) return pts[0]!;
    if (along >= l) return pts[n]!;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid]!.l < along) lo = mid;
      else hi = mid;
    }
    const a = pts[lo]!;
    const b = pts[hi]!;
    const t = (along - a.l) / (b.l - a.l || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const pathBetween = (from: number, to: number): string => {
    const seg = pts.filter((p) => p.l > from && p.l < to);
    const all = [at(from), ...seg.filter((_, i) => i % 6 === 0), at(to)];
    return all.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };
  return { length: l, at, pathBetween };
}

export function layoutVault(
  books: VaultBookInput[],
  bridges: { id: string; after: string }[],
  satellites: { id: string; of: string; minutes: number }[],
  offpath: OffpathInput[],
  groupOrder: string[],
): VaultLayout {
  const sp = spiral();
  const mins = books.map((b) => Math.max(1, b.minutes));
  const min = Math.min(...mins);
  const max = Math.max(...mins);
  const widths = books.map((b) => medallionWidth(Math.max(1, b.minutes), min, max));
  const bridgeAfter = new Map(bridges.map((b) => [b.after, b.id]));

  // Spacing along the thread: half of each neighbour plus a gap (wider where a bridge star sits).
  const needs = books
    .slice(1)
    .map(
      (b, i) =>
        (widths[i]! + widths[i + 1]!) / 2 + (bridgeAfter.has(books[i]!.id) ? BRIDGE_GAP * 2 : GAP),
    );
  const needed = needs.reduce((a, b) => a + b, 0);
  const start = widths[0]! / 2;
  const available = sp.length - start - widths.at(-1)! / 2;
  const stretch = available / needed;
  let along = start;
  const medallions: Medallion[] = books.map((b, i) => {
    if (i > 0) along += needs[i - 1]! * stretch;
    const p = sp.at(along);
    return { id: b.id, x: p.x, y: p.y, w: widths[i]!, h: Math.round(widths[i]! * OVAL), along };
  });

  const bridgePts = bridges.flatMap((br) => {
    const i = medallions.findIndex((m) => m.id === br.after);
    if (i < 0 || i === medallions.length - 1) return [];
    const p = sp.at((medallions[i]!.along + medallions[i + 1]!.along) / 2);
    return [{ id: br.id, x: p.x, y: p.y }];
  });

  // Excursion books sit just inside their host, toward the oculus.
  const sats = satellites.flatMap((s) => {
    const host = medallions.find((m) => m.id === s.of);
    if (!host) return [];
    const r = Math.hypot(host.x, host.y);
    const w = SIZE_MIN;
    const d = r - host.w / 2 - w * OVAL * 0.5 - DETOUR_GAP;
    const k = d / r;
    return [
      {
        id: s.id,
        of: s.of,
        x: host.x * k,
        y: host.y * k,
        w,
        h: Math.round(w * OVAL),
        along: host.along,
      },
    ];
  });

  // A dashed branch from the host's rim to the excursion's rim, along the line between them.
  const detours = sats.flatMap((s) => {
    const host = medallions.find((m) => m.id === s.of);
    if (!host) return [];
    const len = Math.hypot(s.x - host.x, s.y - host.y);
    const ux = (s.x - host.x) / len;
    const uy = (s.y - host.y) / len;
    const a = ovalRadius(host, ux, uy) + 3;
    const b = len - ovalRadius(s, ux, uy) - 3;
    const f = (n: number) => n.toFixed(1);
    return [
      {
        id: s.id,
        d: `M ${f(host.x + ux * a)} ${f(host.y + uy * a)} L ${f(host.x + ux * b)} ${f(host.y + uy * b)}`,
      },
    ];
  });

  // Books outside the path: one ring, grouped by type with a gap and a label for each group.
  const step = (OFFPATH_SIZE + 10) / OFFPATH_RADIUS;
  const groupGap = 0.16;
  const ordered = groupOrder.flatMap((g) => offpath.filter((o) => o.group === g));
  const span = ordered.length * step + groupOrder.length * groupGap;
  let angle = -Math.PI / 2 - span / 2;
  const off: VaultLayout['offpath'] = [];
  const groups: VaultLayout['groups'] = [];
  for (const g of groupOrder) {
    const members = offpath.filter((o) => o.group === g);
    if (!members.length) continue;
    angle += groupGap / 2;
    const first = angle;
    for (const m of members) {
      angle += step / 2;
      off.push({
        id: m.id,
        group: g,
        size: OFFPATH_SIZE,
        x: OFFPATH_RADIUS * Math.cos(angle),
        y: OFFPATH_RADIUS * Math.sin(angle),
      });
      angle += step / 2;
    }
    const mid = (first + angle) / 2;
    // Labels sit outside the ring; at the sides they need extra room for their width.
    const out = OFFPATH_RADIUS + OFFPATH_SIZE / 2 + 18 + Math.abs(Math.cos(mid)) * 48;
    groups.push({ label: g, angle: mid, x: out * Math.cos(mid), y: out * Math.sin(mid) });
    angle += groupGap / 2;
  }

  const first = medallions[0]!.along;
  const last = medallions.at(-1)!.along;
  return {
    medallions,
    satellites: sats,
    detours,
    offpath: off,
    groups,
    bridges: bridgePts,
    thread: sp.pathBetween(first, last),
    threadPoint: sp.at,
    threadUpTo: (to: number) => sp.pathBetween(first, Math.max(first, Math.min(last, to))),
    radius: OFFPATH_RADIUS + 90,
    spiralRadius: R_OUTER + SIZE_MAX / 2,
  };
}

/** Distance from an oval's centre to its rim in the direction (ux, uy). */
function ovalRadius(m: { w: number; h: number }, ux: number, uy: number): number {
  const a = m.w / 2;
  const b = m.h / 2;
  return (a * b) / Math.hypot(b * ux, a * uy);
}
