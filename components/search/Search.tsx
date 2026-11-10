'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SectionFile } from '@/lib/types';
import { firstMatch } from './match';
import styles from './search.module.css';

/** The parts of Pagefind's browser API this page uses. */
interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  search: (
    q: string,
    o?: Record<string, unknown>,
  ) => Promise<{ results: { id: string; data: () => Promise<ResultData> }[] }>;
}
interface ResultData {
  url: string;
  excerpt: string;
  meta: { title?: string; book?: string; range?: string; status?: string };
}
interface Row extends ResultData {
  id: string;
  href: string;
}

const PAGE = 20;
let pagefind: Promise<Pagefind> | null = null;
function loadPagefind(): Promise<Pagefind> {
  // Built by `pagefind` after `next build` (see package.json); loaded only on this page.
  pagefind ??= import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ '/pagefind/pagefind.js' as string
  ).then(async (pf: Pagefind) => {
    await pf.options({ excerptLength: 22 });
    return pf;
  });
  return pagefind;
}

/** Where a result opens: its section, at the first verse that matches. */
async function hrefFor(url: string, query: string): Promise<string> {
  const id = url.match(/\/read\/([^/]+)\//)?.[1];
  if (!id) return url;
  try {
    const s = (await (await fetch(`/data/sections/${id}.json`)).json()) as SectionFile;
    const anchor = firstMatch(s.verses, query);
    return anchor ? `${url}#${anchor}` : url;
  } catch {
    return url;
  }
}

const STATUS: Record<string, string> = {
  skim: 'skim',
  optional: 'optional detour',
  skip: 'outside this reading',
  bridge: 'between the books',
};

export function Search() {
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const all = useRef<{ id: string; data: () => Promise<ResultData> }[]>([]);
  const run = useRef(0);
  const timer = useRef(0);

  const loadMore = async (q: string, from: number, token: number) => {
    setBusy(true);
    const slice = all.current.slice(from, from + PAGE);
    const loaded = await Promise.all(
      slice.map(async (r) => {
        const d = await r.data();
        return { ...d, id: r.id, href: await hrefFor(d.url, q) };
      }),
    );
    if (token !== run.current) return;
    setRows((prev) => (from === 0 ? loaded : [...prev, ...loaded]));
    setBusy(false);
  };

  /** Search after a short pause in typing; keeps ?q= in the address so results can be linked. */
  const schedule = (raw: string) => {
    const q = raw.trim();
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    window.history.replaceState(window.history.state, '', url);
    const token = ++run.current;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      async () => {
        if (!q) {
          setRows([]);
          setTotal(null);
          return;
        }
        try {
          const pf = await loadPagefind();
          // Results in path order: each page carries its position as the `order` sort key.
          const res = await pf.search(q, { sort: { order: 'asc' } });
          if (token !== run.current) return;
          all.current = res.results;
          setTotal(res.results.length);
          await loadMore(q, 0, token);
        } catch {
          if (token === run.current) setTotal(-1);
        }
      },
      q ? 180 : 0,
    );
  };

  // Start from ?q= so searches can be linked and survive Back.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q') ?? '';
    if (q && input.current) {
      input.current.value = q;
      schedule(q);
    }
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  return (
    <div className={styles.search}>
      <label className={styles.field}>
        <span className="label">Search the path</span>
        <input
          ref={input}
          type="search"
          onChange={(e) => schedule(e.target.value)}
          placeholder="A name, a place, a word"
          autoComplete="off"
          spellCheck={false}
          data-testid="search-input"
          autoFocus
        />
      </label>
      <p className={styles.count} role="status" aria-live="polite" data-testid="search-count">
        {total === -1
          ? 'Search is unavailable offline.'
          : total === null
            ? ''
            : total === 0
              ? 'No sections match.'
              : `${total} ${total === 1 ? 'section' : 'sections'}, in path order`}
      </p>
      <ol className={styles.results} data-testid="search-results">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={r.href} className={styles.result} data-result={r.url}>
              <span className={styles.where}>
                {r.meta.book}
                {r.meta.range ? ` ${r.meta.range.replace(/;/g, ',')}` : ''}
                {r.meta.status && STATUS[r.meta.status] ? ` · ${STATUS[r.meta.status]}` : ''}
              </span>
              <span className={styles.title}>{r.meta.title}</span>
              {/* Pagefind escapes the page text and adds <mark> around the matches. */}
              <span className={styles.excerpt} dangerouslySetInnerHTML={{ __html: r.excerpt }} />
            </Link>
          </li>
        ))}
      </ol>
      {total !== null && rows.length < total && total > 0 ? (
        <button
          type="button"
          className={styles.more}
          disabled={busy}
          onClick={() => void loadMore(input.current?.value.trim() ?? '', rows.length, run.current)}
        >
          Show more
        </button>
      ) : null}
    </div>
  );
}
