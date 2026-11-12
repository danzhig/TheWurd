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
| Map pan and zoom  | `d3-zoom` (with its companions `d3-selection` and `d3-transition`)                                                   |
| Content scripts   | Node with `tsx`, `zod` schemas, a small custom USFM parser; run with `pnpm content:build`, never in the Vercel build |
| Tests             | Vitest (pipeline, plan integrity), Playwright (e2e at 390×844 and 1440×900), `@axe-core/playwright`                  |
| Offline (Phase 2) | Web app manifest plus a service worker                                                                               |
| Search (Phase 2)  | Pagefind                                                                                                             |

## Commands

| Command                                              | What it does                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                       | Install dependencies                                                                                                                                                                                                                                    |
| `pnpm dev`                                           | Next.js dev server                                                                                                                                                                                                                                      |
| `pnpm build`                                         | Static export to `out/`, then the Pagefind search index into `out/pagefind/` (this is what Vercel runs)                                                                                                                                                 |
| `pnpm start`                                         | Serve `out/` on http://localhost:4173                                                                                                                                                                                                                   |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | ESLint, `tsc --noEmit`, Prettier                                                                                                                                                                                                                        |
| `pnpm test`                                          | Vitest: pipeline unit tests and plan integrity checks against committed `public/data`                                                                                                                                                                   |
| `pnpm e2e`                                           | Playwright against the built `out/` (run `pnpm build` first)                                                                                                                                                                                            |
| `pnpm lighthouse`                                    | Lighthouse (mobile) on `/`, a book map, a section and `/path` against built `out/`; fails below performance 90 or accessibility 95 (runs in CI)                                                                                                         |
| `pnpm content:fetch`                                 | Download pinned sources into `sources/raw/` and verify checksums from `sources/manifest.json`                                                                                                                                                           |
| `pnpm library:propose <bookId>`                      | Write `docs/library/<bookId>-outline.md` from WEBC (chapters, verse counts, paragraph starts, opening words, where the plan's numbering differs) to draft that book's library sections from                                                             |
| `pnpm terms:fetch`                                   | Download and verify the Phase 3 sources (pipeline `terms` in `sources/manifest.json`): TAHOT, TAGNT, lexicons, morphology codes, Douay-Rheims, KJV, Brenton, Clementine Vulgate, Swete's Septuagint and Lewis & Short. Not run by `content:build` or CI |
| `pnpm terms:lookup <ref> [--ls]`                     | Print every Phase 3 layer for one verse (OSIS, English numbering, e.g. `Gen.1.2`): tagged words with lexicon and grammar, Septuagint, Vulgate, Douay-Rheims, KJV, Brenton, each with its source line                                                    |
| `pnpm content:build`                                 | Full pipeline: fetch → parse USFM → map versification → resolve plan → validate → emit `public/data/` and the review docs. Fails loudly on any coverage gap, overlap or anchor failure, and then leaves `public/data` untouched                         |
| `pnpm content:build --out <dir>`                     | Same, but writes the data and its reports to `<dir>` even when checks fail (for inspection only; never touches `docs/`)                                                                                                                                 |
| `pnpm content:check`                                 | Rebuild in a temp dir and fail if committed `public/data` differs (runs in CI)                                                                                                                                                                          |
| `pnpm tokens`                                        | Regenerate `styles/tokens.css` from `lib/design/tokens.ts` (a test fails if they drift)                                                                                                                                                                 |
| `pnpm fonts`                                         | Rebuild `public/fonts/` from the pinned google/fonts files (needs python3 with `fonttools` and `brotli`)                                                                                                                                                |
| `pnpm textures`                                      | Re-render `public/textures/` cloud and grain layers (needs Playwright's Chromium and python3 with Pillow 11+)                                                                                                                                           |

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
- `lib/path.ts` defines the path in the plan's order (Job after Genesis; there is no setting to move it): book steps expand to `read` and `skim` sections (stops), never `skip`; bridges are stops. `optional` sections and the John 11 excursion are detours: always shown on the maps, never a stop for Next. The page just before a detour offers it beside Next (`detour-link`), and the detour's own Previous/Next lead back onto the path. Detours count toward progress when read. There are no path settings; the settings sheet holds display options only.
- `components/reader/SectionBody.tsx` renders folds as `<details>` (inner folds and whole-section skim/skip), notes at `start`, `end`, `fold` or before their verse (a paragraph is divided at the verse if needed), and the translator footnotes.
- Progress: a stop completes when its end scrolls into view or on "Mark as read"; whole-section skims count when opened. `last` records the section and top visible verse for "Continue".
- e2e: `tests/e2e/reader.spec.ts` walks Next from Genesis 1 to Acts 28 against an order computed independently from `reading-plan.json`. Tests wait for `html[data-reader]` (set after hydration) before using the keyboard.

## Book map notes (M4)

- `/book/[bookId]` for the 24 plan books. The server renders an ordered list of stations (works without JavaScript); `components/book-map/BookMap.tsx` positions them with `layout.ts` once it knows the width: a serpentine (rows alternate direction, half-ellipse turns wide enough to clear labels) from 720 px, a gentle meander below.
- Marks: read = gilt disc, skim = hollow ring, skip = faint fold on the line, optional = dashed ring on a dashed branch; highlights glow; completed stations show a tick; the last-read section has the vermilion spark.
- Station links take their visible title and range as their accessible name (axe `label-content-name-mismatch`); extra detail is visually hidden. On phones the range is visually hidden until tap-and-hold.
- The book page is an open book: `.frame` holds the cover (`BookCover.tsx`) and cream `.pages` (a two-page spread from 900 px, where the serpentine uses an even number of columns so nothing sits on the fold; one page below). The cover is a single board hinged at the spine; it swings open only when the book arrives from the Vault (a direct visit or a return from a section shows the pages at once, as server-rendered, for a fast first paint) and closes before "All books" leaves. Its size comes from `lib/book-geometry.ts`, shared with the flying book. Reduced motion: the pages simply appear.
- Returning from a section (browser back or the reader's up link / Esc) restores the map's scroll position, kept in memory for the session. Tests wait for `html[data-book-map]`.

## Vault notes (M5)

- `/` is the Vault. `components/vault/layout.ts` (pure, unit-tested) places the plan books on an Archimedean spiral by arc length (Genesis on the rim, Acts at the oculus; widths 64–140 by log reading time), John 11 as a satellite inside Luke, bridges as stars in widened gaps, and the 49 off-path books on an outer ring grouped Law…Apocalypse.
- `components/vault/Vault.tsx`: `d3-zoom` drives one CSS transform on the scene plus parallax on three cloud layers; React re-renders only when zoom crosses a semantic-zoom step (names when a medallion is ≥ 56 px on screen, tagline and progress ring at ≥ 150 px). Keep the interactive layer under 300 nodes (a test checks).
- Accessibility: the ceiling is `aria-hidden` with `tabIndex=-1` links; the ordered list (`section[aria-label="The path, as a list"]`) is the accessible structure, visually hidden in map mode and shown by "List". Focusing a list link flies the camera there and rings the medallion; arrow keys move along the spiral.
- Transitions: see "Transitions" below. `lib/camera.ts` remembers the view (the lean-in while a book lifts off is not remembered). Reduced motion skips camera flights.
- John 11 hangs off Luke on a dashed branch (`layout.detours`), with a gap between the two medallions so the line shows.
- M6 pages, linked under Resume ("The path · About · Sources") and from each other's footers:
  - `/path`: every stop and detour as a timeline grouped by book (`components/path/timeline.ts`, unit-tested against `buildSequence`), with the map's marks and progress ticks from the store.
  - `/sources`: every source in the manifest with its license, attribution, use and version (an e2e test checks every id in `sources/manifest.json`).
- "About this path" (`/about`) explains the shape of the path. Every list, count and name comes from the manifest (`app/about/about.ts`, unit-tested); the prose never quotes scripture, and `ABOUT_GROUPS` needs a line for each off-path group (a test checks).
- Off-path taglines live in `content/plan/offpath-taglines.json` (approved by David on 2026-11-09); the pipeline requires one per off-path book.
- `tests/e2e/perf.spec.ts` times frames during a camera flight at phone size with the CPU slowed 4×, and checks LCP under 2.5 s on `/`, a book map and a section on a throttled phone (CPU 4×, slow 4G), serially, in its own Playwright project that runs alone after the others. Tests wait for `html[data-vault="ready"]`.

## Transitions

- `lib/transition.ts` drives the moves between levels on `#transition-layer` (root layout), which survives route changes; `transition.pending` tells the arriving page what to pick up. Only transform and opacity animate (Web Animations API), and every element is drawn at its final size and scaled down, never up.
- Vault → book: a closed book (`styles/book.css`, same markup as the page cover) lifts out of the medallion and lands exactly on the book page's cover, which takes over (`handoff`) and swings open. Book → Vault: the cover closes, the closed book draws back and shrinks into its medallion (the Vault registers `transition.medallionRect`); the browser's back button gets the same pull-back.
- Book → verses: a disc of the reader's paper colour grows from the tapped station, the reader fades it away (`reveal`). Back (up link or Esc): the paper covers the screen and shrinks into the station on the map.
- Reduced motion, or no `Element.animate`: plain navigation, nothing on the layer. Tests check the layer is empty after each transition.

## Phase 1 QA notes (M7)

- `tests/e2e/qa.spec.ts` sweeps every page type (storage blocked, axe, reduced motion, the journey there and back). It also runs as `android` (Pixel 7) locally, and in CI's `browsers` job on Firefox, desktop Safari (WebKit) and an iPhone profile (`ALL_BROWSERS=1`). Real-device steps are in `docs/qa-checklist.md`.
- Decorative textures (clouds, grain) load only once `html[data-textures]` is set after the `load` event (`ThemeController`), at opacity 0; when decoded it becomes `data-textures="on"` and they fade in. They never delay first paint or become the LCP element.
- Book map stations stay `visibility: hidden` until laid out (no layout shift); `<noscript>` shows them.
- Navigation never waits on an animation that may not finish: `settle()` in `lib/transition.ts` ends each wait at the animation's end plus 300 ms.

## Search notes (P2.3)

- `pnpm build` runs Pagefind over `out/`. Only elements with `data-pagefind-body` are indexed: the section `<article>` and the bridge card. Each carries `data-pagefind-sort="order:NNNN"` (its position in `buildSequence`, from `pathPosition` in `lib/nav.ts`) so results come back in path order; book and range are `data-pagefind-meta` on their own elements (book names can contain commas). Verse numbers, footnote callers, the footnote list and the reference line are ignored.
- Vercel deploys the whole `out/` folder as a static site (`vercel.json`: `framework: null`, `outputDirectory: out`). With the Next.js preset it published only Next's own output, so the Pagefind index (written to `out/pagefind/` after `next build`) was missing in production.
- `/search` (linked from the Vault) loads `/pagefind/pagefind.js` only on that page. Each result opens at the first verse that matches (`components/search/match.ts`, unit-tested), found in the section's JSON.

## Verse links and previews (P2.4)

- Verse numbers are `a.verse-link` to `#v-<c>-<v>` (WEBC numbering). `ReaderShell` turns a tap into "copy link" (clipboard, `replaceState` to the hash, a `role="status"` note); without JavaScript they are plain links. `[id^='v-']` has `scroll-margin-top` and a brief gold `:target` highlight.
- `app/read/[sectionId]/opengraph-image.tsx` renders one 1200×630 PNG per section at build time with `next/og`, using `content/og/cormorant-garamond-500.ttf` (a static Latin instance made by `pnpm fonts`; the renderer cannot read WOFF2 or variable fonts). The files have no extension, so `vercel.json` and `scripts/serve-static.mjs` serve them as `image/png`. `metadataBase` in `app/layout.tsx` comes from Vercel's URL variables.

## Polish and budget notes (P2.5)

- The zoom library (`d3-zoom`, `d3-selection`, `d3-transition`) is in `components/vault/d3.ts`, imported dynamically after first paint. The Vault places the camera itself (`Cam` = `{x, y, k}`, `camRef`) before it arrives, then hands over; `data-vault="ready"` is set once it has. Until then flights jump. Initial JS on `/` is checked under 150 KB gzipped in the perf project.
- Light rays (`.rays` in `vault.module.css`) sit in the scene at the spiral's centre and rotate once every 240 s; still under reduced motion.
- The cover swings with `HINGE_EASE`; `.book-cover-shade` darkens the face mid-turn and `.book-cover-cast` (`[data-cover-shadow]`, on the book page) lifts its shadow off the pages. Opacity only.
- A 12 ms `navigator.vibrate` tick when a stop completes during a visit (`ReaderShell`); none under reduced motion, and iOS Safari has no vibration.

## Phase 3 data notes (P3.1)

- Build order after Phase 2 (owner, 2026-11-10): Phase 5 (whole Bible), Phase 6 (themes), Phase 4 (connections), then Phase 3 (word depth) last. Its data step is on `main`; the reader work (P3.2: Depth toggle, card deck, `pnpm terms:build`) is saved in closed PR #15.

- Readers live in `scripts/terms/`: `stepbible.ts` (TAHOT/TAGNT tokens with verse, word index, Strong's, grammar, lemma and source line; TBESH/TBESG keyed by the extended number in column 2; TEHMC/TEGMC), `usfm-verses.ts` (eBible texts with notes and word markup removed), `lxx.ts`, `lewis-short.ts`; `sources.ts` loads them all.
- TAHOT refs are English numbering with the Hebrew in brackets (`Gen.31.55(32.1)`), so tokens line up with WEBC; `sourceRef` keeps the Hebrew. The Septuagint, Vulgate and Douay-Rheims follow their own numbering: `terms:lookup` also tries the Hebrew one, but check TVTMS before citing a parallel.
- Septuagint: text from the Swete TEI transcription (the Morpheus-analysed files drop words after marginal notes: 4–31% per book); lemmas only where a form matches. OCR slips exist, so Greek forms are checked against the printed Swete. CC BY-SA 4.0, as is Lewis & Short (D11): derived Greek and Latin word data is credited as CC BY-SA on `/sources`.
- Lewis & Short senses keep their Perseus ids (`n45053.0`); cards cite the id and quote only the definition words.
- Parser tests run on excerpts in `tests/fixtures/terms/` (cut by script from the sources, attributed in its README). `/sources` groups files from one work into one credit (`data-source` lists every id).

## Library notes (Phase 5)

- `content/plan/library.json` holds sections for books off the path (`LibrarySchema` in `lib/types.ts`), in the plan's numbering (Hebrew-based where the plan's is), all `status: "read"`. Each book needs an owner approval whose fingerprint matches its sections (ids, titles, ranges, statuses); the build prints the fingerprint and stops on any unapproved or edited book (`scripts/library.ts`).
- The build maps, resolves and coverage-checks library books exactly like path books (`resolveBook`), and emits their sections and `books/<id>.json`, flagged `library: true` on the book and each index entry. `inPlan` stays false: library books never join the path, the spiral or Next.
- Workflow per group (Law, Histories, Wisdom, Prophets, Gospels, Letters, Apocalypse): `pnpm library:propose <book>` → draft titles and ranges in `docs/library/<book>-sections.md` (titles only, never scripture) → owner approval → add to `library.json` with the approval fingerprint.
- On the site (P5.3): `getManifest()` in `lib/data.ts` is the path only (sequence, progress, the spiral, `/path`, `/about`); `getFullManifest()` adds the library and drives `/read` and `/book` static params (682 sections, 73 books); `librarySequence()` is the library in canonical order. Library pages pass `library` to `ReaderShell`: never a stop, never written to `last`, Next/Previous via `libraryNav` (on into the next library book), "Library · not on the path" with a link back to `/path`. Book maps for library books hide the progress count (P5.4 adds library progress).
- The Vault's off-path medallions are links (`a[data-book][data-offpath]`) that fly into their books like the path's; the list's "The library: not on this path" links to them too. `tests/e2e/library.spec.ts` opens the first library book of each group, reads a section and checks nothing is stored.
