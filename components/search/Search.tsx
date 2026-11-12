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
  filters?: { part?: string[] };
}
interface Row extends ResultData {
  id: string;
  href: string;
}

const PAGE = 20;
let pagefind: Promise<Pagefind> | null = null;
let attempt = 0;
function loadPagefind(): Promise<Pagefind> {
  // Built by `pagefind` after `next build` (see package.json); loaded only on this page. A failed
  // module import is remembered by the browser, so a retry asks for it under a fresh address.
  const url = attempt ? `/pagefind/pagefind.js?retry=${attempt}` : '/pagefind/pagefind.js';
  pagefind ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url).then(
    async (pf: Pagefind) => {
      await pf.options({ excerptLength: 22 });
      return pf;
    },
  );
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

/** Where to search (P5.4): everything (the path first, then the library), or one of them. */
type Scope = 'all' | 'path' | 'library';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'path', label: 'The path' },
  { id: 'library', label: 'The library' },
];
const readScope = (v: string | null): Scope => (v === 'path' || v === 'library' ? v : 'all');

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
  const [scope, setScope] = useState<Scope>('all');
  const scopeRef = useRef<Scope>('all');
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
    const where = scopeRef.current;
    if (where === 'all') url.searchParams.delete('in');
    else url.searchParams.set('in', where);
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
          // Results in path order, then the library in canonical order: each page carries its
          // position as the `order` sort key, and `part` (path or library) as a filter.
          const res = await pf.search(q, {
            sort: { order: 'asc' },
            ...(where === 'all' ? {} : { filters: { part: where } }),
          });
          if (token !== run.current) return;
          all.current = res.results;
          setTotal(res.results.length);
          await loadMore(q, 0, token);
        } catch (err) {
          // Keep the cause visible in the console; the page says what the reader can do.
          console.error('Search failed to load', err);
          if (token === run.current) setTotal(-1);
          pagefind = null; // let the next attempt load it afresh
          attempt++;
        }
      },
      q ? 180 : 0,
    );
  };

  // Start from ?q= so searches can be linked and survive Back.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') ?? '';
    scopeRef.current = readScope(params.get('in'));
    setScope(scopeRef.current);
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
        <span className="label">Search the Bible</span>
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
      <fieldset className={styles.scope} data-testid="search-scope">
        <legend className="visually-hidden">Search in</legend>
        {SCOPES.map((o) => (
          <label key={o.id} className={styles.scopeOption}>
            <input
              type="radio"
              name="scope"
              value={o.id}
              checked={scope === o.id}
              onChange={() => {
                scopeRef.current = o.id;
                setScope(o.id);
                schedule(input.current?.value ?? '');
              }}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <p className={styles.count} role="status" aria-live="polite" data-testid="search-count">
        {total === -1
          ? typeof navigator !== 'undefined' && !navigator.onLine
            ? 'You are offline. Search needs a connection.'
            : 'Search could not load. Please try again.'
          : total === null
            ? ''
            : total === 0
              ? 'No sections match.'
              : `${total} ${total === 1 ? 'section' : 'sections'}, ${
                  scope === 'library'
                    ? 'in Bible order'
                    : scope === 'path'
                      ? 'in path order'
                      : 'the path first, then the library'
                }`}
      </p>
      {total === -1 ? (
        <button
          type="button"
          className={styles.more}
          onClick={() => schedule(input.current?.value ?? '')}
          data-testid="search-retry"
        >
          Try again
        </button>
      ) : null}
      <ol className={styles.results} data-testid="search-results">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={r.href} className={styles.result} data-result={r.url}>
              <span className={styles.where}>
                {r.meta.book}
                {r.meta.range ? ` ${r.meta.range.replace(/;/g, ',')}` : ''}
                {r.meta.status && STATUS[r.meta.status] ? ` · ${STATUS[r.meta.status]}` : ''}
                {r.filters?.part?.includes('library') ? ' · library' : ''}
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
