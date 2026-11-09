/**
 * Where the open book sits on screen. Shared by the book page (which draws the open book and its
 * cover) and the transition layer (which flies a closed book there from the Vault), so the hand-off
 * between them lands on the same pixels.
 *
 * Desktop (≥ 900 px): a two-page spread; the cover is the right-hand page, and the closed book sits
 * centred (shifted left by a quarter spread) until it opens. Phone: a single page; the cover is the
 * page itself.
 */
export const BOOK_TOP = 64; // px from the top of the page to the top of the book
export const SPREAD_QUERY = '(min-width: 900px)';
export const SPREAD_MAX = 1180;

export interface CoverGeometry {
  spread: boolean;
  frameLeft: number; // viewport x of the open book's left edge
  frameWidth: number;
  offsetX: number; // cover's x within the frame (open position)
  w: number;
  h: number;
  shift: number; // x offset of the closed book relative to the open cover position
}

/** Width of the open book's frame; mirrors `.frame` in components/book-map/book-page.module.css. */
export function frameWidth(contentWidth: number, spread: boolean): number {
  return spread ? Math.min(SPREAD_MAX, contentWidth - 48) : contentWidth - 16;
}

export function coverGeometry(
  fw: number,
  spread: boolean,
  viewportHeight: number,
  frameLeft = 0,
): CoverGeometry {
  const w = spread ? fw / 2 : fw;
  const room = viewportHeight - BOOK_TOP - 16;
  const h = Math.round(spread ? Math.min(room, w * 1.36) : room);
  return {
    spread,
    frameLeft,
    frameWidth: fw,
    offsetX: spread ? fw / 2 : 0,
    w,
    h,
    shift: spread ? -fw / 4 : 0,
  };
}

/** The geometry for the current window, before the book page exists (used by the Vault). */
export function currentCoverGeometry(): CoverGeometry {
  const spread = window.matchMedia(SPREAD_QUERY).matches;
  const cw = document.documentElement.clientWidth;
  const fw = frameWidth(cw, spread);
  return coverGeometry(fw, spread, window.innerHeight, (cw - fw) / 2);
}

/** Viewport rect of the closed book (page scrolled to the top). */
export function closedBookRect(g: CoverGeometry): { x: number; y: number; w: number; h: number } {
  return { x: g.frameLeft + g.offsetX + g.shift, y: BOOK_TOP, w: g.w, h: g.h };
}
