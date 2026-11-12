/**
 * Camera state shared across client navigations (module memory, this browsing session only):
 * where the Vault camera was, and which book the reader just came from, so returning to the Vault
 * pulls the camera back out of that book (PLAN §9, transition out).
 */
export interface CameraTransform {
  x: number;
  y: number;
  k: number;
}

export const camera: {
  last: CameraTransform | null;
  fromBook: string | null;
  /** Which way the Vault was showing the Bible: the story's spiral or the themes (Phase 6). */
  view: 'spiral' | 'themes';
} = {
  last: null,
  fromBook: null,
  view: 'spiral',
};

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The plan's camera easing, cubic-bezier(0.2, 0.7, 0.1, 1), as a function for d3 transitions. */
export function easeCamera(t: number): number {
  return cubicBezier(0.2, 0.7, 0.1, 1)(t);
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}
