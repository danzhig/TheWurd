/**
 * Station layout for a book's section map (PLAN §9, Level 1): a serpentine across the screen on
 * desktop, a gentle meander down the page on phone. Optional sections branch off the main line.
 * Pure geometry, so it can be unit-tested; BookMap renders it.
 */
import type { Status } from '@/lib/types';

export interface StationInput {
  id: string;
  status: Status;
}

export interface Placed {
  id: string;
  x: number; // disc centre
  y: number;
  label: 'below' | 'right';
  labelWidth: number;
  branchFrom?: { x: number; y: number }; // optional sections: where the branch leaves the path
}

export interface MapLayout {
  mode: 'serpentine' | 'meander';
  width: number;
  height: number;
  stations: Placed[];
  path: string; // SVG path through the main-line stations
}

export const SERPENTINE_MIN_WIDTH = 720;

/** Vertical space each status takes in the phone meander. */
const MEANDER_GAP: Record<Status, number> = { read: 104, skim: 88, optional: 92, skip: 66 };

/**
 * `evenColumns`: on a two-page spread the columns must be even so no station sits in the gutter.
 */
export function layoutStations(
  stations: StationInput[],
  width: number,
  opts: { evenColumns?: boolean } = {},
): MapLayout {
  return width >= SERPENTINE_MIN_WIDTH
    ? serpentine(stations, width, !!opts.evenColumns)
    : meander(stations, width);
}

function meander(stations: StationInput[], width: number): MapLayout {
  const placed: Placed[] = [];
  const main: { x: number; y: number }[] = [];
  let y = 40;
  let k = 0;
  for (const s of stations) {
    if (s.status === 'optional') {
      const from = main.at(-1) ?? { x: 44, y };
      const x = from.x + 46;
      placed.push({
        id: s.id,
        x,
        y,
        label: 'right',
        labelWidth: Math.max(120, width - x - 40),
        branchFrom: from,
      });
      y += MEANDER_GAP.optional;
      continue;
    }
    const x = 44 + 16 * Math.sin(k * 1.1);
    placed.push({ id: s.id, x, y, label: 'right', labelWidth: Math.max(120, width - x - 40) });
    main.push({ x, y });
    y += MEANDER_GAP[s.status];
    k++;
  }
  return { mode: 'meander', width, height: y, stations: placed, path: smoothPath(main) };
}

function serpentine(stations: StationInput[], width: number, even: boolean): MapLayout {
  const margin = 40;
  const fit = Math.max(3, Math.min(5, Math.floor((width - 2 * margin) / 230)));
  const cols = even ? Math.max(2, fit - (fit % 2)) : fit;
  const colW = (width - 2 * margin) / cols;
  const rowH = 200;
  const top = 50;
  const mainIdx = stations.filter((s) => s.status !== 'optional');
  const pos = (n: number) => {
    const r = Math.floor(n / cols);
    const c = n % cols;
    const col = r % 2 === 0 ? c : cols - 1 - c;
    return { x: margin + (col + 0.5) * colW, y: top + r * rowH, r };
  };
  const placed: Placed[] = [];
  const main: { x: number; y: number; r: number }[] = [];
  let n = 0;
  stations.forEach((s, i) => {
    if (s.status !== 'optional') {
      const p = pos(n++);
      placed.push({ id: s.id, x: p.x, y: p.y, label: 'below', labelWidth: colW - 20 });
      main.push(p);
      return;
    }
    // Optional: in the open band below the line, between the stations either side of it.
    const prev = main.at(-1) ?? pos(0);
    const nextIdx = stations.slice(i + 1).findIndex((t) => t.status !== 'optional');
    const next = nextIdx >= 0 ? pos(n) : prev;
    let x = next.r === prev.r ? (prev.x + next.x) / 2 : prev.x;
    if (even && Math.abs(x - width / 2) < colW / 4) x = prev.x; // never on the spread's fold
    placed.push({
      id: s.id,
      x,
      y: prev.y + 128,
      label: 'right',
      labelWidth: colW - 40,
      branchFrom: { x: prev.x, y: prev.y },
    });
  });
  const rows = Math.ceil(mainIdx.length / cols);
  return {
    mode: 'serpentine',
    width,
    height: top + Math.max(1, rows) * rowH + 40,
    stations: placed,
    path: serpentinePath(main, rowH, colW / 2 + 25),
  };
}

/**
 * Straight runs along each row, half-ellipse turns at the row ends. The turn is wider than half a
 * column so it clears the label centred under the end station.
 */
function serpentinePath(
  pts: { x: number; y: number; r: number }[],
  rowH: number,
  rx: number,
): string {
  if (!pts.length) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (a.r === b.r) d += ` L ${b.x} ${b.y}`;
    else {
      const sweep = a.r % 2 === 0 ? 1 : 0; // turn on the right after a left-to-right row
      d += ` A ${rx} ${rowH / 2} 0 0 ${sweep} ${b.x} ${b.y}`;
    }
  }
  return d;
}

/** A smooth curve through points (Catmull-Rom converted to cubic Béziers). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
