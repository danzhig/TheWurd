/**
 * The Themes view's stars, drawn on one canvas in screen space (PLAN §16, P6.3). Hundreds of
 * passages as DOM nodes would break the Vault's 300-node budget and its frame rate on phones, so
 * the stars are pixels; only the focused constellation's passages get DOM links (see Vault.tsx).
 * Path passages glow gold; library passages are paler.
 */
import type { Point } from './layout';
import { FLY_FROM, FLY_TO, flightT, starAt, type ThemesLayout } from './constellations';

export interface Cam {
  x: number;
  y: number;
  k: number;
}

export interface DrawOptions {
  /** Flight progress: 0 = every star at home in its book, 1 = in its constellation. */
  p: number;
  /** Reduced motion: stars stay in their constellations and fade in with `p` instead of flying. */
  fade: boolean;
  /** The sub-theme whose stars are lit up (hovered or focused), if any. */
  lit: string | null;
  /** Which way the flight is going: +1 out to the constellations, −1 home to the books. */
  dir?: 1 | -1;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class StarField {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private gold = '#e7c873';
  private pale = '#c9c3b4';
  private glow: HTMLCanvasElement;

  constructor(
    private canvas: HTMLCanvasElement,
    private layout: ThemesLayout,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const css = getComputedStyle(canvas);
    this.gold = css.getPropertyValue('--gold-light').trim() || this.gold;
    this.pale = css.getPropertyValue('--cloud').trim() || this.pale;
    // One soft glow, drawn once and stamped under every path star.
    this.glow = document.createElement('canvas');
    this.glow.width = this.glow.height = 32;
    const g = this.glow.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, this.gold);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.globalAlpha = 0.55;
    g.fillRect(0, 0, 32, 32);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Where each star is at progress p (world units); also used by tests through the Vault. */
  positions(p: number, fade: boolean): Point[] {
    return this.layout.stars.map((s) => (fade ? { x: s.x, y: s.y } : starAt(s, p)));
  }

  draw(cam: Cam, o: DrawOptions): void {
    const { ctx } = this;
    this.clear();
    if (o.p <= 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const X = (x: number) => cam.x + x * cam.k;
    const Y = (y: number) => cam.y + y * cam.k;
    // Reduced motion: everything in place, fading. Otherwise the stars appear as the bubbles
    // shrink away (and vanish into them on the way home), and the lines draw in once they land.
    const starsAlpha = o.fade ? o.p : smooth(0.02, FLY_FROM, o.p);
    const lines = (o.fade ? o.p : smooth(FLY_TO, 1, o.p)) * 0.5;
    const flying = !o.fade && o.p > FLY_FROM && o.p < FLY_TO;
    const dir = o.dir ?? 1;

    if (lines > 0) {
      ctx.strokeStyle = this.gold;
      ctx.lineWidth = 1;
      ctx.globalAlpha = lines;
      ctx.beginPath();
      for (const c of this.layout.constellations)
        for (const [a, b] of c.lines) {
          ctx.moveTo(X(a.x), Y(a.y));
          ctx.lineTo(X(b.x), Y(b.y));
        }
      ctx.stroke();
      // Closer in, faint spokes from each star to its sub-theme.
      if (cam.k >= 1.6) {
        ctx.globalAlpha = lines * 0.35;
        ctx.beginPath();
        const subAt = new Map(
          this.layout.constellations.flatMap((c) => c.subs.map((s) => [s.id, s] as const)),
        );
        for (const s of this.layout.stars) {
          const c = subAt.get(s.subId)!;
          ctx.moveTo(X(c.x), Y(c.y));
          ctx.lineTo(X(s.x), Y(s.y));
        }
        ctx.stroke();
      }
    }

    // Where each star is now, in screen pixels.
    const n = this.layout.stars.length;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    this.layout.stars.forEach((s, i) => {
      const at = o.fade ? s : starAt(s, o.p);
      xs[i] = X(at.x);
      ys[i] = Y(at.y);
    });
    const shown = (i: number) =>
      xs[i]! > -20 && ys[i]! > -20 && xs[i]! < this.w + 20 && ys[i]! < this.h + 20;
    const r = Math.min(4, Math.max(1.3, 1.3 * cam.k));

    // A short, thin streak behind each star while it flies.
    if (flying) {
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const lib of [true, false]) {
        ctx.strokeStyle = lib ? this.pale : this.gold;
        ctx.globalAlpha = lib ? 0.25 : 0.4;
        ctx.beginPath();
        this.layout.stars.forEach((s, i) => {
          if (s.library !== lib || !shown(i)) return;
          const t = flightT(s, o.p);
          if (t <= 0 || t >= 1) return;
          const back = starAt(s, Math.min(1, Math.max(0, o.p - dir * 0.025)));
          ctx.moveTo(X(back.x), Y(back.y));
          ctx.lineTo(xs[i]!, ys[i]!);
        });
        ctx.stroke();
      }
    }

    // A small soft glow under each path star, then the stars themselves.
    ctx.globalAlpha = starsAlpha;
    this.layout.stars.forEach((s, i) => {
      if (s.library || !shown(i)) return;
      const g = r * (s.subId === o.lit ? 7 : 4.5);
      ctx.drawImage(this.glow, xs[i]! - g / 2, ys[i]! - g / 2, g, g);
    });
    for (const lib of [true, false]) {
      ctx.fillStyle = lib ? this.pale : this.gold;
      ctx.globalAlpha = starsAlpha * (lib ? 0.62 : 1);
      ctx.beginPath();
      this.layout.stars.forEach((s, i) => {
        if (s.library !== lib || !shown(i)) return;
        const rr = (lib ? 0.75 : 1) * r * (s.subId === o.lit ? 1.4 : 1);
        ctx.moveTo(xs[i]! + rr, ys[i]!);
        ctx.arc(xs[i]!, ys[i]!, rr, 0, Math.PI * 2);
      });
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
