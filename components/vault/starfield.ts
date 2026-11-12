/**
 * The Themes view's stars, drawn on one canvas in screen space (PLAN §16, P6.3). Hundreds of
 * passages as DOM nodes would break the Vault's 300-node budget and its frame rate on phones, so
 * the stars are pixels; only the focused constellation's passages get DOM links (see Vault.tsx).
 * Path passages glow gold; library passages are paler.
 */
import type { Point } from './layout';
import { starAt, type ThemesLayout } from './constellations';

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
    const alpha = o.fade ? o.p : 1;

    // Hairlines between sub-themes, drawn in once the stars have nearly arrived.
    const lines = (o.fade ? o.p : smooth(0.72, 1, o.p)) * 0.5;
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

    const r = Math.min(5, Math.max(1.6, 1.5 * cam.k));
    const pos = this.positions(o.p, o.fade);
    // Glows first, then the stars over them.
    ctx.globalAlpha = alpha;
    this.layout.stars.forEach((s, i) => {
      if (s.library) return;
      const g = r * (s.subId === o.lit ? 7 : 5);
      ctx.drawImage(this.glow, X(pos[i]!.x) - g / 2, Y(pos[i]!.y) - g / 2, g, g);
    });
    for (const lib of [true, false]) {
      ctx.fillStyle = lib ? this.pale : this.gold;
      ctx.globalAlpha = alpha * (lib ? 0.62 : 1);
      ctx.beginPath();
      this.layout.stars.forEach((s, i) => {
        if (s.library !== lib) return;
        const rr = (lib ? 0.75 : 1) * r * (s.subId === o.lit ? 1.4 : 1);
        const x = X(pos[i]!.x);
        const y = Y(pos[i]!.y);
        if (x < -10 || y < -10 || x > this.w + 10 || y > this.h + 10) return;
        ctx.moveTo(x + rr, y);
        ctx.arc(x, y, rr, 0, Math.PI * 2);
      });
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
