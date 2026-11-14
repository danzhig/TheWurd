'use client';

/**
 * The Spiral / Themes switch (PLAN §16, P6.3). The passages' data (`/data/themes.json`) loads only
 * when the reader first asks for Themes, so the Vault's first paint carries none of it. Switching
 * flies every star from its book to its constellation, or back (owner, 2026-11-12); the spiral
 * fades as its stars leave and returns as they come home. Reduced motion cross-fades instead.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { camera, prefersReducedMotion } from '@/lib/camera';
import { FLY_FROM, FLY_TO, layoutThemes, starAt, type ThemesLayout } from './constellations';
import type { Point } from './layout';
import { StarField, type Cam } from './starfield';

export type ThemesView = 'spiral' | 'to-themes' | 'themes' | 'to-spiral';

export interface ThemePassage {
  ref: string;
  display: string;
  sectionId: string;
  sectionTitle: string;
  bookId: string;
  library: boolean;
}
export interface ThemesData {
  themes: {
    id: string;
    title: string;
    description: string;
    subthemes: { id: string; title: string; description: string; passages: ThemePassage[] }[];
  }[];
}

export const FLIGHT_MS = 3400;
const FADE_MS = 350;

let themesPromise: Promise<ThemesData> | null = null;
export function loadThemes(): Promise<ThemesData> {
  themesPromise ??= fetch('/data/themes.json')
    .then((r) => {
      if (!r.ok) throw new Error(`themes.json ${r.status}`);
      return r.json() as Promise<ThemesData>;
    })
    .catch((err) => {
      themesPromise = null;
      throw err;
    });
  return themesPromise;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How visible the spiral is, and the constellations' labels, at flight progress p. */
// The spiral (thread, bubbles, ring, names) shrinks away in the first step, and the
// constellations' names draw in in the last (see FLY_FROM / FLY_TO in constellations.ts).
export const spiralOpacity = (p: number, fade: boolean) =>
  fade ? 1 - p : 1 - smooth(0, FLY_FROM, p);
export const labelsOpacity = (p: number, fade: boolean) => (fade ? p : smooth(FLY_TO, 1, p));

export function useThemes(opts: {
  camRef: RefObject<Cam>;
  homes: Map<string, Point & { r: number }>;
}) {
  const { camRef, homes } = opts;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spiralRef = useRef<HTMLDivElement>(null);
  const spiralLabelsRef = useRef<HTMLDivElement>(null); // the spiral's names (label layer)
  const labelsRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ThemesView>(() =>
    typeof window !== 'undefined' && camera.view === 'themes' ? 'themes' : 'spiral',
  );
  const [data, setData] = useState<ThemesData | null>(null);
  const field = useRef<StarField | null>(null);
  const layoutRef = useRef<ThemesLayout | null>(null);
  const p = useRef(view === 'themes' ? 1 : 0);
  const fade = useRef(false);
  const dir = useRef<1 | -1>(1);
  const lit = useRef<string | null>(null);
  const busy = useRef(false);

  const layout = useMemo(
    () =>
      data
        ? layoutThemes(
            data.themes.map((t) => ({
              id: t.id,
              subthemes: t.subthemes.map((s) => ({
                id: s.id,
                passages: s.passages.map((x) => ({
                  key: x.ref,
                  bookId: x.bookId,
                  library: x.library,
                })),
              })),
            })),
            homes,
          )
        : null,
    [data, homes],
  );
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const draw = useCallback(
    (cam?: Cam) => {
      field.current?.draw(cam ?? camRef.current, {
        p: p.current,
        fade: fade.current,
        lit: lit.current,
        dir: dir.current,
      });
    },
    [camRef],
  );

  // The star field follows the data and the canvas size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!layout || !canvas) return;
    field.current = new StarField(canvas, layout);
    draw();
    const onResize = () => {
      field.current?.resize();
      draw();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layout, draw]);

  // Coming back to the Vault in Themes: load the stars and show them where they are.
  useEffect(() => {
    if (view === 'themes' && !data) void loadThemes().then(setData);
    document.documentElement.dataset.vaultView = view;
  }, [view, data]);

  // Tests read the stars' positions mid-flight (they are pixels on a canvas, not elements).
  useEffect(() => {
    (window as unknown as { __sasStars?: () => unknown }).__sasStars = () => {
      const l = layoutRef.current;
      if (!l) return null;
      return {
        p: p.current,
        fade: fade.current,
        stars: l.stars.map((s) => ({
          home: s.home,
          end: { x: s.x, y: s.y },
          now: fade.current ? { x: s.x, y: s.y } : starAt(s, p.current),
        })),
      };
    };
  }, []);

  /** Fly every star to the other view; resolves when they have landed. */
  const switchTo = useCallback(
    async (target: 'spiral' | 'themes') => {
      if (busy.current) return;
      const from = p.current;
      const to = target === 'themes' ? 1 : 0;
      if (from === to) return;
      busy.current = true;
      try {
        if (!data) setData(await loadThemes());
        fade.current = prefersReducedMotion();
        setView(target === 'themes' ? 'to-themes' : 'to-spiral');
        // Let the layers for the flight mount (and the star field be created) before it starts.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        dir.current = to > from ? 1 : -1;
        const ms = (fade.current ? FADE_MS : FLIGHT_MS) * Math.abs(to - from);
        const t0 = performance.now();
        // Every bubble shrinks away into its stars at the start (and grows back out of them at
        // the end of the way home). Browser animations, so the compositor does the work.
        const out = to > from;
        const bubbles = [
          ...(spiralRef.current?.querySelectorAll<HTMLElement>('[data-book]') ?? []),
        ];
        const full = { transform: 'scale(1)', opacity: 1 };
        const gone = { transform: 'scale(0)', opacity: 0 };
        const step1 = fade.current ? 1 : FLY_FROM;
        const anims = bubbles.map((el) =>
          el.animate(out ? [full, gone] : [gone, full], {
            duration: step1 * ms,
            delay: out ? 0 : (1 - step1) * ms,
            easing: out ? 'ease-in' : 'ease-out',
            fill: 'both',
          }),
        );
        const layers = [spiralRef.current, spiralLabelsRef.current, labelsRef.current].filter(
          Boolean,
        ) as HTMLElement[];
        for (const el of layers) el.style.willChange = 'opacity';
        await new Promise<void>((resolve) => {
          const step = (now: number) => {
            const u = Math.min(1, (now - t0) / ms);
            p.current = from + (to - from) * u;
            for (const el of [spiralRef.current, spiralLabelsRef.current])
              if (el) el.style.opacity = String(spiralOpacity(p.current, fade.current));
            if (labelsRef.current)
              labelsRef.current.style.opacity = String(labelsOpacity(p.current, fade.current));
            draw();
            if (u < 1) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
        // Land first: the layer that has faded out is removed while it is still invisible. Only
        // then are the animations and inline fades cleared, on whatever stays on screen (whose
        // final state they already match), so nothing flashes back for a frame.
        camera.view = target;
        setView(target);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        for (const a of anims) a.cancel();
        for (const el of layers) el.style.willChange = '';
        for (const el of [spiralRef.current, spiralLabelsRef.current])
          if (el) el.style.opacity = '';
        if (labelsRef.current) labelsRef.current.style.opacity = '';
      } finally {
        busy.current = false;
      }
    },
    [data, draw],
  );

  const setLit = useCallback(
    (id: string | null) => {
      lit.current = id;
      draw();
    },
    [draw],
  );

  return {
    view,
    data,
    layout,
    canvasRef,
    spiralRef,
    spiralLabelsRef,
    labelsRef,
    draw,
    switchTo,
    setLit,
  };
}
