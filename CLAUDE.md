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

| Command                                              | What it does                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install`                                       | Install dependencies                                                                                                                                                                 |
| `pnpm dev`                                           | Next.js dev server                                                                                                                                                                   |
| `pnpm build`                                         | Static export to `out/` (this is what Vercel runs)                                                                                                                                   |
| `pnpm start`                                         | Serve `out/` on http://localhost:4173                                                                                                                                                |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | ESLint, `tsc --noEmit`, Prettier                                                                                                                                                     |
| `pnpm test`                                          | Vitest: pipeline unit tests and plan integrity checks against committed `public/data`                                                                                                |
| `pnpm e2e`                                           | Playwright against the built `out/` (run `pnpm build` first)                                                                                                                         |
| `pnpm content:fetch`                                 | Download pinned sources into `sources/raw/` and verify checksums from `sources/manifest.json`                                                                                        |
| `pnpm content:build`                                 | Full pipeline: fetch → parse USFM → map versification → resolve plan → validate → emit `public/data/` and the docs logs. Fails loudly on any coverage gap, overlap or anchor failure |

## Content pipeline notes

- Sources are pinned in `sources/manifest.json` (URL + SHA-256). Raw downloads live in `sources/raw/` (gitignored). Generated data in `public/data/` is committed so Vercel never runs the pipeline.
- Plan references use Catholic (Hebrew-based, NABRE) numbering. WEBC uses English numbering for the protocanonical OT. `scripts/lib/versification.ts` maps Hebrew → English with STEPBible TVTMS and proves which column WEBC follows using TVTMS's own tests. Every renumbering is logged in `docs/versification-log.md`.
- Esther and Daniel are mapped by content using `content/plan/structure-maps.json` (reviewed by David); see `docs/esther-daniel-map.md`.
- Anchor failures and unresolved ranges are reported in `docs/pipeline-report.md` and fail `pnpm content:build`. They are never "fixed" by editing the plan.
- A WEBC verse that holds two plan verses in different sections (a "split verse"), or that has no Hebrew counterpart (an "orphan"), is placed by a fixed rule and listed under "Needs your decision" in `docs/versification-log.md` for David to approve.
- Text changes the pipeline makes, all reported: footnote callers are removed (kept as footnotes); where a caller sat between two words with no space, one space is inserted. Nothing else in the WEBC text is altered.
- Section files store each verse as paragraph/poetry `blocks`; the plain text is `verseText(v)` in `lib/types.ts` (blocks joined by single spaces). Footnote and words-of-Jesus offsets index into that string.
