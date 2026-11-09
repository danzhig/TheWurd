# Scripture as Story — agent guide

The full spec is `docs/PLAN.md`. The canonical reading plan is `content/plan/reading-plan.json`.

## Ground rules (from docs/PLAN.md section 1, verbatim)

1. `reading-plan.json` is canonical. Never add, drop or move a reading range without David's explicit approval. If a range fails to resolve or its anchor check fails, stop and report; do not "fix" it silently.
2. Never write, paraphrase or reconstruct scripture from memory. Every verse shown comes from a source file listed in section 3, processed at build time.
3. Never type a Hebrew, Aramaic, Greek or Latin word from memory. Every original-language form is pulled from tagged source data and carries a citation to its row.
4. Static-first: no server code, no database, no accounts in Phases 1–2. Client state lives in `localStorage` only.
5. Use only sources and fonts with the licenses listed in section 3, and credit every one on the `/sources` page.
6. Ask before adding a dependency outside the stack in section 4.
7. Work milestone by milestone (section 11). A milestone is done only when its acceptance checks pass; commit and open a PR per milestone.

## Stack (docs/PLAN.md section 4)

| Concern           | Choice                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework         | Next.js (App Router), `output: 'export'`, TypeScript strict                                                          |
| Package manager   | pnpm                                                                                                                 |
| Styling           | CSS Modules plus design tokens as CSS custom properties; no component kit                                            |
| Motion            | `motion` (Framer Motion); View Transitions API as an enhancement; honour `prefers-reduced-motion`                    |
| Map pan and zoom  | `d3-zoom`                                                                                                            |
| Content scripts   | Node with `tsx`, `zod` schemas, a small custom USFM parser; run with `pnpm content:build`, never in the Vercel build |
| Tests             | Vitest (pipeline, plan integrity), Playwright (e2e at 390×844 and 1440×900), `@axe-core/playwright`                  |
| Offline (Phase 2) | Web app manifest plus a service worker                                                                               |
| Search (Phase 2)  | Pagefind                                                                                                             |

## Commands

| Command                                              | What it does                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                       | Install dependencies                                                                                                                                                                                                            |
| `pnpm dev`                                           | Next.js dev server                                                                                                                                                                                                              |
| `pnpm build`                                         | Static export to `out/` (this is what Vercel runs)                                                                                                                                                                              |
| `pnpm start`                                         | Serve `out/` on http://localhost:4173                                                                                                                                                                                           |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | ESLint, `tsc --noEmit`, Prettier                                                                                                                                                                                                |
| `pnpm test`                                          | Vitest: pipeline unit tests and plan integrity checks against committed `public/data`                                                                                                                                           |
| `pnpm e2e`                                           | Playwright against the built `out/` (run `pnpm build` first)                                                                                                                                                                    |
| `pnpm content:fetch`                                 | Download pinned sources into `sources/raw/` and verify checksums from `sources/manifest.json`                                                                                                                                   |
| `pnpm content:build`                                 | Full pipeline: fetch → parse USFM → map versification → resolve plan → validate → emit `public/data/` and the review docs. Fails loudly on any coverage gap, overlap or anchor failure, and then leaves `public/data` untouched |
| `pnpm content:build --out <dir>`                     | Same, but writes the data to `<dir>` even when checks fail (for inspection only)                                                                                                                                                |
| `pnpm content:check`                                 | Rebuild in a temp dir and fail if committed `public/data` differs (runs in CI)                                                                                                                                                  |
| `pnpm tokens`                                        | Regenerate `styles/tokens.css` from `lib/design/tokens.ts` (a test fails if they drift)                                                                                                                                         |
| `pnpm fonts`                                         | Rebuild `public/fonts/` from the pinned google/fonts files (needs python3 with `fonttools` and `brotli`)                                                                                                                        |
| `pnpm textures`                                      | Re-render `public/textures/` cloud and grain layers (needs Playwright's Chromium and python3 with Pillow 11+)                                                                                                                   |

Behind an HTTPS proxy (e.g. Claude Code cloud sessions), prefix network commands with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it.

## Content pipeline notes

- Sources are pinned in `sources/manifest.json` (URL + SHA-256). Raw downloads live in `sources/raw/` (gitignored). Generated data in `public/data/` is committed so Vercel never runs the pipeline.
- Plan references use Catholic (Hebrew-based, NABRE) numbering. WEBC uses English numbering for the protocanonical OT. `scripts/map-versification.ts` maps Hebrew → English with STEPBible TVTMS and proves which column WEBC follows using TVTMS's own tests. Every renumbering is logged in `docs/versification-log.md`.
- Esther and Daniel are mapped by content using `content/plan/structure-maps.json`, approved by David on 2026-11-06; see `docs/esther-daniel-map.md`. Each book's approval carries a fingerprint of its mapping: any edit fails the build until David approves it again.
- Reader display (PLAN.md D10): verse numbers beside the text are WEBC's (`Verse.c`/`Verse.v`); the page header shows the plan reference (`range`), with a short note when it differs from `webcRange`.
- Anchor failures and unresolved ranges are reported in `docs/pipeline-report.md` and fail `pnpm content:build`. They are never "fixed" by editing the plan.
- A WEBC verse that holds two plan verses in different sections (a "split verse"), or that has no Hebrew counterpart (an "orphan"), is placed by a fixed rule and must be approved in `content/plan/decisions.json`; an unapproved or stale placement stops the build. They are listed under "Verse placements" in `docs/versification-log.md`.
- Text changes the pipeline makes, all reported: footnote callers are removed (kept as footnotes); where a caller sat between two words with no space, one space is inserted. Nothing else in the WEBC text is altered.
- Section files store each verse as paragraph/poetry `blocks`; the plain text is `verseText(v)` in `lib/types.ts` (blocks joined by single spaces). Footnote and words-of-Jesus offsets index into that string.

## Design system notes (M2)

- `lib/design/tokens.ts` is the single source for colours, type, sizes and motion; `styles/tokens.css` is generated from it. Use the semantic tokens (`--bg`, `--surface`, `--text`, `--text-strong`, `--text-muted`, `--accent`, `--accent-strong`, `--link`, `--alert`, `--rule`, `--rule-soft`) for text, never raw palette colours.
- Every text colour on every background in both themes must meet WCAG AA 4.5:1; `tests/unit/contrast.test.ts` enforces it. Where a plan colour fails as text, `DERIVED` holds a same-hue shade; the plan colour is still used for hairlines, the thread and fills.
- Themes: `data-theme="vault" | "vellum"` on any element scopes the tokens. The setting in `lib/store.ts` is `default` (Vault on maps, Vellum under `/read`), `vault`, `vellum` or `auto`; `lib/theme.ts` applies it before first paint and `components/ui/ThemeController.tsx` keeps it current.
- All client state goes through `lib/store.ts` (`sas:v1:` keys, every access in try/catch, in-memory fallback when storage is blocked).
- Fonts are subset from upstream with `smcp` and `onum` kept: use `font-variant-caps: small-caps` (book names) or `all-small-caps` (labels), and `oldstyle-nums` in prose. Hebrew and Greek fonts come in Phase 3.
- `/styleguide` shows every token, contrast ratio, type style, reader part and material; its sample scripture is read from `public/data`, never typed.

## Reader notes (M3)

- Routes: `/read/[sectionId]` for all 252 sections and `/bridge/[bridgeId]` for the four bridges, all pre-rendered from `public/data` (`lib/data.ts`).
- `lib/path.ts` defines the path: book steps expand to `read` and `skim` sections (stops), `optional` sections and the John 11 excursion only when optional sections are on, never `skip`; bridges are stops; Job follows the book chosen in settings. Pages render the default path; `components/reader/ReaderShell.tsx` recomputes Previous/Next on the client when the reader's settings differ.
- `components/reader/SectionBody.tsx` renders folds as `<details>` (inner folds and whole-section skim/skip), notes at `start`, `end`, `fold` or before their verse (a paragraph is divided at the verse if needed), and the translator footnotes.
- Progress: a stop completes when its end scrolls into view or on "Mark as read"; whole-section skims count when opened. `last` records the section and top visible verse for "Continue".
- e2e: `tests/e2e/reader.spec.ts` walks Next from Genesis 1 to Acts 28 against an order computed independently from `reading-plan.json`. Tests wait for `html[data-reader]` (set after hydration) before using the keyboard.

## Book map notes (M4)

- `/book/[bookId]` for the 24 plan books. The server renders an ordered list of stations (works without JavaScript); `components/book-map/BookMap.tsx` positions them with `layout.ts` once it knows the width: a serpentine (rows alternate direction, half-ellipse turns wide enough to clear labels) from 720 px, a gentle meander below.
- Marks: read = gilt disc, skim = hollow ring, skip = faint fold on the line, optional = dashed ring on a dashed branch; highlights glow; completed stations show a tick; the last-read section has the vermilion spark.
- Station links take their visible title and range as their accessible name (axe `label-content-name-mismatch`); extra detail is visually hidden. On phones the range is visually hidden until tap-and-hold.
- The cover (`BookCover.tsx`) is server-rendered and plays from CSS on a fresh load; returning to a map opened earlier in the session hides it before paint. Reduced motion: a 150 ms fade.
- Returning from a section (browser back or the reader's up link / Esc) restores the map's scroll position, kept in memory for the session. Tests wait for `html[data-book-map]`.
- The home page is a temporary list of the plan's books until the Vault (M5).
