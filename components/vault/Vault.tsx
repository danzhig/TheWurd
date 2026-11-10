'use client';

import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import {
  zoom as d3zoom,
  zoomIdentity,
  zoomTransform,
  type ZoomBehavior,
  type ZoomTransform,
} from 'd3-zoom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { SettingsSheet } from '@/components/ui/SettingsSheet';
import { camera, easeCamera, prefersReducedMotion } from '@/lib/camera';
import { animationsOn, bookIn, bookOut, END_EVENT, transition } from '@/lib/transition';
import { CHANGE_EVENT, readLast, readProgress } from '@/lib/store';
import { GROUP_ORDER, type VaultData } from './data';
import { layoutVault, type Medallion } from './layout';
import styles from './vault.module.css';

export interface VaultBook {
  id: string;
  name: string;
  tagline: string;
  taglineDraft?: boolean;
  group: string;
  inPlan: boolean;
  stops: string[]; // section ids that count toward progress
  minutes: number;
}

export interface VaultProps {
  data: VaultData;
  books: VaultBook[];
  bridges: { id: string; title: string; after: string }[];
  sections: Record<string, { title: string; bookId: string }>;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

/** Reader state as a stable string: last section | completed ids. */
function useReaderKey(): string {
  return useSyncExternalStore(
    subscribe,
    () => `${readLast()?.sectionId ?? ''}|${Object.keys(readProgress()).sort().join(',')}`,
    () => '|',
  );
}

const FLY_MS = 850;
const K_MAX = 2.6; // medallion detail

export function Vault({ data, books, bridges, sections }: VaultProps) {
  const router = useRouter();
  const viewRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cloudRefs = useRef<(HTMLDivElement | null)[]>([]);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const selRef = useRef<Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  const baseRef = useRef<ZoomTransform>(zoomIdentity);
  const pointer = useRef({ x: 0, y: 0 });
  const [kq, setKq] = useState(0); // zoom, quantised: labels update only when it crosses a step
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Book transitions: the ceiling dims behind a flying book; the medallion it left is hidden.
  // Start dimmed when a book is on its way home (closed on its page, or via the back button).
  const [dimmed, setDimmed] = useState(
    () =>
      typeof window !== 'undefined' &&
      (transition.pending?.kind === 'book-out' || (!!camera.fromBook && animationsOn())),
  );
  const [lifted, setLifted] = useState<string | null>(null);

  const readerKey = useReaderKey();
  const [lastSection, doneList] = readerKey.split('|');
  const done = useMemo(() => new Set((doneList ?? '').split(',').filter(Boolean)), [doneList]);

  const layout = useMemo(
    () => layoutVault(data.path, data.bridges, data.satellites, data.offpath, GROUP_ORDER),
    [data],
  );
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const placed = useMemo(
    () => [...layout.medallions, ...layout.satellites] as Medallion[],
    [layout],
  );

  const currentBook = lastSection ? sections[lastSection]?.bookId : undefined;
  const currentMedallion = layout.medallions.find((m) => m.id === currentBook);
  const sparkAt = currentMedallion ?? layout.medallions[0]!;

  // ---------------------------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------------------------

  const apply = useCallback((t: ZoomTransform) => {
    const scene = sceneRef.current;
    const view = viewRef.current;
    if (!scene || !view) return;
    scene.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
    const cx = view.clientWidth / 2;
    const cy = view.clientHeight / 2;
    cloudRefs.current.forEach((el, i) => {
      if (!el) return;
      const depth = [0.03, 0.06, 0.1][i]!;
      const px = (t.x - cx) * depth + pointer.current.x * (i + 1) * 6;
      const py = (t.y - cy) * depth + pointer.current.y * (i + 1) * 6;
      el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    });
    const q = Math.round(Math.log2(t.k) * 6) / 6;
    setKq((prev) => (prev === q ? prev : q));
  }, []);

  const fit = useCallback((): ZoomTransform => {
    const view = viewRef.current!;
    const w = view.clientWidth;
    const h = view.clientHeight;
    const k = Math.min(w, h) / (2 * layout.spiralRadius + 24);
    return zoomIdentity.translate(w / 2, h / 2).scale(k);
  }, [layout.spiralRadius]);

  const target = useCallback((p: { x: number; y: number }, k: number): ZoomTransform => {
    const view = viewRef.current!;
    return zoomIdentity
      .translate(view.clientWidth / 2 - p.x * k, view.clientHeight / 2 - p.y * k)
      .scale(k);
  }, []);

  /** Animate the camera; resolves when it lands (immediately under reduced motion). */
  const flyTo = useCallback((t: ZoomTransform, ms = FLY_MS): Promise<void> => {
    const sel = selRef.current;
    const z = zoomRef.current;
    if (!sel || !z) return Promise.resolve();
    if (prefersReducedMotion() || ms === 0) {
      z.transform(sel, t);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      sel
        .transition()
        .duration(ms)
        .ease(easeCamera)
        .call(z.transform, t)
        .on('end interrupt', () => resolve());
    });
  }, []);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const sel = select(view);
    const minK = () => Math.min(view.clientWidth, view.clientHeight) / (2 * layout.radius);
    const z = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([minK(), K_MAX])
      .filter((e: Event) => !(e.type === 'dblclick') && !(e as MouseEvent).button)
      .on('start', () => sceneRef.current?.classList.add(styles.moving!))
      .on('zoom', (e: { transform: ZoomTransform }) => apply(e.transform))
      .on('end', (e: { transform: ZoomTransform }) => {
        sceneRef.current?.classList.remove(styles.moving!);
        camera.last = { x: e.transform.x, y: e.transform.y, k: e.transform.k };
      });
    zoomRef.current = z;
    selRef.current = sel;
    sel.call(z);
    baseRef.current = fit();

    // Start where the reader last left the ceiling (or fitted to the screen).
    const resume = camera.last
      ? zoomIdentity.translate(camera.last.x, camera.last.y).scale(camera.last.k)
      : baseRef.current;
    z.transform(sel, resume);

    // Coming back from a book: its closed book shrinks back into this medallion (lib/transition).
    transition.medallionRect = (bookId) => {
      const el = sceneRef.current?.querySelector<HTMLElement>(`a[data-book="${bookId}"]`);
      if (!el) return null;
      setDimmed(false); // the ceiling brightens as the book flies home
      return el.getBoundingClientRect();
    };
    const back = camera.fromBook;
    camera.fromBook = null;
    if (back && transition.pending?.kind !== 'book-out' && animationsOn()) {
      // Arrived by the browser's back button: the book was not closed on its page, so close it here.
      const b = byId.get(back);
      if (b) void bookOut(back, b.name, b.tagline, null);
    }
    setReady(true);
    document.documentElement.dataset.vault = 'ready';

    const onResize = () => {
      baseRef.current = fit();
      z.scaleExtent([minK(), K_MAX]);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      sel.on('.zoom', null);
      transition.medallionRect = null;
    };
    // Layout changes (Job moved) re-run this so the camera fits the new spiral.
  }, [apply, byId, fit, flyTo, layout.radius, placed, target]);

  // Parallax against the pointer (off under reduced motion).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || prefersReducedMotion()) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      pointer.current = {
        x: e.clientX / view.clientWidth - 0.5,
        y: e.clientY / view.clientHeight - 0.5,
      };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        apply(zoomTransform(view));
      });
    };
    view.addEventListener('pointermove', onMove);
    return () => {
      view.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [apply]);

  // Whatever happens to a transition, the ceiling ends up bright.
  useEffect(() => {
    const undim = () => setDimmed(false);
    window.addEventListener(END_EVENT, undim);
    return () => window.removeEventListener(END_EVENT, undim);
  }, []);

  // The off-path tooltip closes on Escape or a click elsewhere.
  useEffect(() => {
    if (!tip) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && (e.target as HTMLElement).closest('[data-offpath]')) return;
      setTip(null);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [tip]);

  // ---------------------------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------------------------

  const openBook = useCallback(
    async (id: string) => {
      const m = placed.find((x) => x.id === id);
      const view = viewRef.current;
      if (!m || !view || mode === 'list' || prefersReducedMotion()) {
        router.push(`/book/${id}/`);
        return;
      }
      // The medallion becomes a closed book that lifts off and flies to the centre, where the
      // book's page opens it. The ceiling dims and leans in only slightly behind it.
      const el = sceneRef.current?.querySelector<HTMLElement>(`a[data-book="${id}"]`);
      const b = byId.get(id);
      if (!el || !b) return router.push(`/book/${id}/`);
      const now = zoomTransform(view);
      const before = { x: now.x, y: now.y, k: now.k };
      setLifted(id);
      setDimmed(true);
      await Promise.all([
        flyTo(target(m, now.k * 1.12), 700),
        bookIn(id, b.name, b.tagline, el.getBoundingClientRect()),
      ]);
      // The lean-in is only a gesture: coming back, the ceiling returns to where it was.
      camera.last = before;
      router.push(`/book/${id}/`);
    },
    [byId, flyTo, mode, placed, router, target],
  );

  const continueReading = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const k = Math.max(baseRef.current.k * 1.8, 0.9);
    void flyTo(target(sparkAt, Math.min(k, K_MAX)));
  }, [flyTo, sparkAt, target]);

  // Zoom buttons build on the previous click's target, so quick taps add up.
  const pendingK = useRef<number | null>(null);
  const zoomBy = (f: number) => {
    const sel = selRef.current;
    const z = zoomRef.current;
    const view = viewRef.current;
    if (!sel || !z || !view) return;
    const [lo, hi] = z.scaleExtent();
    const k = Math.min(hi, Math.max(lo, (pendingK.current ?? zoomTransform(view).k) * f));
    pendingK.current = k;
    sel
      .transition()
      .duration(prefersReducedMotion() ? 0 : 250)
      .call(z.scaleTo, k)
      .on('end', () => {
        pendingK.current = null;
      });
  };

  // Keyboard: arrows move focus along the spiral (the list links), and the camera follows.
  const listRef = useRef<HTMLOListElement>(null);
  const onListKey = (e: React.KeyboardEvent<HTMLOListElement>) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const links = [
      ...(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-book], a[data-bridge]') ??
        []),
    ];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      links[
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? Math.min(links.length - 1, i + 1)
          : Math.max(0, i - 1)
      ];
    next?.focus();
  };
  const onListFocus = (id: string | null) => {
    setFocused(id);
    if (!id || mode !== 'map') return;
    const p = placed.find((m) => m.id === id) ?? layout.bridges.find((b) => b.id === id);
    const view = viewRef.current;
    if (p && view)
      void flyTo(target(p, Math.max(zoomTransform(view).k, baseRef.current.k * 1.6)), 450);
  };

  // ---------------------------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------------------------

  const k = 2 ** kq;
  const progressOf = (b: VaultBook) =>
    b.stops.length ? b.stops.filter((s) => done.has(s)).length / b.stops.length : 0;
  const lastMedallion = sections[lastSection ?? ''];
  const tipBook = tip ? byId.get(tip.id) : null;

  return (
    <div className={styles.vault} data-mode={mode}>
      <header className={styles.hud}>
        <h1 className={styles.title}>Scripture as Story</h1>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={continueReading}
            disabled={mode === 'list'}
            data-testid="continue"
          >
            Continue
          </button>
          <button
            type="button"
            className={styles.button}
            aria-pressed={mode === 'list'}
            onClick={() => setMode((m) => (m === 'map' ? 'list' : 'map'))}
          >
            {mode === 'map' ? 'List' : 'Map'}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setSettingsOpen(true)}
            aria-label="Reading settings"
          >
            Aa
          </button>
        </div>
        {lastMedallion ? (
          <Link href={`/read/${lastSection}/`} className={styles.resume} data-testid="resume">
            Resume · {lastMedallion.title}
          </Link>
        ) : (
          <Link href="/read/gen-01/" className={styles.resume} data-testid="resume">
            Begin · {sections['gen-01']?.title}
          </Link>
        )}
        <nav className={styles.links} aria-label="More">
          <Link href="/path/" data-testid="path-link">
            The path
          </Link>
          <Link href="/about/" data-testid="about-link">
            About
          </Link>
          <Link href="/sources/" data-testid="sources-link">
            Sources
          </Link>
        </nav>
      </header>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* The ceiling: decorative for assistive technology, which gets the list below. */}
      <div
        ref={viewRef}
        className={`vault-sky ${styles.view} ${ready ? styles.ready : ''} ${dimmed ? styles.dimmed : ''}`}
        aria-hidden="true"
        data-testid="vault-view"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            ref={(el) => {
              cloudRefs.current[i] = el;
            }}
            className={`cloud-layer ${['cloud-far', 'cloud-mid', 'cloud-near'][i]} ${styles.cloud}`}
          />
        ))}
        <div ref={sceneRef} className={styles.scene} data-testid="vault-scene">
          <svg
            className={styles.threadSvg}
            width={layout.radius * 2}
            height={layout.radius * 2}
            viewBox={`${-layout.radius} ${-layout.radius} ${layout.radius * 2} ${layout.radius * 2}`}
            style={{ left: -layout.radius, top: -layout.radius }}
          >
            <path d={layout.thread} className={styles.thread} />
            <path d={layout.threadUpTo(sparkAt.along)} className={styles.threadLit} />
            {layout.detours.map((t) => (
              <path key={t.id} d={t.d} className={styles.detour} data-detour={t.id} />
            ))}
          </svg>
          {layout.groups.map((g) => (
            <span key={g.label} className={styles.group} style={{ left: g.x, top: g.y }}>
              {g.label}
            </span>
          ))}
          {layout.offpath.map((o) => {
            const b = byId.get(o.id)!;
            return (
              <button
                key={o.id}
                type="button"
                tabIndex={-1}
                className={styles.offpath}
                style={{
                  left: o.x - o.size / 2,
                  top: o.y - o.size / 2,
                  width: o.size,
                  height: o.size,
                }}
                data-offpath={o.id}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTip({ id: o.id, x: r.left + r.width / 2, y: r.top });
                }}
              >
                {k * o.size >= 40 ? b.name : ''}
              </button>
            );
          })}
          {layout.bridges.map((br) => {
            const b = bridges.find((x) => x.id === br.id)!;
            return (
              <a
                key={br.id}
                href={`/bridge/${br.id}/`}
                tabIndex={-1}
                className={`${styles.star} ${focused === br.id ? styles.focused : ''}`}
                style={{ left: br.x, top: br.y }}
                data-bridge={br.id}
                title={b.title}
              >
                ✦
              </a>
            );
          })}
          {placed.map((m) => {
            const b = byId.get(m.id)!;
            const screenW = m.w * k;
            const p = progressOf(b);
            return (
              <a
                key={m.id}
                href={`/book/${m.id}/`}
                tabIndex={-1}
                data-book={m.id}
                className={[
                  styles.medallion,
                  screenW >= 56 ? styles.named : '',
                  screenW >= 150 ? styles.detailed : '',
                  focused === m.id ? styles.focused : '',
                  m.id === currentBook ? styles.current : '',
                  p >= 1 ? styles.finished : '',
                  lifted === m.id ? styles.lifted : '',
                ].join(' ')}
                style={{
                  left: m.x - m.w / 2,
                  top: m.y - m.h / 2,
                  width: m.w,
                  height: m.h,
                  ['--p' as string]: p,
                  ['--fs' as string]: `${Math.max(11, m.w * 0.17)}px`,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  void openBook(m.id);
                }}
              >
                <span className={styles.name}>{b.name}</span>
                {screenW >= 150 ? <span className={styles.tag}>{b.tagline}</span> : null}
              </a>
            );
          })}
          <span
            className={styles.spark}
            style={{ left: sparkAt.x, top: sparkAt.y - sparkAt.h / 2 - 10 }}
          />
        </div>
      </div>

      {mode === 'map' ? (
        <div className={styles.zoomButtons}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => zoomBy(1.5)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => zoomBy(1 / 1.5)}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      ) : null}

      {tipBook ? (
        <div
          role="dialog"
          aria-label={tipBook.name}
          className={styles.tooltip}
          style={{ left: tip!.x, top: tip!.y }}
          data-testid="offpath-tip"
          onClick={() => setTip(null)}
        >
          <p className="book-name">{tipBook.name}</p>
          <p className="tagline">{tipBook.tagline}</p>
          <p className={styles.notOnPath}>Not on this path.</p>
        </div>
      ) : null}

      {/* The same content as an ordered list (PLAN §9 accessibility). Visible in List mode. */}
      <section
        className={mode === 'list' ? styles.list : 'visually-hidden'}
        aria-label="The path, as a list"
      >
        <ol ref={listRef} onKeyDown={onListKey} className={styles.pathList}>
          {data.path.map((p) => {
            const b = byId.get(p.id)!;
            const bridge = bridges.find((x) => x.after === p.id);
            const sat = data.satellites.filter((s) => s.of === p.id);
            const read = b.stops.filter((s) => done.has(s)).length;
            return [
              <li key={p.id}>
                <Link
                  href={`/book/${p.id}/`}
                  data-book={p.id}
                  onFocus={() => onListFocus(p.id)}
                  onBlur={() => onListFocus(null)}
                  onClick={(e) => {
                    if (mode === 'map') {
                      e.preventDefault();
                      void openBook(p.id);
                    }
                  }}
                >
                  <span className="book-name">{b.name}</span>
                </Link>
                <span className={styles.listMeta}>
                  {' '}
                  — {b.tagline} · {read} of {b.stops.length} read
                  {p.id === currentBook ? ' · you are here' : ''}
                </span>
                {sat.map((s) => (
                  <p key={s.id} className={styles.listSat}>
                    Optional detour:{' '}
                    <Link
                      href={`/book/${s.id}/`}
                      data-book={s.id}
                      onFocus={() => onListFocus(s.id)}
                      onBlur={() => onListFocus(null)}
                    >
                      {byId.get(s.id)!.name}
                    </Link>
                  </p>
                ))}
              </li>,
              bridge ? (
                <li key={bridge.id} className={styles.listBridge}>
                  <Link
                    href={`/bridge/${bridge.id}/`}
                    data-bridge={bridge.id}
                    onFocus={() => onListFocus(bridge.id)}
                    onBlur={() => onListFocus(null)}
                  >
                    Bridge · {bridge.title}
                  </Link>
                </li>
              ) : null,
            ];
          })}
        </ol>
        <h2 className={styles.listHeading}>Not on this path</h2>
        {GROUP_ORDER.map((g) => {
          const members = data.offpath.filter((o) => o.group === g);
          if (!members.length) return null;
          return (
            <div key={g}>
              <h3 className="label">{g}</h3>
              <ul className={styles.offList}>
                {members.map((o) => {
                  const b = byId.get(o.id)!;
                  return (
                    <li key={o.id} data-offpath-item={o.id}>
                      <span className="book-name">{b.name}</span> — {b.tagline}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
