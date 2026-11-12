/**
 * The Themes view's geometry (PLAN §16, P6.3), pure and unit-tested. World units are the Vault's
 * (pixels at zoom 1, centred on the oculus at 0, 0).
 *
 * - Each top-level theme is a constellation on a ring around the oculus; its sub-themes sit on a
 *   small ring around the constellation's centre, joined by hairlines; each sub-theme's passages
 *   are stars spread around it (a sunflower spiral, so any number packs evenly).
 * - Each star also has a home: the medallion of the book its passage is in, on the spiral or the
 *   outer ring, scattered inside the medallion so the stars of one book do not stack.
 * - The switch is a flight (owner, 2026-11-12): every star travels from home to its constellation
 *   (or back) along its own curve, starting a little after the one before, so the spiral visibly
 *   comes apart into the constellations and re-forms on the way back.
 */
import type { Point } from './layout';

export interface ThemeInput {
  id: string;
  subthemes: { id: string; passages: { key: string; bookId: string; library: boolean }[] }[];
}

export interface Star extends Point {
  key: string; // `${subthemeId}:${ref}`, unique
  themeId: string;
  subId: string;
  bookId: string;
  library: boolean;
  home: Point; // where it starts in the Spiral view
  delay: number; // 0–STAGGER, when it leaves (as a fraction of the flight)
  bend: number; // signed curvature of its path
}

export interface Constellation extends Point {
  id: string;
  r: number; // radius that holds all its stars
  subs: (Point & { id: string })[];
  lines: [Point, Point][]; // hairlines between sub-themes
}

export interface ThemesLayout {
  constellations: Constellation[];
  stars: Star[];
}

export const RING = 400; // constellation centres from the oculus
export const SUB_RING = 60; // sub-theme centres from their constellation's centre
const STAR_STEP = 9; // sunflower spacing between a sub-theme's stars
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const STAGGER = 0.35; // the last star leaves this far into the flight

/** A stable pseudo-random number in [0, 1) for a string (FNV-1a). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * @param homes where each book sits in the Spiral view (centre and radius), by book id
 */
export function layoutThemes(
  themes: ThemeInput[],
  homes: Map<string, Point & { r: number }>,
): ThemesLayout {
  const constellations: Constellation[] = [];
  const stars: Star[] = [];
  const n = themes.length;
  themes.forEach((t, i) => {
    // Start at the top and go round clockwise; each constellation turned a little differently.
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const c = { x: Math.cos(a) * RING, y: Math.sin(a) * RING };
    const m = t.subthemes.length;
    const twist = hash01(t.id) * Math.PI * 2;
    const subs = t.subthemes.map((s, j) => {
      const b = twist + (j / m) * Math.PI * 2;
      // Alternate the distance a little so the shape reads as a figure, not a regular polygon.
      const d = SUB_RING * (j % 2 ? 0.82 : 1.08);
      return { id: s.id, x: c.x + Math.cos(b) * d, y: c.y + Math.sin(b) * d };
    });
    const lines: [Point, Point][] = subs.map((s, j) => [s, subs[(j + 1) % m]!]);
    let r = 0;
    t.subthemes.forEach((s, j) => {
      const sc = subs[j]!;
      s.passages.forEach((p, k) => {
        const rr = STAR_STEP * Math.sqrt(k + 0.6);
        const x = sc.x + Math.cos(k * GOLDEN) * rr;
        const y = sc.y + Math.sin(k * GOLDEN) * rr;
        r = Math.max(r, Math.hypot(x - c.x, y - c.y));
        const key = `${s.id}:${p.key}`;
        const home = homes.get(p.bookId) ?? { x: 0, y: 0, r: 20 };
        const ha = hash01(`${key}#a`) * Math.PI * 2;
        const hr = Math.sqrt(hash01(`${key}#r`)) * home.r * 0.7;
        stars.push({
          key,
          themeId: t.id,
          subId: s.id,
          bookId: p.bookId,
          library: p.library,
          x,
          y,
          home: { x: home.x + Math.cos(ha) * hr, y: home.y + Math.sin(ha) * hr },
          delay: 0,
          bend: (hash01(`${key}#b`) - 0.5) * 0.9,
        });
      });
    });
    constellations.push({ id: t.id, x: c.x, y: c.y, r: r + 14, subs, lines });
  });
  // Leave in order of distance from the oculus outward, so the flight ripples across the ceiling.
  const order = [...stars].sort(
    (a, b) => Math.hypot(a.home.x, a.home.y) - Math.hypot(b.home.x, b.home.y),
  );
  order.forEach((s, i) => (s.delay = (i / Math.max(1, order.length - 1)) * STAGGER));
  return { constellations, stars };
}

/** Smooth start and end. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Where a star is at flight progress `p` (0 = home, 1 = in its constellation). Each star moves
 * over its own window [delay, delay + 1 − STAGGER] along a quadratic curve bowed sideways by its
 * `bend`, so the paths cross and swirl instead of all running straight.
 */
export function starAt(s: Star, p: number): Point {
  const t = easeInOut(Math.min(1, Math.max(0, (p - s.delay) / (1 - STAGGER))));
  const mx = (s.home.x + s.x) / 2;
  const my = (s.home.y + s.y) / 2;
  const dx = s.x - s.home.x;
  const dy = s.y - s.home.y;
  const cx = mx - dy * s.bend;
  const cy = my + dx * s.bend;
  const u = 1 - t;
  return {
    x: u * u * s.home.x + 2 * u * t * cx + t * t * s.x,
    y: u * u * s.home.y + 2 * u * t * cy + t * t * s.y,
  };
}

/** The constellation nearest a world point (the one the camera is looking at). */
export function nearestConstellation(l: ThemesLayout, p: Point): Constellation | null {
  let best: Constellation | null = null;
  let d = Infinity;
  for (const c of l.constellations) {
    const e = Math.hypot(c.x - p.x, c.y - p.y);
    if (e < d) {
      d = e;
      best = c;
    }
  }
  return best;
}
