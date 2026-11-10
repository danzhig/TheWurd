/**
 * Live transitions between the three levels (PLAN §9): the Vault's medallion becomes a closed book
 * that flies to the centre and opens onto the book's pages; a station on a page grows into the page
 * of verses; and the reverse of each. Everything here moves one element with the Web Animations
 * API, animating only transform and opacity, and every element is drawn at its final size and
 * scaled down (never up), so nothing pixelates.
 *
 * The layer (#transition-layer, in the root layout) survives route changes, so an animation can
 * start on one page and finish on the next. `pending` tells the arriving page what to pick up.
 */
import { closedBookRect, currentCoverGeometry, type CoverGeometry } from './book-geometry';
import { prefersReducedMotion } from './camera';

export type Pending =
  | { kind: 'book-in'; bookId: string }
  | { kind: 'book-out'; bookId: string }
  | { kind: 'paper-in'; sectionId: string }
  | { kind: 'paper-out'; sectionId: string };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const EASE = 'cubic-bezier(0.2, 0.7, 0.1, 1)'; // the plan's camera easing
export const FLIGHT_MS = 700;
export const PAPER_MS = 480;
export const END_EVENT = 'sas:transition-end';

export const transition: {
  pending: Pending | null;
  /** Registered by the page currently showing them. */
  medallionRect: ((bookId: string) => DOMRect | null) | null;
} = { pending: null, medallionRect: null };

let safety = 0;

function layer(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById('transition-layer');
}

function finish() {
  window.clearTimeout(safety);
  transition.pending = null;
  layer()?.replaceChildren();
  window.dispatchEvent(new CustomEvent(END_EVENT));
}

/** Never leave an overlay on screen: whatever happens, clear it after a few seconds. */
function guard(ms = 4000) {
  window.clearTimeout(safety);
  safety = window.setTimeout(finish, ms);
}

export function animationsOn(): boolean {
  return !prefersReducedMotion() && !!layer() && typeof Element.prototype.animate === 'function';
}

const toRect = (r: DOMRect): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/** A transform that places an element drawn at `to` over `from`, scaled to fit inside it. */
function fitTransform(from: Rect, to: Rect): string {
  const s = Math.min(from.w / to.w, from.h / to.h);
  const x = from.x + from.w / 2 - (to.x + (to.w * s) / 2);
  const y = from.y + from.h / 2 - (to.y + (to.h * s) / 2);
  return `translate(${x}px, ${y}px) scale(${s})`;
}

/** A closed book, built with the same classes as the book page's cover (styles/book.css). */
function closedBook(name: string, tagline: string, r: Rect): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'book-shell';
  Object.assign(shell.style, {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
    transformOrigin: '0 0',
  });
  shell.innerHTML =
    '<div class="book-edge"></div><div class="book-hinge"><div class="book-cover-face">' +
    '<div class="book-cover-title"></div><div class="book-cover-rule"></div><div class="book-cover-tagline"></div>' +
    '</div><div class="book-cover-back"></div></div>';
  shell.querySelector('.book-cover-title')!.textContent = name;
  shell.querySelector('.book-cover-tagline')!.textContent = tagline;
  shell.dataset.testid = 'flying-book';
  return shell;
}

// ---------------------------------------------------------------------------------------------
// Vault → book
// ---------------------------------------------------------------------------------------------

/**
 * Lift a closed book out of the medallion and fly it to where the book page's cover will be.
 * Resolves when it lands; the book stays on the layer until the book page takes over (`handoff`).
 */
export async function bookIn(
  bookId: string,
  name: string,
  tagline: string,
  from: DOMRect,
): Promise<CoverGeometry | null> {
  const el = layer();
  if (!el || !animationsOn()) return null;
  const g = currentCoverGeometry();
  const to = closedBookRect(g);
  const book = closedBook(name, tagline, to);
  el.replaceChildren(book);
  transition.pending = { kind: 'book-in', bookId };
  guard();
  await settle(
    book.animate(
      [
        { transform: fitTransform(toRect(from), to), opacity: 0 },
        { opacity: 1, offset: 0.18 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: FLIGHT_MS, easing: EASE, fill: 'forwards' },
    ),
  );
  return g;
}

/** The book page's own cover is in place under the flying book: drop the flying one. */
export function handoff() {
  finish();
}

// ---------------------------------------------------------------------------------------------
// Book → Vault
// ---------------------------------------------------------------------------------------------

/**
 * Take the closed book from where it sits (the book page's cover just closed there, or the centre
 * when arriving by the browser's back button) and shrink it into its medallion on the Vault.
 */
export async function bookOut(
  bookId: string,
  name: string,
  tagline: string,
  from: DOMRect | null,
): Promise<void> {
  const el = layer();
  if (!el || !animationsOn()) return;
  const start = from ? toRect(from) : closedBookRect(currentCoverGeometry());
  const book = closedBook(name, tagline, start);
  el.replaceChildren(book);
  transition.pending = { kind: 'book-out', bookId };
  guard();
  // While the Vault loads, the book is already drawing back, so it never sits still.
  const drift = book.animate([{ transform: 'none' }, { transform: driftTransform(start, 0.88) }], {
    duration: 900,
    easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
    fill: 'forwards',
  });
  // Wait for the Vault to show the medallion (it registers `medallionRect` when laid out).
  let target = await waitFor(() => transition.medallionRect?.(bookId) ?? null, 2500);
  if (!target) return finish();
  // Let the Vault's first paint settle, so its mount work does not stall the start of the flight.
  await nextFrames(2);
  target = transition.medallionRect?.(bookId) ?? target;
  const now = getComputedStyle(book).transform;
  drift.cancel();
  await settle(
    book.animate(
      [
        { transform: now === 'none' ? 'none' : now, opacity: 1 },
        { opacity: 1, offset: 0.75 },
        { transform: fitTransform(toRect(target), start), opacity: 0 },
      ],
      { duration: FLIGHT_MS, easing: EASE, fill: 'forwards' },
    ),
  );
  finish();
}

// ---------------------------------------------------------------------------------------------
// Book → verses, and back
// ---------------------------------------------------------------------------------------------

function paperDisc(cx: number, cy: number, color: string): HTMLElement {
  const r =
    Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 2;
  const disc = document.createElement('div');
  Object.assign(disc.style, {
    left: `${cx - r}px`,
    top: `${cy - r}px`,
    width: `${2 * r}px`,
    height: `${2 * r}px`,
    borderRadius: '50%',
    background: color,
  });
  disc.dataset.testid = 'paper';
  return disc;
}

/** A page grows out of the tapped station until it fills the screen. Stays until `reveal`. */
export async function paperIn(sectionId: string, at: DOMRect, color: string): Promise<void> {
  const el = layer();
  if (!el || !animationsOn()) return;
  const cx = at.left + at.width / 2;
  const cy = at.top + at.height / 2;
  const disc = paperDisc(cx, cy, color);
  el.replaceChildren(disc);
  transition.pending = { kind: 'paper-in', sectionId };
  guard();
  const start = Math.max(at.width, 8) / disc.offsetWidth;
  await settle(
    disc.animate([{ transform: `scale(${start})` }, { transform: 'scale(1)' }], {
      duration: PAPER_MS,
      easing: EASE,
      fill: 'forwards',
    }),
  );
}

/** The arriving page is ready under the paper: fade the paper away. */
export async function reveal(): Promise<void> {
  const el = layer();
  const child = el?.firstElementChild as HTMLElement | null;
  if (!child) return finish();
  await settle(
    child.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 220,
      easing: 'ease',
      fill: 'forwards',
    }),
  );
  finish();
}

/** Leaving the verses: cover the screen with the page's own colour (invisible), then navigate. */
export function paperCover(sectionId: string, color: string) {
  const el = layer();
  if (!el || !animationsOn()) return;
  el.replaceChildren(paperDisc(window.innerWidth / 2, window.innerHeight / 2, color));
  transition.pending = { kind: 'paper-out', sectionId };
  guard();
}

/** On the book's page, shrink the covering paper back into the station it came from. */
export async function paperShrinkTo(at: DOMRect): Promise<void> {
  const el = layer();
  const old = el?.firstElementChild as HTMLElement | null;
  if (!el || !old) return finish();
  const cx = at.left + at.width / 2;
  const cy = at.top + at.height / 2;
  const disc = paperDisc(cx, cy, old.style.background);
  el.replaceChildren(disc);
  const end = Math.max(at.width, 8) / disc.offsetWidth;
  await settle(
    disc.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { opacity: 1, offset: 0.7 },
        { transform: `scale(${end})`, opacity: 0 },
      ],
      { duration: PAPER_MS, easing: EASE, fill: 'forwards' },
    ),
  );
  finish();
}

/** Scale an element drawn at `r` (origin top-left) about its own centre. */
function driftTransform(r: Rect, s: number): string {
  return `translate(${(r.w * (1 - s)) / 2}px, ${(r.h * (1 - s)) / 2}px) scale(${s})`;
}

function nextFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
}

/**
 * Resolve when an animation ends, is cancelled, or overruns its duration by a margin. Navigation
 * waits on this, so it must never hang (a paused background tab, a cancelled animation).
 */
function settle(a: Animation): Promise<void> {
  const ms = Number(a.effect?.getComputedTiming().endTime ?? 0) + 300;
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, ms);
    a.finished.then(
      () => (window.clearTimeout(t), resolve()),
      () => (window.clearTimeout(t), resolve()),
    );
  });
}

function waitFor<T>(get: () => T | null, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const v = get();
      if (v || performance.now() - t0 > ms) resolve(v);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}
