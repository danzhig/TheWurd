# Scripture as Story — Build Plan

Nov 6, 2026 · David

## 1. Handoff

This is the complete spec for **Scripture as Story** (working title): a static, phone-and-desktop Catholic Bible reader that walks a curated narrative path through 23 books, navigated by zooming from a map of the whole canon into a book's sections and then into the text. It ships in six phases: the reader (1), search, verse links and polish (2), word-depth flashcards (3), passage connections (4), the whole Bible as a library beside the path (5), and a themes view that arranges passages into constellations by meaning (6).

**Build order** (owner, 2026-11-10): phases 1 and 2 are done; next come **5** (the whole Bible), then **6** (themes), then **4** (connections, the gold threads), and Phase 3 (word depth) is built **last**. Its data step (P3.1) is already done; the reader work (P3.2) is saved, unmerged, in pull request #15.

**Before the first coding session**

1. Create an empty GitHub repo and connect it to Vercel (Import Project → framework preset Next.js). Production deploys from `main`; every pull request gets a preview URL.
2. Export this doc to Markdown and commit it as `docs/PLAN.md`.
3. Commit the companion file `reading-plan.json` (delivered with this doc) to `content/plan/reading-plan.json`. It is the machine-readable form of section 6.
4. Start the coding agent with the Phase 1 kickoff prompt in section 19.

**Ground rules for the coding agent** (also copied into `CLAUDE.md` by the first prompt)

1. `reading-plan.json` is canonical. Never add, drop or move a reading range without David's explicit approval. If a range fails to resolve or its anchor check fails, stop and report; do not "fix" it silently.
2. Never write, paraphrase or reconstruct scripture from memory. Every verse shown comes from a source file listed in section 3, processed at build time.
3. Never type a Hebrew, Aramaic, Greek or Latin word from memory. Every original-language form is pulled from tagged source data and carries a citation to its row.
4. Static-first: no server code, no database, no accounts in Phases 1–2. Client state lives in `localStorage` only.
5. Use only sources and fonts with the licenses listed in section 3, and credit every one on the `/sources` page.
6. Ask before adding a dependency outside the stack in section 4.
7. Work milestone by milestone (section 11). A milestone is done only when its acceptance checks pass; commit and open a PR per milestone.

## 2. Key decisions and constraints

**The site text is the World English Bible Catholic Edition (WEBC), because it is the only modern-English, full-Catholic-canon translation in the public domain.** The translations suited to personal study (RSV-2CE, NABRE, NRSV-CE) are copyrighted, and their free-quotation allowances are far smaller than the thousands of verses this site would publish at a public Vercel URL. Translation is built as a swappable layer, so a licensed text can replace WEBC later if a publisher grants permission.

| # | Decision | Reason |
| --- | --- | --- |
| D1 | Base English text: WEBC ([eBible.org/eng-web-c](https://ebible.org/eng-web-c/)) | Public domain; 73-book Catholic canon in Catholic order; uses "LORD" for the divine name per Catholic practice ([WEB FAQ](https://ebible.org/web/webfaq.htm)). |
| D2 | Second English text: Douay-Rheims (Challoner), as a flashcard source (the reader toggle was dropped by the owner on 2026-11-10) | Public domain; the historic Catholic English Bible, translated from the Latin Vulgate. |
| D3 | Esther and Daniel follow WEBC's Greek (Septuagint) form | WEBC uses only the longer Greek versions of both books. The pipeline must map section 6's Esther and Daniel sections onto WEBC's actual chapter and verse structure, verified by content anchors. |
| D4 | Plan references use standard Catholic versification (Hebrew-based numbering for protocanonical books, as in NABRE) | Whole-chapter ranges were chosen wherever English and Hebrew numbering diverge. The pipeline maps every reference to WEBC with the TVTMS dataset and checks each partial-range boundary against its anchor. |
| D5 | The map shows all 73 books; the plan uses 23, plus one optional chapter of John | Skipped books stay visible but dimmed, giving orientation and room for later phases. |
| D6 | Full text of every plan book is built in; skipped ranges render collapsed and expandable | Nothing is hidden, only folded. Books outside the plan carry no text in Phase 1. |
| D7 | Static export on Vercel; no database; reading progress in `localStorage` | Matches the brief; bookmarks and highlights come later (section 17). |
| D8 | Job sits after Genesis (the setting to move it was removed by the owner on 2026-11-10) | Job's setting is undated and patriarchal. |
| D9 | Lists inside read ranges are marked **skim** (shown collapsed, one line of summary) | Applies the plan's own rule to Genesis 36 and 46:8–27, Exodus 6:14–27, Numbers 15, 18–19, the roster passages of 2 Samuel, 1 Kings, Ezra and Nehemiah. Reverting any one is a one-word change in the JSON. |
| D10 | Verse numbers printed beside the text are WEBC's; the page header shows the plan's (Catholic/NABRE) reference, with a short note where the two differ | The numbers must match the text actually shown. Approved by David, Nov 6, 2026. |
| D11 | Phase 3 may use two CC BY-SA 4.0 sources: Swete's Septuagint (First1KGreek transcription, with Morpheus lemmas from QuantForgeSoftware/lxx) and Lewis & Short (Perseus). Approved by the owner on 2026-11-10. | No openly licensed tagged Septuagint or digital Lewis & Short exists under CC BY or public domain. The Greek and Latin word data derived from them is published under CC BY-SA 4.0 and credited on `/sources`. |

**Status values used throughout:** `read` (main path), `skim` (on the path, collapsed with a summary), `optional` (a detour: always on the maps, offered beside Next, never a stop for Next), `skip` (folded away, expandable), plus a `highlight` flag for passages the reader should slow down for.

## 3. Source texts and data

**Every layer of the site has a free, openly licensed source; the STEPBible datasets (CC BY 4.0) carry most of the original-language work.** Pin each source to a commit hash or file checksum in `sources/manifest.json`, and verify the license on the source page before first use.

| Layer | Source | License | Used for | Phase |
| --- | --- | --- | --- | --- |
| English (base) | [World English Bible Catholic Edition](https://ebible.org/eng-web-c/), USFM download | Public domain | All reader text | 1 |
| English (historic Catholic) | Douay-Rheims, Challoner revision (eBible.org USFM `engDRA`) | Public domain | Reader toggle; flashcards | 2–3 |
| English (comparison) | King James Version; Brenton's English Septuagint (eBible.org USFM: `eng-kjv2006`, `eng-Brenton`) | Public domain in the US (KJV is under Crown copyright in the UK) | Flashcards only | 3 |
| Hebrew and Aramaic | [STEPBible TAHOT](https://github.com/STEPBible/STEPBible-Data) (Leningrad Codex, word-tagged with extended Strong's numbers and morphology) | CC BY 4.0 | Word layer for protocanonical OT books | 3 |
| Greek New Testament | STEPBible TAGNT (word-tagged, notes which editions contain each word) | CC BY 4.0 | Word layer for Luke, Acts, John 11 | 3 |
| Greek Old Testament | Swete's *The Old Testament in Greek*, First1KGreek TEI transcription, with Morpheus lemmas from [QuantForgeSoftware/lxx](https://github.com/QuantForgeSoftware/lxx) where a form matches (D11) | CC BY-SA 4.0 | Septuagint card; the only original-language layer for Tobit, Judith, 1 Maccabees, and the Greek parts of Esther and Daniel. The analysed files drop words after marginal notes, so the text is read from the transcription; its OCR slips mean every Greek form is checked against the printed Swete. | 3 |
| Latin | Clementine Vulgate (1592/1598), eBible.org USFM `latVUC` (its Glossa Ordinaria notes are dropped) | Public domain | Latin card. Do **not** use the Stuttgart Vulgate or Nova Vulgata: both are copyrighted. | 3 |
| Lexicons | STEPBible brief lexicons (TBESH, TBESG) and the formatted full LSJ (TFLSJ); Lewis & Short from the Perseus Digital Library (D11) | CC BY 4.0; CC BY-SA 4.0 (Lewis & Short) | Glosses and semantic ranges on flashcards; Latin senses cited by Perseus sense id | 3 |
| Versification | STEPBible TVTMS (versification traditions across Hebrew, Greek, Latin and English) | CC BY 4.0 | Mapping plan references onto WEBC; aligning verses across languages | 1 and 3 |
| Proper names | STEPBible TIPNR (every person and place, with all references) | CC BY 4.0 | Name pop-ups (later) | 4+ |
| Cross-references | OpenBible.info cross-references (derived from the Treasury of Scripture Knowledge) | CC BY 4.0 | Candidate pool for connections | 4 |
| Topics (public domain) | Nave's Topical Bible (1896) | Public domain | Candidate passages for themes | 6 |
| Topics (crowd-ranked) | OpenBible.info topical data | Verify before use (credit required) | Candidate passages for themes | 6 |
| Fonts | Cormorant Garamond, EB Garamond, Gentium Plus (polytonic Greek), Ezra SIL or Taamey Frank CLM (pointed Hebrew with cantillation) | SIL Open Font License or similarly open | All typography, self-hosted | 1 |

**Which languages matter, by book.** The original language differs across the plan, so the word layer must show the right cards per passage:

- **Hebrew**: the protocanonical Old Testament books.
- **Aramaic**: Daniel 2:4b–7:28 and Ezra 4:8–6:18 and 7:12–26, which sit inside the plan's Daniel and Ezra readings.
- **Greek (Septuagint)**: the translation the apostles and early church read; for Tobit, Judith, 1 Maccabees and the Greek additions it is the oldest complete text.
- **Greek (New Testament)**: the original of Luke, Acts and John.
- **Latin (Vulgate)**: the Western church's Bible for over a millennium, and the source of the Douay-Rheims.
- **English**: WEBC, Douay-Rheims, KJV and Brenton as rendering examples. Licensed modern translations may be quoted as single-word or short-phrase renderings with attribution, never as running text.

## 4. Stack, architecture and deployment

**Next.js with static export, deployed to Vercel from GitHub: every page is pre-rendered HTML plus per-section JSON, with no server at runtime.** Content is processed once by local scripts and the generated data is committed, so Vercel builds stay fast and deterministic.

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js, current stable, App Router, `output: 'export'`, TypeScript strict | Static routes via `generateStaticParams` for every book and section |
| Package manager | pnpm |  |
| Styling | CSS Modules plus design tokens as CSS custom properties | Bespoke look; no component kit |
| Motion | `motion` (Framer Motion) for layout and shared-element transitions; View Transitions API as an enhancement | Must honour `prefers-reduced-motion` |
| Map pan and zoom | `d3-zoom` driving an SVG or DOM scene | Handles pinch, trackpad and wheel uniformly |
| Content scripts | Node with `tsx`, `zod` schemas, a USFM parser (`usfm-grammar` or a small custom parser) | Run with `pnpm content:build`; never run in the Vercel build |
| Tests | Vitest (pipeline, plan integrity), Playwright (end-to-end at 390×844 and 1440×900), `@axe-core/playwright` (accessibility) | Run in GitHub Actions on every PR |
| Offline and install (Phase 2) | Web app manifest plus a service worker (Serwist or hand-written) | Cache shell, fonts and visited sections |
| Search (Phase 2) | Pagefind (static index generated after build) | Optional |

**Repository layout**

```
/app                 routes: / (canon map), /book/[bookId], /read/[sectionId], /path, /sources, /about
/components
  /vault             canon map scene, book medallions, camera
  /book-map          section map, path, station nodes
  /reader            verse renderer, skim/skip folds, notes, bridges, nav
  /ui                buttons, sheets, toggles
/content
  /plan/reading-plan.json     canonical plan (section 6)
  /plan/bridges/*.md          bridge and note texts (section 7)
  /plan/summaries.json        one-line summaries for skims and skips
  /terms/*.json               Phase 3 key terms
  /connections/*.json         Phase 4 connections
/scripts             fetch-sources, parse-usfm, map-versification, resolve-plan, validate, emit
/sources             raw downloads (gitignored) + manifest.json (committed: URLs, versions, checksums)
/public/data         generated: manifest.json, books/*.json, sections/<id>.json (committed)
/styles              tokens.css, typography.css, textures
/tests               unit, integrity, e2e
/docs/PLAN.md        this plan
CLAUDE.md            ground rules (section 1) + commands
```

**Deployment.** Vercel's Next.js preset detects the static export automatically. Set the Node version in `package.json` `engines`. No environment variables or functions are needed in Phases 1–2. The Hobby plan suffices for a personal, non-commercial site.

## 5. Data model and content pipeline

**One canonical plan file drives everything: the pipeline expands it into verse-level ranges, proves that every verse of every plan book is accounted for exactly once, and emits one JSON file per section.**

**Core types** (define in `lib/types.ts` with matching `zod` schemas)

```ts
type Status = 'read' | 'skim' | 'optional' | 'skip';

interface Book {
  id: string;              // OSIS id: 'Gen', 'Job', '1Macc', 'Luke'
  name: string;            // 'Genesis'
  testament: 'OT' | 'NT';
  group: 'Pentateuch' | 'Historical' | 'Wisdom' | 'Prophets' | 'Gospels' | 'Acts' | 'Letters' | 'Apocalypse';
  canonOrder: number;      // 1..73, Catholic order
  inPlan: boolean;
  tagline: string;         // one line for the map card
  setting?: string;        // 'Babylonian exile, 6th c. BC'
}

interface Section {
  id: string;              // 'gen-07'
  bookId: string;
  order: number;           // within the book
  title: string;           // 'The Call and Wanderings of Abram'
  range: string;           // plan notation, e.g. '12:1-14:24' or '6-9'
  status: Status;
  highlight?: boolean;     // "slow down here"
  inner?: InnerFold[];     // skim/skip folds inside a read section
  anchors?: Anchor[];      // boundary checks for partial ranges
  noteIds?: string[];      // reader notes (section 7)
  contentNote?: string;    // gentle warning for violent passages
}

interface InnerFold { range: string; status: 'skim' | 'skip'; label: string; }
interface Anchor { ref: string; mustContain: string[]; }   // case-insensitive words expected in that verse

interface PlanStep {     // the chronological path
  kind: 'book' | 'bridge' | 'excursion';
  id: string;            // bookId, bridgeId or excursion id
  movable?: boolean;     // Job
}

interface Verse {
  ref: string;           // 'Gen.12.1' (after mapping to WEBC)
  num: number;
  text: string;          // WEBC text with inline markers stripped to spans
  para?: boolean;        // paragraph break before
  poetry?: 1 | 2;        // indent level
  heading?: string;      // WEBC section heading, if any
}
```

**Pipeline** (`pnpm content:build`, each step a script that fails loudly)

1. **fetch-sources** — download every pinned source into `/sources`; verify checksums against `sources/manifest.json`.
2. **parse-usfm** — WEBC USFM to `Verse[]` per book, keeping paragraph, poetry and heading markers. Record which Tobit text form WEBC uses (long or short) and the actual chapter/verse layout of Greek Esther and Daniel.
3. **map-versification** — convert every plan reference from Catholic (Hebrew-based) numbering to WEBC numbering using TVTMS. Log every conversion that changed a number.
4. **resolve-plan** — expand `range` strings into verse lists; check every `Anchor`; resolve Esther and Daniel sections against the structure found in step 2.
5. **validate** — per plan book, the union of all section ranges and inner folds must equal the full verse set of that book, with no overlaps and no gaps. Any failure stops the build and prints the offending verses.
6. **emit** — write `public/data/manifest.json` (books, plan steps, section index, verse counts, reading minutes at 230 words per minute) and `public/data/sections/<id>.json` (the verses plus notes). Target under 60 KB per section file, gzipped.

**Plan notation.** `6-9` means chapters 6 through 9 whole. `11:1-9` and `12:1-14:24` are verse ranges. `A1-A17` style references appear only in Esther, as content descriptions to be mapped in step 4.

## 6. The reading plan

**The path runs through 23 books and one optional chapter in 252 map sections; every chapter of every plan book is assigned exactly once, which the committed `reading-plan.json` encodes and its validator proves.** This table and the JSON must match; the JSON wins if they ever differ. References use Catholic (Hebrew-based) numbering; `end` means the chapter's last verse. Anchors are words the pipeline expects to find in that verse, to prove a boundary landed on the right content.

**Order of the path:** Genesis → *Job* → Exodus → Numbers → Deuteronomy → Joshua → Judges → Ruth → 1–2 Samuel → 1–2 Kings → *bridge* → Jeremiah 37–43 → *bridge* → Tobit → Daniel → Judith → Esther → Ezra → Nehemiah → Jonah → *bridge* → 1 Maccabees → *bridge* → Luke (with John 11 offered after Luke 19:27) → Acts.

**Genesis** — Creation, catastrophe, and one family

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| gen-01 | Creation | 1:1-2:3 | Read | Anchors: 1:1 «beginning» |
| gen-02 | The Garden and the Fall | 2:4-3:end | Read | Anchors: 2:4 «heavens earth» |
| gen-03 | Cain and Abel | 4 | Read |  |
| gen-x1 | From Adam to Noah | 5 | Skip | Ten generations from Adam to Noah, with their lifespans. |
| gen-04 | The Flood | 6-9 | Read |  |
| gen-x2 | The Table of Nations | 10 | Skip | The nations descended from Noah's sons Shem, Ham and Japheth. |
| gen-05 | The Tower of Babel | 11:1-9 | Read | Anchors: 11:1 «language», 11:9 «Babel» |
| gen-x3 | From Shem to Terah | 11:10-26 | Skip | Ten generations from Shem to Terah, Abram's father. Anchors: 11:10 «Shem» |
| gen-06 | From Ur to Haran | 11:27-32 | Read | Anchors: 11:27 «Terah», 11:30 «barren» |
| gen-07 | The Call and Wanderings of Abram | 12-14 | Read |  |
| gen-08 | Covenant, Hagar and Ishmael | 15-17 | Read |  |
| gen-09 | Sodom and Gomorrah | 18-19 | Read |  |
| gen-10 | Isaac Born, Abraham Tested | 20-22 | Read |  |
| gen-11 | Sarah's Death and Rebekah | 23:1-25:18 | Read | Skim 25:12-18 (the descendants of Ishmael). Anchors: 25:12 «Ishmael» |
| gen-12 | Jacob and Esau | 25:19-28:end | Read | Anchors: 25:19 «Isaac» |
| gen-13 | Jacob in Haran | 29-31 | Read |  |
| gen-14 | Jacob Returns | 32-35 | Read |  |
| gen-15 | The Line of Esau | 36 | Skim | Esau's descendants and the early chiefs and kings of Edom. |
| gen-16 | Joseph Sold; Judah and Tamar | 37-38 | Read |  |
| gen-17 | Joseph in Egypt | 39-41 | Read |  |
| gen-18 | The Brothers in Egypt | 42-45 | Read |  |
| gen-19 | Jacob's Family Comes to Egypt | 46-47 | Read | Skim 46:8-27 (the names of Jacob's household). Anchors: 46:8 «names» |
| gen-20 | Jacob's Blessings and Death; Joseph's Last Days | 48-50 | Read |  |

**Job** — An interlude on suffering (movable; default after Genesis)

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| job-01 | The Wager in Heaven | 1-2 | Read |  |
| job-x1 | The Great Debate | 3-37 | Skip | Job and three friends argue in poetry; they insist his suffering is punishment, he maintains his innocence. Elihu then speaks. |
| job-02 | The Voice from the Whirlwind | 38:1-11 | Read · slow down | Anchors: 38:1 «whirlwind» |
| job-x2 | The Rest of God's First Speech | 38:12-39:end | Skip | God continues with questions about light, weather and wild animals. |
| job-03 | Job's First Reply | 40:1-5 | Read | Anchors: 40:4 «hand mouth» |
| job-x3 | God's Second Speech | 40:6-41:end | Skip | God speaks of Behemoth and Leviathan, creatures beyond human mastery. |
| job-04 | Restoration | 42 | Read |  |

**Exodus** — Out of Egypt, to the mountain

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| exod-01 | Slavery and the Birth of Moses | 1-2 | Read |  |
| exod-02 | The Burning Bush | 3-4 | Read |  |
| exod-03 | Confronting Pharaoh | 5:1-7:13 | Read | Skim 6:14-27 (the genealogy of Moses and Aaron). Anchors: 6:14 «heads», 6:26 «Aaron Moses» |
| exod-04 | The Plagues | 7:14-11:end | Read | Anchors: 7:14 «Pharaoh» |
| exod-05 | Passover and Departure | 12-13 | Read |  |
| exod-06 | Crossing the Sea | 14:1-15:21 | Read | Anchors: 15:20 «Miriam» |
| exod-07 | Bitter Water, Manna, and Amalek | 15:22-17:end | Read | Anchors: 15:22 «Shur» |
| exod-08 | Jethro's Counsel | 18 | Read |  |
| exod-09 | Sinai and the Ten Commandments | 19-20 | Read |  |
| exod-x1 | The Book of the Covenant | 21-23 | Skip | Civil and religious case law: slaves, injuries, property, festivals. |
| exod-10 | The Covenant Sealed | 24 | Read |  |
| exod-x2 | Instructions for the Tabernacle | 25-31 | Skip | Detailed plans for the tabernacle, its furnishings, and the priests' vestments. |
| exod-11 | The Golden Calf | 32 | Read |  |
| exod-12 | Moses Intercedes | 33 | Read |  |
| exod-13 | The Covenant Renewed | 34 | Read |  |
| exod-x3 | The Tabernacle Built | 35:1-40:33 | Skip | The instructions of chapters 25–31 carried out, item by item. |
| exod-14 | Glory Fills the Tabernacle | 40:34-38 | Read · slow down | Anchors: 40:34 «cloud» |

**Numbers** — Forty years in the wilderness

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| num-x1 | Census and Camp | 1-9 | Skip | The tribes counted and arranged around the tabernacle; Levite duties; purity laws; the second Passover. |
| num-01 | Breaking Camp | 10 | Read | Anchors: 10:11 «cloud» |
| num-02 | Complaints, Quail, and the Seventy Elders | 11 | Read |  |
| num-03 | Miriam and Aaron Oppose Moses | 12 | Read |  |
| num-04 | The Twelve Spies | 13-14 | Read |  |
| num-05 | Laws for the Land | 15 | Skim | Offerings, the Sabbath-breaker, and tassels on garments. |
| num-06 | Korah's Rebellion | 16-17 | Read |  |
| num-07 | Priestly Duties and the Red Heifer | 18-19 | Skim | The priests' and Levites' portions; purification after contact with the dead. |
| num-08 | Water from the Rock; Aaron's Death | 20 | Read |  |
| num-09 | The Bronze Serpent and the March East | 21 | Read |  |
| num-10 | Balaam | 22-24 | Read |  |
| num-11 | Apostasy at Peor | 25 | Read |  |
| num-x2 | The Second Census and Laws | 26-31 | Skip | A new generation counted; Zelophehad's daughters; Joshua appointed; offerings and vows; war on Midian. |
| num-12 | The Eastern Tribes' Bargain | 32 | Read |  |
| num-x3 | Itinerary and Borders | 33-36 | Skip | The route from Egypt, the land's borders, cities of refuge, inheritance laws. |

**Deuteronomy** — The last words of Moses

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| deut-x1 | Moses Recounts the Journey | 1-5 | Skip | Moses retells the wilderness years and repeats the Ten Commandments. |
| deut-x2 | Introduction to the Command | 6:1-3 | Skip | A short preface to the commandment that follows. |
| deut-01 | The Shema | 6:4-9 | Read | Anchors: 6:4 «Hear Israel», 6:5 «love» |
| deut-x3 | Sermons and the Law Code | 6:10-27:end | Skip | Exhortations, then the law code: worship, kings, prophets, war, family and justice, ending in the Shechem ceremony. |
| deut-02 | Blessings and Curses | 28 | Optional | The scorecard Kings applies to every ruler. |
| deut-x4 | The Covenant in Moab | 29-30 | Skip | A final covenant appeal: choose life. |
| deut-03 | Joshua Commissioned | 31 | Read |  |
| deut-04 | The Song of Moses | 32:1-47 | Read | Anchors: 32:1 «heavens» |
| deut-05 | Moses Sent Up the Mountain | 32:48-52 | Read | Anchors: 32:49 «Nebo» |
| deut-06 | Moses Blesses the Tribes | 33 | Read |  |
| deut-07 | The Death of Moses | 34 | Read · slow down |  |

**Joshua** — The conquest

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| josh-01 | Joshua's Charge | 1 | Read |  |
| josh-02 | Rahab and the Spies | 2 | Read |  |
| josh-03 | Crossing the Jordan | 3-4 | Read |  |
| josh-04 | Gilgal and the Commander of the Army | 5 | Read |  |
| josh-05 | Jericho | 6 | Read |  |
| josh-06 | Achan and Ai | 7-8 | Read |  |
| josh-07 | The Gibeonite Ruse | 9 | Read |  |
| josh-08 | The Southern Campaign | 10 | Read |  |
| josh-09 | The Northern Campaign | 11 | Read |  |
| josh-x1 | Dividing the Land | 12-21 | Skip | Lists of defeated kings, tribal boundaries, cities of refuge and Levite towns. |
| josh-10 | The Altar by the Jordan | 22 | Read |  |
| josh-11 | Joshua's Farewell | 23 | Read |  |
| josh-12 | Covenant at Shechem | 24 | Read |  |

**Judges** — The dark age

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| judg-01 | The Unfinished Conquest | 1:1-2:5 | Read | Anchors: 2:1 «Bochim» |
| judg-02 | The Cycle Begins | 2:6-3:6 | Read | Anchors: 2:6 «Joshua» |
| judg-03 | Othniel, Ehud and Shamgar | 3:7-31 | Read | Anchors: 3:9 «Othniel» |
| judg-04 | Deborah and Barak | 4-5 | Read |  |
| judg-05 | Gideon | 6-8 | Read |  |
| judg-06 | Abimelech | 9 | Read |  |
| judg-07 | Jephthah and the Minor Judges | 10-12 | Read |  |
| judg-08 | Samson | 13-16 | Read |  |
| judg-09 | Micah's Idol and the Danites | 17-18 | Read |  |
| judg-10 | The Levite's Concubine and Civil War | 19-21 | Read | Content note: sexual violence and dismemberment. |

**Ruth** — The hinge

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| ruth-01 | Naomi and Ruth | 1 | Read |  |
| ruth-02 | The Field of Boaz | 2 | Read |  |
| ruth-03 | The Threshing Floor | 3 | Read |  |
| ruth-04 | The Redeemer | 4 | Read | Keep 4:18-22: the genealogy is the reveal. |

**1 Samuel** — The birth of the monarchy

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| 1sam-01 | Hannah and the Birth of Samuel | 1:1-2:11 | Read | Anchors: 2:11 «Ramah» |
| 1sam-02 | Eli's Sons and Samuel's Call | 2:12-3:end | Read | Anchors: 2:12 «Eli» |
| 1sam-03 | The Ark Lost and Returned | 4-7 | Read |  |
| 1sam-04 | Israel Demands a King | 8-10 | Read |  |
| 1sam-05 | Saul's Early Reign | 11-13 | Read |  |
| 1sam-06 | Jonathan's Raid | 14 | Read |  |
| 1sam-07 | Saul Rejected | 15 | Read |  |
| 1sam-08 | David Anointed; Goliath | 16-17 | Read |  |
| 1sam-09 | Saul's Jealousy, Jonathan's Friendship | 18-20 | Read |  |
| 1sam-10 | David the Fugitive | 21-24 | Read |  |
| 1sam-11 | Nabal and Abigail | 25 | Read |  |
| 1sam-12 | David Spares Saul Again | 26-27 | Read |  |
| 1sam-13 | The Medium of Endor | 28 | Read |  |
| 1sam-14 | Ziklag | 29-30 | Read |  |
| 1sam-15 | The Death of Saul | 31 | Read |  |

**2 Samuel** — David's kingdom

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| 2sam-01 | David's Lament | 1 | Read |  |
| 2sam-02 | Civil War | 2-4 | Read |  |
| 2sam-03 | King of All Israel; the Ark to Jerusalem | 5-6 | Read |  |
| 2sam-04 | The Promise to David | 7 | Read · slow down |  |
| 2sam-05 | Wars and Mephibosheth | 8-10 | Read |  |
| 2sam-06 | Bathsheba and Uriah | 11-12 | Read |  |
| 2sam-07 | Amnon, Tamar and Absalom | 13-14 | Read | Content note: sexual violence. |
| 2sam-08 | Absalom's Revolt and David's Return | 15-19 | Read |  |
| 2sam-09 | Sheba's Rebellion | 20 | Read |  |
| 2sam-10 | Last Things: Famine, Song, Heroes, Census | 21-24 | Read | Skim 23:8-39 (the roll of David's mighty men). Anchors: 23:8 «mighty» |

**1 Kings** — Golden age to division

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| 1kgs-01 | Solomon Takes the Throne | 1-2 | Read |  |
| 1kgs-02 | Solomon's Wisdom and Splendour | 3-5 | Read | Skim 4:1-19 (Solomon's officials and districts). Anchors: 4:2 «Azariah» |
| 1kgs-03 | Building the Temple and Palace | 6-7 | Skim | Temple and palace dimensions, cedar panelling, and bronze furnishings. |
| 1kgs-04 | The Temple Dedicated | 8-9 | Read |  |
| 1kgs-05 | The Queen of Sheba; Solomon's Fall | 10-11 | Read |  |
| 1kgs-06 | The Kingdom Splits | 12-14 | Read |  |
| 1kgs-07 | Kings of Judah and Israel | 15-16 | Read |  |
| 1kgs-08 | Elijah: Drought, the Widow, and Carmel | 17-18 | Read · slow down | Elijah–Elisha cycle begins (runs to 2 Kings 13). |
| 1kgs-09 | Elijah at Horeb | 19 | Read · slow down |  |
| 1kgs-10 | Ahab's Wars; Naboth's Vineyard | 20-21 | Read · slow down |  |
| 1kgs-11 | Micaiah and the Death of Ahab | 22 | Read · slow down |  |

**2 Kings** — The long decline

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| 2kgs-01 | Elijah's Last Acts; the Chariot of Fire | 1-2 | Read · slow down |  |
| 2kgs-02 | Elisha's Wonders | 3-8 | Read · slow down |  |
| 2kgs-03 | Jehu's Coup | 9-10 | Read · slow down |  |
| 2kgs-04 | Athaliah and Joash | 11-12 | Read · slow down |  |
| 2kgs-05 | The Death of Elisha | 13 | Read · slow down | Elijah–Elisha cycle ends. |
| 2kgs-06 | The Decline of Israel | 14-16 | Read |  |
| 2kgs-07 | The Fall of Samaria | 17 | Read |  |
| 2kgs-08 | Hezekiah and the Assyrian Siege | 18-20 | Read |  |
| 2kgs-09 | Manasseh and Josiah's Reform | 21:1-23:30 | Read | Anchors: 23:30 «Megiddo» |
| 2kgs-10 | The Fall of Jerusalem | 23:31-25:end | Read | Anchors: 23:31 «Jehoahaz» |

**Jeremiah 37–43** — The fall, from inside the walls

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| jer-x1 | Jeremiah's Oracles | 1-36 | Skip | Sermons, laments and oracles from four decades of Jeremiah's ministry. |
| jer-01 | Jeremiah Arrested | 37 | Read |  |
| jer-02 | The Cistern | 38 | Read |  |
| jer-03 | The City Falls | 39 | Read |  |
| jer-04 | Gedaliah | 40-41 | Read |  |
| jer-05 | Flight into Egypt | 42-43 | Read |  |
| jer-x2 | In Egypt; Oracles to the Nations | 44-52 | Skip | Jeremiah's last words in Egypt, oracles against the nations, and an appendix retelling Jerusalem's fall. |

**Tobit** — A journey with an angel

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| tob-01 | Tobit's Piety and Blindness | 1-2 | Read |  |
| tob-02 | Two Prayers | 3 | Read |  |
| tob-03 | Tobiah's Journey with Raphael | 4-6 | Read |  |
| tob-04 | The Wedding at Ecbatana | 7-9 | Read |  |
| tob-05 | Homecoming and Healing | 10-11 | Read |  |
| tob-06 | Raphael Revealed | 12 | Read |  |
| tob-07 | Tobit's Song and Last Words | 13-14 | Read |  |

**Daniel 1–6, 13–14** — Tales from the exile

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| dan-01 | Exiles at Court | 1 | Read |  |
| dan-02 | Nebuchadnezzar's Dream | 2 | Read |  |
| dan-03 | The Fiery Furnace | 3 | Read | Skim 3:24-90 (the Prayer of Azariah and Song of the Three); narrative resumes at 3:91. Anchors: 3:24 «fire» |
| dan-04 | The King's Madness | 4 | Read |  |
| dan-05 | The Writing on the Wall | 5 | Read |  |
| dan-06 | The Lions' Den | 6 | Read |  |
| dan-x1 | Daniel's Visions | 7-12 | Skip | Apocalyptic visions of beasts, the Son of Man, and the kingdoms to come. |
| dan-07 | Susanna | 13 | Read |  |
| dan-08 | Bel and the Dragon | 14 | Read |  |

**Judith** — A widow saves her people

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| jdt-01 | Holofernes' Campaign | 1-3 | Skim | The Assyrian general Holofernes subdues the western nations. |
| jdt-02 | The Siege of Bethulia | 4-7 | Skim | Israel prepares; Achior warns Holofernes; the town's water is cut off. |
| jdt-03 | Judith Rebukes the Elders | 8 | Read |  |
| jdt-04 | Judith's Prayer | 9 | Read |  |
| jdt-05 | Into the Enemy Camp | 10-12 | Read |  |
| jdt-06 | The Tent of Holofernes | 13 | Read |  |
| jdt-07 | Victory and Judith's Song | 14-16 | Read |  |

**Esther** — A thriller at the Persian court (references are NABRE's lettered additions A–F; map each to WEBC's Greek Esther by content)

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| esth-01 | Mordecai's Dream; a Plot Uncovered | A:1-17 | Read |  |
| esth-02 | Vashti Deposed | 1 | Read |  |
| esth-03 | Esther Becomes Queen | 2 | Read |  |
| esth-04 | Haman's Decree | 3; B:1-7 | Read | B = the text of the decree |
| esth-05 | Mordecai's Appeal and the Two Prayers | 4; C:1-30 | Read |  |
| esth-06 | Esther Before the King | D:1-16; 5 | Read |  |
| esth-07 | The Sleepless King | 6 | Read |  |
| esth-08 | Haman's Fall | 7 | Read |  |
| esth-09 | The Counter-Decree | 8; E:1-24 | Read |  |
| esth-10 | Purim; the Dream Explained | 9-10; F:1-11 | Read |  |

**Ezra** — The return

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| ezra-01 | Cyrus's Decree and the First Return | 1-2 | Read | Skim 2 (the register of returning families). |
| ezra-02 | The Altar and the Foundation | 3 | Read |  |
| ezra-03 | Opposition | 4 | Read |  |
| ezra-04 | The Temple Completed | 5-6 | Read |  |
| ezra-05 | Ezra Arrives | 7-8 | Read | Skim 7:1-5 (Ezra's ancestry) and 8:1-14 (families who came with Ezra). Anchors: 8:1 «heads» |
| ezra-06 | The Crisis of Mixed Marriages | 9-10 | Read | Skim 10:18-44 (those who had married foreign wives). Anchors: 10:18 «priests» |

**Nehemiah** — The wall rebuilt

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| neh-01 | News from Jerusalem | 1 | Read |  |
| neh-02 | The Night Inspection | 2 | Read |  |
| neh-03 | The Builders | 3:1-32 | Skim | Who rebuilt which stretch of wall and which gate. |
| neh-04 | Building Under Threat | 3:33-4:end | Read | Hebrew numbering; English Bibles call this 4:1-23. Anchors: 3:33 «Sanballat» |
| neh-05 | Nehemiah Confronts Injustice | 5 | Read |  |
| neh-06 | The Wall Completed | 6:1-7:5 | Read | Anchors: 7:5 «genealogy» |
| neh-07 | The Register of Returnees | 7:6-end | Skim | The list of returning families, repeated from Ezra 2. |
| neh-08 | Ezra Reads the Law | 8 | Read |  |
| neh-09 | Confession and Covenant | 9-10 | Read | Skim 10:2-28 (those who sealed the covenant; English Bibles call this 10:1-27). Anchors: 10:2 «Nehemiah» |
| neh-10 | Repopulating Jerusalem | 11:1-12:26 | Read | Skim 11:3-36 (residents of Jerusalem and the towns) and 12:1-26 (priests and Levites). |
| neh-11 | The Wall Dedicated | 12:27-47 | Read | Anchors: 12:27 «dedication» |
| neh-12 | Nehemiah's Last Reforms | 13 | Read |  |

**Jonah** — The reluctant prophet

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| jonah-01 | Flight and Storm | 1 | Read |  |
| jonah-02 | In the Belly of the Fish | 2 | Read |  |
| jonah-03 | Nineveh Repents | 3 | Read |  |
| jonah-04 | The Vine | 4 | Read |  |

**1 Maccabees** — The revolt

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| 1macc-01 | Alexander's Heirs and the Persecution | 1 | Read |  |
| 1macc-02 | Mattathias Revolts | 2 | Read |  |
| 1macc-03 | Judas's First Victories | 3:1-4:35 | Read | Anchors: 4:35 «Lysias» |
| 1macc-04 | The Temple Rededicated | 4:36-61 | Read · slow down | Origin of Hanukkah. Anchors: 4:36 «holy place» |
| 1macc-05 | Campaigns; the Death of Antiochus | 5-6 | Read |  |
| 1macc-06 | Nicanor; Alliance with Rome | 7-8 | Read |  |
| 1macc-07 | The Death of Judas | 9:1-22 | Read | Anchors: 9:18 «Judas» |
| 1macc-08 | Jonathan Takes Command | 9:23-end | Read | Anchors: 9:23 «Judas» |
| 1macc-09 | Jonathan's Diplomacy and Wars | 10-12 | Skim | Rival Seleucid kings court Jonathan; he becomes high priest and is captured by treachery. |
| 1macc-10 | Simon and Independence | 13-16 | Skim | Simon wins independence, is honoured as leader and high priest, and is murdered; his son John succeeds him. |

**Luke** — The life of Jesus

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| luke-01 | Prologue | 1:1-4 | Read |  |
| luke-02 | Two Annunciations | 1:5-56 | Read | Anchors: 1:5 «Herod» |
| luke-03 | Two Births | 1:57-2:40 | Read | Anchors: 1:57 «Elizabeth» |
| luke-04 | The Boy in the Temple | 2:41-52 | Read | Anchors: 2:41 «Passover» |
| luke-05 | John the Baptist; the Baptism | 3:1-22 | Read | Anchors: 3:1 «Tiberius» |
| luke-x1 | The Genealogy of Jesus | 3:23-38 | Skip | Jesus' ancestry traced back through David and Abraham to Adam. Anchors: 3:23 «thirty» |
| luke-06 | Temptation; Rejected at Nazareth | 4:1-30 | Read | Anchors: 4:1 «wilderness» |
| luke-07 | The Disciples Called; Sermon on the Plain | 4:31-6:end | Read | Anchors: 4:31 «Capernaum» |
| luke-08 | Healings, Forgiveness, Parables | 7-8 | Read |  |
| luke-09 | Peter's Confession; the Transfiguration | 9:1-50 | Read · slow down | Moses and Elijah appear (9:30). |
| luke-10 | Toward Jerusalem: the Samaritan, Martha and Mary | 9:51-13:21 | Read | The Shema quoted at 10:27. Anchors: 9:51 «Jerusalem» |
| luke-11 | The Narrow Door to the Prodigal Son | 13:22-17:10 | Read | Anchors: 13:22 «Jerusalem» |
| luke-12 | Lepers, the Widow, Zacchaeus | 17:11-19:27 | Read | John 11 excursion offered after this section. Anchors: 17:11 «Samaria» |
| luke-13 | Entry into Jerusalem; Teaching in the Temple | 19:28-21:end | Read | Anchors: 19:28 «Jerusalem» |
| luke-14 | The Last Supper and the Arrest | 22:1-53 | Read | Anchors: 22:1 «Unleavened» |
| luke-15 | Trials and Crucifixion | 22:54-23:end | Read | Anchors: 22:54 «high priest» |
| luke-16 | Resurrection and Emmaus | 24 | Read |  |

**John 11** — Optional excursion

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| john-x1 | John 1–10 | 1-10 | Skip | Outside this reading. |
| john-01 | The Raising of Lazarus | 11 | Optional | Offered between luke-12 and luke-13. |
| john-x2 | John 12–21 | 12-21 | Skip | Outside this reading. |

**Acts** — The first thirty years

| # | Section | Range | Status | Notes |
| --- | --- | --- | --- | --- |
| acts-01 | Ascension and Pentecost | 1-2 | Read |  |
| acts-02 | The Jerusalem Church | 3-5 | Read |  |
| acts-03 | Stephen | 6-7 | Read |  |
| acts-04 | Philip, Samaria and the Ethiopian | 8 | Read |  |
| acts-05 | Saul's Conversion | 9:1-31 | Read | Anchors: 9:1 «Saul» |
| acts-06 | Peter and Cornelius | 9:32-11:18 | Read | Anchors: 9:32 «Peter» |
| acts-07 | Antioch; Herod's Persecution | 11:19-12:end | Read | Anchors: 11:19 «Stephen» |
| acts-08 | Paul's First Journey | 13-14 | Read |  |
| acts-09 | The Council of Jerusalem | 15:1-35 | Read |  |
| acts-10 | The Second Journey | 15:36-18:22 | Read | Anchors: 15:36 «Paul» |
| acts-11 | The Third Journey | 18:23-21:16 | Read | Anchors: 18:23 «Galatia» |
| acts-12 | Arrest in Jerusalem | 21:17-23:end | Read | Anchors: 21:17 «Jerusalem» |
| acts-13 | Before Felix, Festus and Agrippa | 24-26 | Read |  |
| acts-14 | Shipwreck and Rome | 27-28 | Read |  |

**Not in the path (dimmed on the map):** Leviticus; 1–2 Chronicles; Psalms, Proverbs, Ecclesiastes, Song of Songs, Wisdom, Sirach; Isaiah, Lamentations, Baruch, Ezekiel and the twelve minor prophets except Jonah; 2 Maccabees; Matthew, Mark, and John except chapter 11; Romans through Jude; Revelation. Each gets a one-line tagline so the map still orients the reader.

## 7. Bridges and reader notes

**Four bridges stitch the path where the books themselves jump, and 25 short notes tell the reader why a seam matters; all are original text, stored as one Markdown file each under `content/plan/bridges/` and `content/plan/notes/`, with the ids below.** The same texts are in \`reading-plan.json\` under \`bridges\` and \`notes\`; the agent uses those, not a copy from this page. New notes need David's approval.

### Bridges (full-screen cards between books)

| Id | Placed | Title | Text |
| --- | --- | --- | --- |
| br-inside | after 2 Kings | The Same Fall, Closer | Kings tells the destruction of Jerusalem from a distance, in a few verses. The next seven chapters are the same catastrophe told from inside the walls, by a prophet who lived through the siege. |
| br-assyria | after Jeremiah 37–43 | Two Exiles | The story now steps back a century and a half. When Assyria destroyed the northern kingdom in 722 BC, its people were deported to Nineveh; Tobit is their story. Daniel follows the later exiles of Judah to Babylon. |
| br-greeks | after Jonah | From Persia to the Greeks | Nehemiah ends around 430 BC in a small Persian province. A century later Alexander the Great conquered Persia, and Judea passed to his successors: first the Ptolemies of Egypt, then, from about 200 BC, the Seleucids of Syria. In Alexandria, Jewish scholars translated the Scriptures into Greek, the Septuagint, which the early church would read. 1 Maccabees opens with Alexander and moves quickly to the crisis of 167 BC. |
| br-rome | after 1 Maccabees | The Road to Bethlehem | Simon's heirs, the Hasmoneans, ruled an independent Jewish state for about eighty years. In this era the Pharisees and Sadducees took shape, synagogues spread, and the community behind the Dead Sea Scrolls withdrew to the desert. Rome's general Pompey took Jerusalem in 63 BC. Rome later made Herod king of Judea; he rebuilt the temple on a grand scale. Luke opens in Herod's last years. |

### Reader notes (shown as a margin note on desktop, an inline card on phone)

| Id | Attached to | Text |
| --- | --- | --- |
| n-gen-11 | gen-06 start | These six verses introduce Abram, Sarai and Lot and move the family from Ur to Haran. Note verse 30: Sarai is barren. That tension drives the whole Abraham story. |
| n-job-debate | job-x1 (skipped fold) | For 35 chapters Job's friends insist his suffering must be punishment for hidden sin. Job maintains his innocence and demands that God answer him. Then God does. |
| n-job-42 | job-04 start | God's rebuke of the friends in verse 7 is a ruling on the debate you skipped: God says the friends have not spoken rightly of him, as Job has. |
| n-exod-24 | exod-10 start | The people swear to the covenant, sealed in blood. Eight chapters later comes the golden calf, which is why it reads as betrayal. |
| n-exod-40 | exod-14 end | Numbers picks up with this same cloud lifting to lead Israel on. The two books are one motion. |
| n-num-32 | num-12 start | Reuben, Gad and half of Manasseh may settle east of the Jordan, on one condition: their soldiers fight the whole conquest first. Remember this for Joshua 22. |
| n-deut-6 | deut-01 start | The Shema, Israel's central prayer. In Luke 10:27 a lawyer quotes it to Jesus as the heart of the Law. |
| n-deut-28 | deut-02 | Optional. The covenant's blessings and curses are the scorecard behind every verdict in Kings: "he did evil in the sight of the LORD." |
| n-josh-22 | josh-10 start | The eastern tribes have kept the promise of Numbers 32 and are going home. What they build on the way nearly starts a civil war. |
| n-judg | judg-01 start | Watch for the refrain: in those days there was no king in Israel, and everyone did what was right in their own eyes. |
| n-ruth-4 | ruth-04 end | The last verses are a genealogy kept on purpose: Ruth the Moabite is David's great-grandmother. |
| n-1kgs-6 | 1kgs-03 | Skim the measurements. The story resumes when the ark comes to the temple in chapter 8. |
| n-elijah | 1kgs-08 start | Slow down. From here to 2 Kings 13 run the Elijah and Elisha stories, among the best storytelling in the Old Testament. Elijah reappears beside Jesus in Luke 9. |
| n-jer | jer-01 start | Jerusalem is under Babylonian siege. King Zedekiah wavers between surrender and resistance; Jeremiah tells him to surrender. |
| n-dan-3 | dan-03 at 3:24 | Catholic Bibles place a long prayer and hymn here, sung inside the furnace. Skim it like a psalm; the story resumes at 3:91. |
| n-dan-13 | dan-07 start | These two stories stand at the end of Catholic Daniel. Susanna is set in Daniel's youth. |
| n-jdt | jdt-01 | Judith's history is deliberately scrambled (Nebuchadnezzar as king of Assyria), the ancient way of saying "once upon a time." Skim the campaign; the heroine enters in chapter 8. |
| n-esth | esth-01 start | This is the longer Greek Esther. The Hebrew book never names God; the Greek additions, including Mordecai's dream and the queen's prayer, bring God into the story openly. |
| n-ezra-4 | ezra-03 start | Verses 6–23 jump ahead decades to later opposition, then the story returns to its own time. |
| n-jonah | jonah-04 end | Jonah lived in the days of the kings (2 Kings 14:25). His book closes the Old Testament story here on a question God asks about mercy. |
| n-1macc-10 | 1macc-09 | Skim from here: rival kings bargain for the Maccabees' loyalty. |
| n-luke-9 | luke-09 at 9:30 | Moses and Elijah speak with Jesus about his "departure"; in Greek, his exodus. |
| n-luke-10 | luke-10 at 10:27 | The lawyer's answer is the Shema you read in Deuteronomy 6. |
| n-john-11 | john-01 | Optional detour: the raising of Lazarus, the one major story of Jesus that Luke does not tell. Luke 10:38–42 has already introduced Martha and Mary. |
| n-acts-28 | acts-14 end | Acts ends mid-history: Paul under house arrest in Rome, preaching openly. The story is left open. |

## 8. Visual direction and design system

**The look is a Baroque ceiling seen from below: warm umber and smoke at the edges, a luminous gold oculus at the centre, and the story spiralling inward toward the light.** It is taken from the reference images (Saint Michael and the war in heaven, painted *di sotto in sù*), translated into restrained interface materials: gilt hairlines, cloud depth, slow light. Nothing cartoonish, no emoji, no flat icons on the scripture surfaces.

**What to take from the references, and what not to**

- Take: the radial composition pulling the eye to a bright centre; the palette of ochre, umber, smoke grey and vermilion; layered depth of clouds; a sense of weight and scale.
- Do not take: the figures, the dragon, or any copy of the images themselves. Their provenance is unknown and they are low resolution. Atmosphere is built procedurally (below). If real art is wanted later, use public-domain Old Masters from Wikimedia Commons (for example Andrea Pozzo's Sant'Ignazio ceiling, 1691–94), checking and crediting each file's license on `/sources`.

**Colour tokens** (`styles/tokens.css`)

| Token | Value | Role |
| --- | --- | --- |
| `--night` | #14100C | Vault background, edges of the ceiling |
| `--umber` | #2A1F16 | Panels and cards on the dark theme |
| `--smoke` | #5B5248 | Clouds, dimmed books, secondary text on dark |
| `--cloud` | #B9AB97 | Mid-cloud highlights, borders |
| `--vellum` | #F4ECDC | Reader page on the light theme |
| `--ink` | #2A2118 | Body text on vellum |
| `--gold` | #C9A24A | Hairlines, verse numbers, the path thread |
| `--gold-light` | #F0D48A | The oculus, active and highlighted states |
| `--vermilion` | #9E3B26 | Sparing accent: current position, content notes |
| `--lapis` | #2E4A6B | Rare accent: links in notes, the New Testament thread |

Two themes: **Vault** (dark; default for the maps) and **Vellum** (light; default for the reader), with an Auto option following the system. Every text pair meets WCAG AA contrast; verify with a test, not by eye.

**Typography** (self-hosted, `font-display: swap`)

- Display: Cormorant Garamond, small caps and generous letter-spacing for book names; Cormorant italic for taglines.
- Body: EB Garamond at 19–21 px, line height 1.6, measure about 34 em; old-style figures.
- Section openings: a gold drop cap two lines deep.
- Verse numbers: small gold superscripts, toggleable.
- Hebrew: Ezra SIL or Taamey Frank CLM, `dir="rtl"`, `lang="he"` (Aramaic `lang="arc"`). Greek: Gentium Plus, `lang="grc"`. Latin: EB Garamond italic, `lang="la"`.

**Materials and motion**

- Clouds and light are generated once at build time from SVG noise and radial gradients, exported as AVIF and WebP layers. Never animate live SVG filters or large blurs: they drop frames on phones.
- A faint film grain and a soft vignette sit over the Vault.
- Gilt is drawn as 1 px gold hairlines with a subtle gradient, never as heavy bevels.
- Easing: `cubic-bezier(0.2, 0.7, 0.1, 1)` for camera moves (800–900 ms); 180–220 ms for interface feedback. With `prefers-reduced-motion`, every transition becomes a 150 ms crossfade.

## 9. Navigation: three zoom levels

**Navigation is one continuous camera: the Vault (all books), then a book's section map, then the page, with each step a zoom into the thing tapped and every step reversible by pinch-out, the back button, or Esc.** Each level has its own URL, so deep links and browser history work.

| Level | Route | What the reader sees | Enter by | Leave by |
| --- | --- | --- | --- | --- |
| 0 · The Vault | `/` | The whole canon as a ceiling, the plan as a gold thread spiralling inward | Opening the site; zooming out from a book | Tapping a book medallion |
| 1 · The Book | `/book/[bookId]` | The book's sections as stations along a path | Medallion zoom and open | Tapping a station; pinch-out |
| 2 · The Page | `/read/[sectionId]` | The reader (section 10) | Station expands into the page | Back, pinch-out, Esc, or "Next" |
| Alt · The Path | `/path` | The whole sequence as a vertical timeline list, grouped by book | Menu | Tap any row |

### Level 0: the Vault

- **Composition.** A circular ceiling. The 23 plan books sit as gilt-framed oval medallions on a spiral of about two and a half turns: Genesis on the outer rim, Acts at the oculus. The story literally moves toward the light.
- **Medallion size** scales with reading length (log scale, clamped 64–140 px at base zoom). Each shows the book name in small caps and, at closer zoom, its tagline and progress ring.
- **Bridges** appear as small gold stars on the thread between medallions; tapping one opens its card.
- **The 50 books outside the path** float in the outer cloud bands, grouped by type (Law, Histories, Wisdom, Prophets, Gospels, Letters, Apocalypse), dimmed and smaller. Tap shows a tooltip: name, one-line tagline, "Not on this path."
- **Current position** is a vermilion spark on the thread; a "Continue" button flies the camera to it.
- **Depth.** Three cloud layers move with slight parallax against the pointer or device tilt (off under reduced motion).
- **Input.** Pinch, trackpad, wheel and drag via `d3-zoom`; zoom clamped between whole-ceiling and medallion-detail; keyboard focus moves along the spiral with arrow keys.
- **Phone.** The spiral fits a portrait screen at base zoom; labels appear progressively as the user zooms (semantic zoom).
- **Accessibility.** A "List" toggle shows the same content as an ordered list; screen readers get that list, not the canvas.

### Level 1: the Book

- **Transition in.** The camera flies to the medallion (850 ms) as it grows to fill the screen. Its gilt frame becomes a book cover, which opens as two halves rotating on a vertical spine (3D `rotateY`, 700 ms), revealing the section map inside.
- **The map.** Sections as stations along a winding path: a serpentine across the screen on desktop, a gentle meander down the page on phone. Read sections are gilt discs; skims are smaller hollow rings; skips are faint folded marks on the line; optional sections branch off the path. Highlighted ("slow down") sections glow softly.
- **Header.** Book name, setting, tagline, total reading minutes, and progress.
- **Station labels.** Title and range always visible on desktop; on phone, title visible and range on tap-and-hold.
- **Transition out.** The book closes and the camera pulls back to the Vault, where the thread has advanced if a book was finished.

### Level 2: the Page

- **Transition in.** The tapped station's disc morphs into the drop cap of the section's first verse (a shared-element transition with `motion`'s `layoutId`), while the map fades behind the rising page.
- **Across books.** "Next" at the end of a book plays a short close-and-reopen sequence (book closes, thread advances, next book opens) instead of a hard cut, with any bridge card shown in between.

**Performance targets.** 60 fps camera moves on a mid-range phone (test on an iPhone 12-class device and a recent mid-range Android). Pre-render textures; animate only `transform` and `opacity`; keep the Vault's interactive layer under 300 DOM or SVG nodes at any zoom.

## 10. Reader experience

**The reader is a quiet single column of text; everything the plan adds (folds, notes, bridges, the next step) sits around the text without interrupting it.**

**Page layout**

- One column at about 34 em; on desktop a right margin column holds notes beside the verse they attach to; on phone notes become inline cards.
- A slim top bar shows book · section title and a gold progress hairline; it hides while scrolling down and returns on scroll up.
- WEBC paragraph, poetry-indent and heading markers are preserved. Verse numbers can be hidden for "story mode."

**How each status renders**

| Status | Inside a read section | As a whole section |
| --- | --- | --- |
| Read | Normal text | Normal page |
| Skim | A folded panel: "Skim · 46:8–27 · The names of Jacob's household" with a one-line summary and "Read it anyway" | A summary card with "Open the text"; the path counts it as read once seen |
| Optional | — | A branch card offered at its place in the path ("Detour: Deuteronomy 28"), off by default, switchable in settings |
| Skip | A hairline with "Skipped · Genesis 5" and its summary; expands to full text | Not a stop on the path; shown on the book map as a folded mark |
| Highlight | A thin gold bar in the margin and a "Slow down" note at the start | Same |
| Content note | A small dismissible card before the section begins | Same |

**Moving along the path**

- Each page ends with a large "Next" card naming the next section, its book if different, and its reading time; bridges and excursions appear as their own cards in sequence.
- Keyboard: ← and → for previous and next section, Esc to go up a level.
- Job's position follows the setting; the optional John 11 detour appears after luke-12 when optional sections are on.

**Progress and settings** (`localStorage`, every key prefixed `sas:v1:`; all reads wrapped in `try/catch`, and the site must work with storage unavailable)

- `progress`: `{ [sectionId]: completedAtISO }`. A section completes when its end has been scrolled into view, or by an explicit "Mark as read."
- `last`: `{ sectionId, verse }` for "Continue."
- `settings`: theme (Vault, Vellum, Auto), text size (4 steps), verse numbers on or off, Job placement, optional sections on or off; in Phase 2, second text (none or Douay-Rheims).

**Accessibility.** Semantic HTML (`article`, headings per section, `ol` for the path); visible focus; focus moves to the page heading after every transition; all maps have list equivalents; WCAG 2.2 AA.

## 11. Phase 1: build steps

**Phase 1 delivers the complete reader in eight milestones, each a pull request with a Vercel preview David can open on his phone; the content pipeline comes before any interface so the UI is built on verified text.**

| # | Milestone | Build | Done when |
| --- | --- | --- | --- |
| M0 | Scaffold | Next.js static export, TypeScript strict, ESLint, Prettier, Vitest, Playwright, GitHub Actions CI, `CLAUDE.md` with ground rules and commands | A placeholder page is live on the Vercel production URL; CI is green on a PR |
| M1 | Content pipeline | Section 5 steps 1–6: fetch and checksum WEBC, parse USFM, map versification with TVTMS, resolve the plan, validate, emit | `pnpm content:build` passes for all 24 plan books with zero coverage gaps or overlaps and every anchor found; `docs/versification-log.md` lists every renumbered reference; `docs/esther-daniel-map.md` shows how each Esther and Daniel section landed in WEBC, for David to approve before M3 merges |
| M2 | Design system | Tokens, both themes, self-hosted fonts, cloud and grain textures rendered to AVIF and WebP, a `/styleguide` page | Contrast test passes for every text pair; styleguide renders on phone and desktop |
| M3 | Reader | `/read/[sectionId]` for all sections: verses, folds by status, notes, bridges, content notes, Next card, progress, settings | All 252 section ids build; an e2e test follows Next from Genesis 1 to Acts 28 and visits steps in exactly the plan order; every fold expands; notes appear at their anchors |
| M4 | Book maps | `/book/[bookId]` with stations by status and the cover-opening transition | Every plan book shows all its sections in order; tapping a station opens the right page; back returns to the same map position |
| M5 | The Vault | `/` with the spiral, 73 books, bridges, parallax clouds, Continue, and the List toggle | Camera transitions run at 60 fps in a performance trace on a throttled mobile profile; list view exposes the same links |
| M6 | Path, sources, about | `/path` timeline, `/sources` (every source and license from section 3), `/about` | Every source in `sources/manifest.json` appears on `/sources` with its license and attribution |
| M7 | Phase 1 QA | Cross-browser pass, Lighthouse, accessibility, reduced motion, storage-blocked mode | Lighthouse mobile: performance ≥ 90, accessibility ≥ 95; axe reports no serious issues; tested on iOS Safari, Android Chrome, desktop Chrome, Safari and Firefox |

**Order of work inside a milestone:** write or extend tests first, then the code, then run the full suite, then open the PR with a short summary and the preview URL. Stop and ask David whenever the plan file and the source text disagree.

## 12. Phase 2: search, verse links and polish

**Phase 2 makes the site feel finished: searchable, with links to any verse, and a last layer of polish.** On 2026-11-10 the owner dropped the installable app (P2.1), the second text (P2.2) and printing (P2.6); they are kept below, struck through, for the record. Douay-Rheims may still be used for Phase 3 flashcards.

| # | Milestone | Done when |
| --- | --- | --- |
| P2.1 | ~~Installable and offline: web app manifest, icons, service worker caching the shell, fonts, textures and every visited section; "Download the whole path" in settings~~ (dropped 2026-11-10) | Installs to the home screen on iOS and Android; a section visited once opens in airplane mode |
| P2.2 | ~~Douay-Rheims as a second text: parallel columns on desktop, a tap-to-swap per paragraph on phone; versification aligned with TVTMS~~ (dropped 2026-11-10) | Ten spot-checked verses across Genesis, Daniel 3, Esther and Luke show the matching Douay-Rheims verse |
| P2.3 | Search with Pagefind over the built pages, scoped to the path, with results that open the section at the verse | A search for a name returns its sections in path order |
| P2.4 | Verse links: tap a verse number to copy a link to `/read/[sectionId]#v-12-3`; static Open Graph images per section | Shared links open at the verse; previews show the section title |
| P2.5 | Ambient polish: subtle light-ray drift in the oculus, cover-opening refinements, haptic tick on phone when a section completes | No frame drops in the performance trace; all effects off under reduced motion |
| P2.6 | ~~Print stylesheet for a section~~ (dropped 2026-11-10) | Prints as clean single-column text with references |

**Budgets.** Initial JavaScript on `/` under 150 KB gzipped; a section page's text arrives as its own JSON file under 60 KB gzipped; Largest Contentful Paint under 2.5 s on a throttled mobile profile.

## 13. Phase 3: word depth and language flashcards (built last)

**Deferred** (owner, 2026-11-10): this phase is a large curation effort, so it is built last, after Phases 5, 6 and 4. P3.1 (sources pinned, parsed and credited; `pnpm terms:fetch`, `pnpm terms:lookup`) is on `main`. P3.2 (the Depth toggle, the card deck, `pnpm terms:build`, generated transliteration and six Genesis seed drafts) is complete and tested, saved in closed pull request #15 to be reopened or cherry-picked when this phase resumes.

**Phase 3 marks the words whose meaning is genuinely contested and lets the reader swipe through how each language and tradition rendered them; every original-language form comes from tagged data, and every interpretive claim carries a source.** Target: 0–3 terms per section, roughly 300–500 in total, curated rather than exhaustive.

**Milestones** (one PR each)

| # | Milestone | Done when |
| --- | --- | --- |
| P3.1 ✓ | Data: every Phase 3 source pinned (`pnpm terms:fetch`, pipeline `terms`), parsed and credited; `pnpm terms:lookup <ref>` prints every layer for a verse | Parser tests pass on excerpts of each source; every source appears on `/sources` |
| P3.2 (saved, #15) | The Depth toggle and the card deck, built with the Genesis seed terms (drafts, shown on preview deployments and `/review` only) | The deck works by touch, keys and dots on both viewports; drafts never appear in production |
| P3.3+ | Book by book, in path order: candidates, approval, drafting, verification | Each book's `verified` terms pass the checks in section 18 |

**In the reader**

- A "Depth" toggle in the top bar. When on, key terms carry a faint dotted gold underline.
- Tap a term: a bottom sheet on phone, a popover on desktop, holding a horizontal deck of cards (swipe, arrow keys, or dots).
- Terms that recur (the divine name, *hesed*, *ruach*) are defined once as global terms and linked from each occurrence, with an "Elsewhere on the path" card.

**The card deck, in order** (cards that do not apply to a passage are omitted)

1. **Original**: the word in its script (Hebrew, Aramaic or Greek), a transliteration generated by code from the token, the lemma, extended Strong's id, parsed morphology, and the lexicon's gloss and semantic range.
2. **Septuagint** (Old Testament): the Greek rendering in that verse, with its lemma and gloss.
3. **Vulgate**: the Latin rendering, with its Lewis & Short sense, and a note when it shaped Catholic tradition.
4. **English**: how WEBC, Douay-Rheims, KJV and Brenton render it; modern licensed translations (RSV-2CE, NABRE, NRSV) quoted only as the rendering itself, at most five words, with attribution.
5. **Why it is debated**: two to five sentences laying out the readings (rabbinic, patristic, medieval, modern), each claim cited.
6. **Elsewhere**: other occurrences on the path and in key skipped books, linking to the sections.

**Data model** (`content/terms/<sectionId>.json`)

```ts
interface KeyTerm {
  id: string;                    // 'gen-03-15-hu'
  sectionId: string;
  ref: string;                   // 'Gen.3.15'
  english: { text: string; occurrence: number };   // span located in the WEBC verse by string match
  lang: 'hbo' | 'arc' | 'grc';
  tokens: { dataset: 'TAHOT' | 'TAGNT' | 'LXX'; ref: string; wordIndex: number }[];
  cards: Card[];
  global?: string;               // id of a shared global term
  status: 'candidate' | 'draft' | 'verified';
  sources: Citation[];
}
```

**Workflow per book**

1. **Propose.** The agent lists candidates per section with the reason each qualifies: major translations diverge; a textual variant changes the sense; the Vulgate rendering shaped doctrine or art; a word carries a theme across the path. Output: `docs/terms/<bookId>-candidates.md`.
2. **Approve.** David marks which candidates to keep.
3. **Draft.** Cards are assembled from data: tokens from TAHOT or TAGNT, aligned LXX and Vulgate verses via TVTMS, glosses from the lexicons. Interpretive text is drafted with citations.
4. **Verify.** The checks in section 18 run; anything failing stays `draft` and hidden. Septuagint forms are also checked by eye against the printed Swete (the transcription has OCR slips).
5. **Publish.** `verified` terms appear in the reader.

**Seed candidates** (a starting list only; every detail below must be confirmed against the data in step 3)

| Passage | Term | Why it is debated |
| --- | --- | --- |
| Gen 1:2 | *ruach* | "Wind" or "Spirit" of God; Vulgate *spiritus* |
| Gen 1:26 | *tselem*, *demut* | Image and likeness: one idea or two (a patristic distinction) |
| Gen 2:18 | *ezer kenegdo* | "Helper" or "partner"; *ezer* is used of God elsewhere |
| Gen 3:15 | the crushing pronoun | Hebrew "he/it," Septuagint masculine, Vulgate *ipsa* ("she"), the root of a Marian reading in the Douay-Rheims |
| Gen 12:3 | *nivrekhu* | "Shall be blessed" or "shall bless themselves" |
| Gen 32 | *Yisra'el* | The naming at the Jabbok and its etymology (verse numbering differs between Hebrew and English) |
| Exod 3:14 | *ehyeh asher ehyeh* | "I am who I am" or "I will be what I will be"; Septuagint *ego eimi ho on* |
| Exod 13:18; 15:4 | *yam suph* | Red Sea or Sea of Reeds |
| Exod 20:13 | *ratsach* | "Kill" or "murder" |
| Exod 34:29 | *qaran* | Moses' face "shone"; Vulgate *cornuta* ("horned"), hence Michelangelo's horned Moses |
| Deut 6:4 | *echad* | "One" or "alone" |
| Josh 6:17 | *cherem* | "Devoted to destruction"; Septuagint and Vulgate *anathema* |
| Judg 11:31 | Jephthah's vow | "Whatever" or "whoever" comes out |
| Ruth 1:8 and passim | *hesed* | Kindness, loyalty, steadfast love; Septuagint *eleos*, Vulgate *misericordia* |
| Ruth 3:9 | *kanaph* | "Wing" or "skirt of a garment," echoing Ruth 2:12 |
| 1 Kgs 19:12 | *qol demamah daqqah* | "Still small voice" or "sound of sheer silence" |
| Job 1:6 | *ha-satan* | A title ("the accuser") or a name; Septuagint *diabolos* |
| Job 2:9 | *barekh* | "Bless" used as a euphemism for "curse" |
| Job 42:6 | *em'as*, *nichamti* | "Despise myself and repent" or "retract and am comforted" |
| Jonah 2:1 (Hebrew) | *dag gadol* | "Great fish"; Septuagint *ketos*, hence "whale" |
| Dan 3 (Aramaic 3:25) | *bar elahin* | "A son of the gods" or "the Son of God" (Catholic numbering differs) |
| Luke 1:28 | *kecharitomene* | "Full of grace" (Vulgate *gratia plena*) or "favoured one" |
| Luke 1:35 | *episkiazo* | "Overshadow": the Septuagint's verb for the cloud on the tabernacle in Exodus 40:35, and again at the Transfiguration (Luke 9:34) |
| Luke 2:7 | *kataluma* | "Inn" or "guest room" (same word in Luke 22:11) |
| Luke 2:14 | *eudokia* | A textual variant: "goodwill toward men" or "men of goodwill" (Vulgate *bonae voluntatis*) |
| Luke 3:3 | *metanoia* | "Repentance" or "penance" (Vulgate *paenitentia*), a Reformation-era dispute |
| Luke 9:31 | *exodos* | Jesus' "departure," literally his exodus |
| Luke 11:3 | *epiousios* | "Daily" or "supersubstantial"; the Vulgate renders it differently in Luke and Matthew |
| Luke 17:21 | *entos hymon* | "Within you" or "among you" |
| Luke 22:19 | *anamnesis* | "Remembrance" or "memorial" |
| Luke 23:43 | *semeron* | Where "today" belongs, which hangs on punctuation |
| Acts 14:23 | *presbyteros* | "Elder" or "priest" (Douay-Rheims: priests) |
| Global | YHWH | Written but not spoken: *Kyrios*, *Dominus*, LORD |
| Global | *Yehoshua* | Joshua and Jesus share one name (*Iesous* in the Septuagint) |

## 14. Phase 4: connections between passages

_Built after Phases 5 and 6 (owner, 2026-11-10), so its candidate pool can include the whole Bible._

**Phase 4 adds "Threads": explained links between passages, readable from the margin of the page and visible as gold arcs across the Vault, so the reader can explore the Bible by its echoes as well as in sequence.**

**In the reader.** A small gold thread glyph in the margin marks verses with connections. Tapping it opens cards, each showing the linked passage (a short excerpt from the built text), the type of link, a two-to-four-sentence explanation, and a "Go there" button that keeps a return breadcrumb.

**On the Vault.** A "Threads" mode draws arcs between medallions, weighted by how many connections join two books, filterable by type. Tapping an arc lists its connections.

**Types:** quotation · allusion · verbal echo (a shared rare word, usually in the Septuagint) · typology (a person or event read as prefiguring another) · parallel narrative · fulfilment · contrast.

**Data model** (`content/connections/*.json`)

```ts
interface Connection {
  id: string;
  from: string;            // 'Exod.40.34-Exod.40.35'
  to: string;              // 'Luke.1.35'
  type: 'quotation' | 'allusion' | 'echo' | 'typology' | 'parallel' | 'fulfilment' | 'contrast';
  strength: 1 | 2 | 3;     // 3 = explicit quotation or named reference
  explanation: string;     // original prose, 2-4 sentences
  evidence?: { dataset: string; ref: string; wordIndex: number }[];   // shared-word proof from tagged data
  sources: Citation[];
  status: 'candidate' | 'draft' | 'verified';
}
```

**Candidate pool.** Start from OpenBible.info cross-references, keeping pairs above a vote threshold where at least one end is on the path. Links into books off the path are allowed: the other end shows its few verses only, with a note that the book is not on this path. Then curate: most raw cross-references are too loose to explain.

**Seed connections** (to be verified and written up)

| From | To | Type | The link |
| --- | --- | --- | --- |
| Exod 40:34–35 | Luke 1:35; 9:34 | Echo | The overshadowing cloud of glory and the overshadowing of Mary |
| Deut 6:4–5 | Luke 10:27 | Quotation | The Shema as the greatest commandment |
| 1 Sam 2:1–10 | Luke 1:46–55 | Parallel | Hannah's song and the Magnificat |
| 1 Kgs 17:17–24 | Luke 7:11–17 | Echo | A widow's son raised and "given to his mother" |
| 1 Kgs 17:8–16; 2 Kgs 5 | Luke 4:25–27 | Quotation | Jesus cites the widow of Zarephath and Naaman at Nazareth |
| 2 Kgs 1:10–12 | Luke 9:54–55 | Contrast | Fire from heaven called down, then refused |
| 2 Kgs 2:9–15 | Acts 1:9–2:4 | Typology | A master taken up; his spirit passes to the disciples |
| 2 Kgs 4:42–44 | Luke 9:10–17 | Parallel | A crowd fed from little, with food left over |
| Gen 11:1–9 | Acts 2:1–11 | Contrast | Babel's confusion of languages undone at Pentecost |
| Gen 22:2 | Luke 3:22 | Echo | "Your beloved son" |
| Exod 12; 24:8 | Luke 22:7–20 | Typology | Passover and the blood of the covenant at the Last Supper |
| Jonah 1–3 | Luke 11:29–32 | Quotation | The sign of Jonah |
| 2 Sam 7:12–16 | Luke 1:32–33 | Fulfilment | The throne of David promised to Mary's son |
| Tobit 5; 12 | Luke 24:13–35 | Parallel (proposed) | A companion on the road, unrecognized, revealed, then gone |
| 1 Macc 4:36–59 | John 10:22 | Allusion | The feast of Dedication (Hanukkah) |
| Exodus (whole) | Luke 9:31 | Echo | Jesus' coming "exodus" in Jerusalem |
| Isa 61:1–2 (off path) | Luke 4:18–19 | Quotation | Jesus reads his programme from Isaiah |
| Dan 7:13 (off path) | Luke 21:27; 22:69 | Quotation | The Son of Man on the clouds |
| Genesis–Kings | Acts 7 | Parallel | Stephen retells the whole story you have read |

## 15. Phase 5: the whole Bible

**Phase 5 makes every book readable, not only the path: the 49 books in the outer ring and the parts of path books the plan skips become a library beside the story, built and checked the same way.** Added on 2026-11-10 at the owner's request. The path does not change: `reading-plan.json` stays canonical, and library books never join the gold thread.

**Data.** A second canonical file, `content/plan/library.json`, holds sections for each off-path book in the same shape as the plan's sections (id, title, range, status `read`). Sections already in the plan (including `skip` sections such as John 1–10) are reused, not duplicated. Like the Esther and Daniel structure maps, each book's sections are approved by David and carry a fingerprint; any edit fails the build until approved again.

**Drafting sections.** The agent proposes each book's sections in `docs/library/<bookId>-sections.md`: titles and ranges only, derived from the book's chapter and paragraph structure in WEBC, never from scripture typed from memory. Psalms are one section per psalm, showing both the Hebrew and the Greek/Vulgate numbering (from TVTMS). Proverbs, Sirach and Wisdom are grouped by their collections; letters by their arguments; prophets by their oracles.

**On the site.** Off-path medallions open into their own book maps (same open-book transition) with every section a gilt disc. The reader shows a quiet "Library · not on the path" label and a link back to the path. Progress for the library is kept separately from path progress. Search (P2.3) widens to the whole Bible with a path/library filter.

| # | Milestone | Scope | Acceptance |
| --- | --- | --- | --- |
| P5.1 | Whole-Bible pipeline | Parse and map versification for all 73 books; coverage check across plan and library together | `pnpm content:build` places every WEBC verse of all 73 books in exactly one section (plan ∪ library), with no gaps or overlaps |
| P5.2 | Library sections | Section proposals book by book, in canonical group order (Law, Histories, Wisdom, Prophets, Gospels, Letters, Apocalypse), each approved by David | Every off-path book has approved sections with a matching fingerprint; an unapproved edit fails the build |
| P5.3 | Library reader and maps | `/read` for every library section, `/book` for all 73 books, off-path medallions open their books, Psalms and wisdom poetry laid out as verse | Every library section builds; e2e opens one book from each group and reads a section; axe reports no serious issues |
| P5.4 | Whole-Bible progress and search | Separate library progress on the Vault and book maps; search across everything with a path/library filter | A search for a name returns path results first, then library results; library reading never changes path progress |

## 16. Phase 6: themes, the constellation view

**Phase 6 adds a second way through the same Bible: the Spiral shows the story in order; Themes rearranges passages into constellations by meaning, so the reader can explore what the Bible says about mercy, suffering, prayer or family, wherever it says it.** Added on 2026-11-10 at the owner's request; it depends on Phase 5, since most thematic passages lie outside the path.

**Interaction.** A Spiral / Themes switch on the Vault. Switching morphs the scene: passages, drawn as stars, fly out of their books and settle into 8–10 constellations around the oculus, one per top-level theme, joined by gilt hairlines. Zooming into a constellation shows its sub-themes as smaller star groups, then the passages themselves, each labelled with its reference and a short title. Tapping a star opens the passage in the reader, with a breadcrumb back to the theme. Passages on the path glow gold; library passages are paler. Switching back flies every star home to its book. The reader gains a margin line, "Themes: …", linking each passage to its constellations.

**Accessibility and phones.** The constellations are decorative for assistive technology; the accessible structure is a tree (theme → sub-theme → passage), shown by the List toggle and as the default on narrow phones. Keyboard arrows move between stars in a constellation. The interactive layer stays under 300 nodes: only the focused constellation renders its passages. Reduced motion replaces the morph with a cross-fade.

**Sources and approval.** Which passage belongs to which theme is interpretation, so nothing is classified from memory:

- **Candidates** come from public datasets: Nave's Topical Bible (1896, public domain; a hierarchy of topics with verse references) and OpenBible.info topical data (license to be verified before use), both pinned in `sources/manifest.json` and credited on `/sources`.
- **The taxonomy** (top-level themes and sub-themes, with a one-line description each) is proposed in `docs/themes/taxonomy.md` and approved by David before any passages are assigned.
- **Passages** are proposed per theme in `docs/themes/<themeId>-candidates.md`, each citing its dataset row; David approves them. Unapproved items are `draft` and hidden.
- **Text** shown on a star or card is an excerpt from the built text by reference, never typed. Theme descriptions are original prose; any interpretive claim cites its source (section 18, check 12).

**Data model** (`content/themes/themes.json`)

```ts
interface Theme {
  id: string;            // "mercy"
  title: string;         // "Mercy and forgiveness"
  description: string;   // one line, original prose
  parent?: string;       // sub-themes name their theme
  passages: {
    ref: string;         // plan-style reference, e.g. "Luke 15:11-32"
    sectionId?: string;  // the plan or library section that holds it
    source: { dataset: 'naves' | 'openbible'; row: string };
    status: 'draft' | 'approved';
  }[];
}
```

| # | Milestone | Scope | Acceptance |
| --- | --- | --- | --- |
| P6.1 | Taxonomy | Import Nave's and OpenBible topics; propose 8–10 themes with sub-themes for approval | `docs/themes/taxonomy.md` approved; every theme and sub-theme has a description |
| P6.2 | Passages | Candidates per theme from the datasets, each citing its row; approval per theme | Every approved passage resolves to built sections; every one cites a dataset row; drafts are hidden in production |
| P6.3 | Constellation scene | Spiral / Themes switch, the morph, constellations, semantic zoom into sub-themes and passages | The morph runs at 60 fps in the throttled phone trace; under 300 interactive nodes at any zoom; reduced motion cross-fades |
| P6.4 | Tree, reader links and tests | The theme tree (List and phone default), "Themes" margin links in the reader, breadcrumbs back | Every star has a matching tree link; e2e walks theme → passage → back on both viewports; axe reports no serious issues |

## 17. Later: bookmarks, highlights and accounts

**Accounts and saved annotations come only after Phases 1–6, and the earlier phases are built so they slot in without rework.**

- **Features:** bookmarks, verse-range highlights in three or four muted colours, personal notes, reading progress synced across devices, export to Markdown.
- **Backend:** a hosted Postgres with built-in auth (for example Supabase, or a Postgres from the Vercel Marketplace). This ends the pure static export: the site moves to Vercel's normal Next.js deployment with a small API layer.
- **Keep ready now:** every verse has a stable id (`Gen.12.1` in WEBC numbering, plus its TVTMS standard reference), and all client state goes through one `store` module, so `localStorage` can later be swapped for a synced store. On first sign-in, local progress migrates to the account.

## 18. Accuracy and verification

**Accuracy is enforced by tests, not by care: the build fails if a verse is missing, a boundary is wrong, scripture text was written by hand, or an original-language word does not match its source row.** All checks run in CI on every pull request.

**Plan integrity** (Phase 1)

1. **Coverage:** for each plan book, the union of section ranges and inner folds equals every verse in WEBC, with no overlaps. (The committed JSON already passes this at chapter level; the pipeline repeats it at verse level.)
2. **Anchors:** every anchor's words appear in its verse, case-insensitively.
3. **Order:** the e2e walk visits every plan step in `steps` order, and nothing else.
4. **References:** section ids are unique; every `noteId` and bridge id resolves to a file; every file is referenced.
5. **Chapter ends:** these boundaries must be the last verse of their chapter in WEBC: Gen 11:32, Deut 32:52, Judg 3:31, Neh 12:47, 1 Macc 4:61, Luke 2:52, Luke 3:38, Exod 40:38.

**Text fidelity**

6. A checksum of each book's parsed text is stored; rendered section JSON must reproduce the source text exactly for a random sample of 300 verses per build.
7. **No hand-written scripture:** a test scans every file under `content/` (notes, bridges, terms, connections) and fails if any 12 consecutive words match a verse in WEBC or Douay-Rheims. Quotations of scripture must come from the built text by reference, never typed.

**Original languages** (Phase 3)

8. Each card's script form must equal, after Unicode NFC normalisation, the token at the cited dataset row.
9. Transliterations are generated by code from the token, never typed.
10. Every gloss and semantic range cites a lexicon entry id; every Septuagint and Vulgate rendering cites its verse.
11. Modern copyrighted renderings: five words maximum per card, attributed.

**Interpretation and connections** (Phases 3–4)

12. Every interpretive claim has a citation (author, work, and page or section). Where scholars disagree, the card says so instead of picking a side.
13. Anything not yet checked is `draft` and hidden in production. A dev-only `/review` page lists drafts with their sources so David can approve them.

**Interface** (Playwright, at 390×844 and 1440×900)

14. Vault → book → page → Next → back again, on both viewports; the same flow by keyboard only.
15. Reduced motion: no transform animation longer than 150 ms.
16. Storage blocked: every page still renders and navigates.
17. Accessibility: axe reports no serious or critical issues on `/`, one book map, and five pages.

## 19. Kickoff prompts

**Paste one prompt per phase into Claude Code, in the repo root, after `docs/PLAN.md` and `content/plan/reading-plan.json` are committed.** Each prompt starts the agent on its phase; it should then work milestone by milestone and stop for review at each PR.

**Phase 1**

```
Read docs/PLAN.md in full, then content/plan/reading-plan.json.

First, create CLAUDE.md containing the ground rules from section 1 verbatim, the stack from section 4, and the commands you set up. Then build Phase 1, milestones M0 to M7 from section 11, in order.

Rules that override everything else:
- reading-plan.json is canonical. Never change a range, status or order. If a range will not resolve or an anchor fails, stop and report the exact verses.
- Scripture text only ever comes from the WEBC source files through the pipeline. Never type or paraphrase a verse.
- After M1, stop and show me docs/versification-log.md and docs/esther-daniel-map.md before continuing.

Open one PR per milestone with its Vercel preview URL and what to check on my phone.
```

**Phase 2**

```
Read docs/PLAN.md sections 10, 12 and 18. Build Phase 2 milestones P2.3, P2.4 and P2.5, in order, one PR each (P2.1, P2.2 and P2.6 were dropped).
Keep every Phase 1 test green and stay inside the budgets in section 12.
```

**Phase 3** (run last, after Phase 4; start by restoring P3.2 from pull request #15)

```
Read docs/PLAN.md sections 3, 13 and 18. Set up the Phase 3 data: TAHOT, TAGNT, the Septuagint text and lemmas, the Clementine Vulgate, the lexicons and TVTMS, each pinned in sources/manifest.json with its license on /sources.
Build the Depth toggle and the card deck UI first, using the seed candidates from Genesis only.
Then, book by book in path order, write docs/terms/<bookId>-candidates.md and stop for my approval before drafting cards.
Never type a Hebrew, Aramaic, Greek or Latin word: every form comes from a dataset row you cite. Every interpretive claim cites a source. Unverified terms stay draft and hidden.
```

**Phase 4**

```
Read docs/PLAN.md sections 14 and 18. Import the OpenBible.info cross-references and filter them to pairs touching the path.
Build the margin threads and the Vault's Threads mode using the seed connections first.
Then propose connections book by book in docs/connections/<bookId>-candidates.md for my approval. Explanations are original prose with sources; quote scripture only by reference to the built text.
```

**Phase 5**

```
Read docs/PLAN.md sections 5, 15 and 18. Extend the pipeline to all 73 books (P5.1) and keep reading-plan.json untouched.
Then propose library sections book by book in docs/library/<bookId>-sections.md, in canonical group order, and stop for my approval on each group before building it.
Section titles and ranges only; never type scripture.
```

**Phase 6**

```
Read docs/PLAN.md sections 9, 16 and 18. Import Nave's Topical Bible and (once its license is confirmed) OpenBible.info topics, pinned in sources/manifest.json.
Propose the taxonomy in docs/themes/taxonomy.md and stop for my approval. Then propose passages theme by theme, each citing its dataset row.
Build the Spiral / Themes switch and the constellation scene with approved themes only; drafts stay hidden.
```
