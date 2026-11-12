/**
 * Step 3 — map-versification: for each plan book, build a table from plan references (Catholic,
 * Hebrew-based numbering as in NABRE) to WEBC verses.
 *
 *  - Hebrew-numbered books: STEPBible TVTMS records (English KJV ↔ Hebrew columns). Before a record
 *    is applied, its TEST lines are evaluated against WEBC to prove WEBC follows the English column.
 *  - Esther and Daniel: content/plan/structure-maps.json (WEBC uses their Greek form).
 *  - Other books (Tobit, Judith, 1 Maccabees, Luke, John, Acts): identity, verified by anchors.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import type { Verse } from '../lib/types';
import { CANON_BY_ID, type CanonBook } from './lib/canon';
import { type Inventory, type PlanKey, keyOf, splitKey } from './lib/ranges';
import { type TvtmsRecord, evaluateTest, parseTvtmsCell, type TestResult } from './lib/tvtms';
import type { ParsedBook } from './parse-usfm';

export interface RenumberEntry {
  plan: PlanKey;
  webc: string[]; // unit refs
  source: string; // e.g. 'TVTMS Gen.31:55--32:32 (line 184)'
}

export interface RecordCheck {
  header: string;
  line: number;
  decision:
    | 'applied'
    | 'identical'
    | 'same-tests'
    | 'webc-follows-hebrew'
    | 'undetermined'
    | 'not-applicable';
  english: TestResult[];
  hebrew: TestResult[];
}

export interface OrphanEntry {
  unit: string;
  source: string;
}

export interface BookMapping {
  book: CanonBook;
  kind: 'identity' | 'tvtms' | 'structure';
  units: Verse[]; // WEBC verses (Esther 1:1 split in two) in WEBC order
  unitOrder: Map<string, number>;
  inventory: Inventory; // plan numbering
  planToUnits: Map<PlanKey, string[]>;
  unitToPlan: Map<string, PlanKey[]>;
  orphans: OrphanEntry[]; // WEBC units with no plan-numbered counterpart
  renumbered: RenumberEntry[]; // plan keys whose WEBC location differs from their number
  recordChecks: RecordCheck[];
  structureChecks: { ref: string; mustContain: string[] }[];
}

const StructureMapsSchema = z.object({
  note: z.string(),
  books: z.record(
    z.string(),
    z.object({
      source: z.string(),
      approval: z.object({ by: z.string(), date: z.string(), fingerprint: z.string() }).optional(),
      splits: z.array(
        z.object({ ref: z.string(), afterBlockEndingWith: z.string(), why: z.string() }),
      ),
      segments: z.array(
        z.object({
          plan: z.string(),
          webc: z.string(),
          mode: z.enum(['pairwise', 'set']).optional(),
          why: z.string(),
        }),
      ),
      checks: z.array(z.object({ ref: z.string(), mustContain: z.array(z.string()) })),
    }),
  ),
});
export type StructureMaps = z.infer<typeof StructureMapsSchema>;

/** Fingerprint of the parts of a book's structure map that decide where verses land. */
export function structureFingerprint(spec: StructureMaps['books'][string]): string {
  const { splits, segments, checks } = spec;
  return createHash('sha256')
    .update(JSON.stringify({ splits, segments, checks }))
    .digest('hex')
    .slice(0, 16);
}

/** A structure map must carry an approval whose fingerprint matches its current content. */
export function checkStructureApprovals(maps: StructureMaps): string[] {
  const errors: string[] = [];
  for (const [id, spec] of Object.entries(maps.books)) {
    const fp = structureFingerprint(spec);
    if (!spec.approval) errors.push(`structure-maps.json ${id}: not approved (fingerprint ${fp})`);
    else if (spec.approval.fingerprint !== fp) {
      errors.push(
        `structure-maps.json ${id}: changed since it was approved on ${spec.approval.date} (approved ${spec.approval.fingerprint}, now ${fp}); needs re-approval`,
      );
    }
  }
  return errors;
}

export function readStructureMaps(file: string): StructureMaps {
  return StructureMapsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function unitKey(v: Verse): string {
  return v.part ? `${v.c}:${v.v}!${v.part}` : `${v.c}:${v.v}`;
}

function base(book: CanonBook, units: Verse[], kind: BookMapping['kind']): BookMapping {
  return {
    book,
    kind,
    units,
    unitOrder: new Map(units.map((u, i) => [u.ref, i])),
    inventory: new Map(),
    planToUnits: new Map(),
    unitToPlan: new Map(),
    orphans: [],
    renumbered: [],
    recordChecks: [],
    structureChecks: [],
  };
}

function link(m: BookMapping, plan: PlanKey, unitRef: string) {
  const units = m.planToUnits.get(plan) ?? [];
  if (!units.includes(unitRef)) units.push(unitRef);
  m.planToUnits.set(plan, units);
  const plans = m.unitToPlan.get(unitRef) ?? [];
  if (!plans.includes(plan)) plans.push(plan);
  m.unitToPlan.set(unitRef, plans);
  const { c, v } = splitKey(plan);
  const list = m.inventory.get(c) ?? [];
  if (!list.includes(v)) list.push(v);
  m.inventory.set(c, list);
}

function finish(m: BookMapping): BookMapping {
  for (const [c, list] of m.inventory)
    m.inventory.set(
      c,
      list.sort((a, b) => a - b),
    );
  for (const [plan, units] of m.planToUnits) {
    units.sort((a, b) => m.unitOrder.get(a)! - m.unitOrder.get(b)!);
    const same = units.length === 1 && units[0] === `${m.book.id}.${plan.replace(':', '.')}`;
    if (!same && !m.renumbered.some((r) => r.plan === plan)) {
      // Structure maps record their own source; anything else is an unexplained renumbering.
      throw new Error(`${m.book.id} ${plan}: renumbered without a recorded source`);
    }
  }
  return m;
}

export function identityMapping(parsed: ParsedBook): BookMapping {
  const m = base(parsed.book, parsed.verses, 'identity');
  for (const u of parsed.verses) link(m, keyOf(u.c, u.v), u.ref);
  return finish(m);
}

// ---------------------------------------------------------------------------
// TVTMS (Hebrew-numbered books)
// ---------------------------------------------------------------------------

export function tvtmsMapping(parsed: ParsedBook, records: TvtmsRecord[]): BookMapping {
  const { book } = parsed;
  const m = base(book, parsed.verses, 'tvtms');
  const exists = new Set(parsed.verses.map((v) => keyOf(v.c, v.v)));
  const hebToEng = new Map<PlanKey, { eng: string[]; source: string }>();
  const engCovered = new Set<string>();
  const orphanKeys = new Set<string>();

  for (const rec of records.filter((r) => r.book === book.tvtms)) {
    const e = rec.columns.findIndex((c) => c.startsWith('English'));
    const h = rec.columns.findIndex((c) => c === 'Hebrew');
    if (e < 0 || h < 0) continue;
    const norm = (s: string | undefined) => (s ?? '').replace(/\s+/g, '');
    const english = rec.tests.map((t) =>
      evaluateTest(t[e] ?? '', parsed.chapterLengths, book.tvtms),
    );
    const hebrew = rec.tests.map((t) =>
      evaluateTest(t[h] ?? '', parsed.chapterLengths, book.tvtms),
    );
    const check: RecordCheck = {
      header: rec.header,
      line: rec.line,
      decision: 'identical',
      english,
      hebrew,
    };
    m.recordChecks.push(check);
    if (rec.rows.every((r) => norm(r.cells[e]) === norm(r.cells[h]))) continue;
    // A record whose English and Hebrew columns name no verse of this book (e.g. 2Ch.37, where
    // English is the Prayer of Manasseh, "Man.1:1-15", and Hebrew "NoVerse") cannot move any verse
    // WEBC prints here: it does not apply.
    const ofBook = (s: string | undefined) => (s ?? '').includes(`${book.tvtms}.`);
    if (rec.rows.every((r) => !ofBook(r.cells[e]) && !ofBook(r.cells[h]))) {
      check.decision = 'not-applicable';
      continue;
    }

    const passes = (rs: TestResult[]) => rs.includes('pass') && !rs.includes('fail');
    if (rec.tests.every((t) => norm(t[e]) === norm(t[h])) && passes(english)) {
      // The tests cannot tell the two columns apart, so they differ only in subverse divisions
      // that WEBC does not have (e.g. Jos.9:27.1-6). Nothing to renumber.
      check.decision = 'same-tests';
      continue;
    }
    if (passes(english) && !passes(hebrew)) check.decision = 'applied';
    else if (passes(hebrew) && !passes(english)) {
      check.decision = 'webc-follows-hebrew';
      continue;
    } else {
      check.decision = 'undetermined';
      throw new Error(
        `TVTMS ${rec.header} (line ${rec.line}): cannot tell whether WEBC follows English or Hebrew numbering ` +
          `(English tests ${english.join(',')}; Hebrew tests ${hebrew.join(',')}).`,
      );
    }

    for (const row of rec.rows) {
      const eng = parseTvtmsCell(row.cells[e] ?? '');
      const heb = parseTvtmsCell(row.cells[h] ?? '');
      const source = `TVTMS ${rec.header} (line ${row.line}, ${row.type})`;
      const engRefs = (eng ?? []).map(({ c, v }) => {
        const k = keyOf(c, v);
        if (!exists.has(k)) throw new Error(`${source}: English ${k} not found in WEBC ${book.id}`);
        return k;
      });
      engRefs.forEach((k) => engCovered.add(k));
      if (!heb) {
        // English verse with no Hebrew counterpart (e.g. Neh 7:68).
        engRefs.forEach((k) => orphanKeys.add(k));
        engRefs.forEach((k) =>
          m.orphans.push({ unit: `${book.id}.${k.replace(':', '.')}`, source }),
        );
        continue;
      }
      if (!eng)
        throw new Error(`${source}: Hebrew verse with no English counterpart is not supported`);
      const hebKeys = heb.map(({ c, v }) => keyOf(c, v));
      const pairs: [PlanKey, string][] = [];
      if (hebKeys.length === engRefs.length)
        hebKeys.forEach((hk, i) => pairs.push([hk, engRefs[i]!]));
      else if (engRefs.length === 1) hebKeys.forEach((hk) => pairs.push([hk, engRefs[0]!]));
      else if (hebKeys.length === 1) engRefs.forEach((ek) => pairs.push([hebKeys[0]!, ek]));
      else
        throw new Error(
          `${source}: cannot align ${hebKeys.length} Hebrew with ${engRefs.length} English verses`,
        );
      for (const [hk, ek] of pairs) {
        const entry = hebToEng.get(hk) ?? { eng: [], source };
        if (!entry.eng.includes(ek)) entry.eng.push(ek);
        hebToEng.set(hk, entry);
      }
    }
  }

  for (const [hk, { eng, source }] of hebToEng) {
    for (const ek of eng) link(m, hk, `${book.id}.${ek.replace(':', '.')}`);
    if (!(eng.length === 1 && eng[0] === hk)) {
      m.renumbered.push({
        plan: hk,
        webc: eng.map((k) => `${book.id}.${k.replace(':', '.')}`),
        source,
      });
    }
  }
  for (const u of parsed.verses) {
    const k = keyOf(u.c, u.v);
    if (engCovered.has(k) || orphanKeys.has(k)) continue;
    if (hebToEng.has(k)) {
      throw new Error(
        `${book.id} ${k}: Hebrew verse claimed both by a TVTMS record and by identity`,
      );
    }
    link(m, k, u.ref);
  }
  return finish(m);
}

// ---------------------------------------------------------------------------
// Structure maps (Esther, Daniel)
// ---------------------------------------------------------------------------

function expandSimple(spec: string): { c: string; v: number; part?: string }[] {
  const m = /^(\d+|[A-F]):(\d+)(?:-(\d+))?(?:!([a-z]))?$/.exec(spec);
  if (!m) throw new Error(`structure-maps: cannot parse "${spec}"`);
  const from = Number(m[2]);
  const to = m[3] ? Number(m[3]) : from;
  if (m[4] && m[3]) throw new Error(`structure-maps: a split part cannot be a range ("${spec}")`);
  const out: { c: string; v: number; part?: string }[] = [];
  for (let v = from; v <= to; v++) out.push(m[4] ? { c: m[1]!, v, part: m[4] } : { c: m[1]!, v });
  return out;
}

export function structureMapping(parsed: ParsedBook, maps: StructureMaps): BookMapping {
  const { book } = parsed;
  const spec = maps.books[book.id];
  if (!spec) throw new Error(`structure-maps.json has no entry for ${book.id}`);

  // Apply verse splits.
  const units: Verse[] = [];
  for (const v of parsed.verses) {
    const split = spec.splits.find((s) => s.ref === keyOf(v.c, v.v));
    if (!split) {
      units.push(v);
      continue;
    }
    const cut = v.blocks.findIndex((b) => b.text.endsWith(split.afterBlockEndingWith));
    if (cut < 0 || cut === v.blocks.length - 1) {
      throw new Error(
        `${book.id} ${split.ref}: no block ending with "${split.afterBlockEndingWith}" to split at`,
      );
    }
    const a = v.blocks.slice(0, cut + 1);
    const b = v.blocks.slice(cut + 1);
    const textA = a.map((x) => x.text).join(' ');
    const textB = b.map((x) => x.text).join(' ');
    if (v.wj?.length)
      throw new Error(
        `${book.id} ${split.ref}: splitting a verse with words-of-Jesus spans is not supported`,
      );
    const notesA = (v.footnotes ?? []).filter((n) => n.at <= textA.length);
    const notesB = (v.footnotes ?? [])
      .filter((n) => n.at > textA.length)
      .map((n) => ({ ...n, at: n.at - textA.length - 1 }));
    const ua: Verse = { ref: `${v.ref}!a`, c: v.c, v: v.v, part: 'a', text: textA, blocks: a };
    const ub: Verse = { ref: `${v.ref}!b`, c: v.c, v: v.v, part: 'b', text: textB, blocks: b };
    if (v.heading) ua.heading = v.heading;
    if (notesA.length) ua.footnotes = notesA;
    if (notesB.length) ub.footnotes = notesB;
    units.push(ua, ub);
  }

  const m = base(book, units, 'structure');
  const byKey = new Map(units.map((u) => [unitKey(u), u.ref]));
  const targeted = new Set<string>();
  for (const seg of spec.segments) {
    const plans = expandSimple(seg.plan).map((p) => keyOf(p.c, p.v));
    const webc = expandSimple(seg.webc).map((w) => {
      const ref = byKey.get(w.part ? `${w.c}:${w.v}!${w.part}` : `${w.c}:${w.v}`);
      if (!ref) throw new Error(`structure-maps ${book.id}: WEBC unit ${seg.webc} does not exist`);
      return ref;
    });
    webc.forEach((r) => targeted.add(r));
    const source = `structure-maps.json ${book.id} ${seg.plan} → ${seg.webc}`;
    let pairs: [PlanKey, string][];
    if (plans.length === webc.length) pairs = plans.map((p, i) => [p, webc[i]!]);
    else if (webc.length === 1) pairs = plans.map((p) => [p, webc[0]!]);
    else if (seg.mode === 'set')
      pairs = plans.flatMap((p) => webc.map((w) => [p, w] as [PlanKey, string]));
    else
      throw new Error(
        `${source}: ${plans.length} plan verses vs ${webc.length} WEBC verses; set mode "set" to allow`,
      );
    for (const [p, w] of pairs) link(m, p, w);
    for (const p of plans) {
      const ws = m.planToUnits.get(p)!;
      if (!(ws.length === 1 && ws[0] === `${book.id}.${p.replace(':', '.')}`)) {
        if (!m.renumbered.some((r) => r.plan === p))
          m.renumbered.push({ plan: p, webc: ws, source });
      }
    }
  }
  for (const u of units) {
    if (targeted.has(u.ref)) continue;
    if (u.part) throw new Error(`${book.id} ${u.ref}: split part not mapped by any segment`);
    const k = keyOf(u.c, u.v);
    if (m.planToUnits.has(k)) throw new Error(`${book.id} ${k}: plan verse mapped twice`);
    link(m, k, u.ref);
  }
  m.structureChecks = spec.checks;
  return finish(m);
}

export function buildMappings(
  parsed: Map<string, ParsedBook>,
  planBookIds: string[],
  records: TvtmsRecord[],
  maps: StructureMaps,
): Map<string, BookMapping> {
  const out = new Map<string, BookMapping>();
  for (const id of planBookIds) {
    const p = parsed.get(id);
    const book = CANON_BY_ID.get(id);
    if (!p || !book) throw new Error(`Plan book ${id} not found in WEBC`);
    if (maps.books[id]) out.set(id, structureMapping(p, maps));
    else if (book.hebrewNumbering) out.set(id, tvtmsMapping(p, records));
    else out.set(id, identityMapping(p));
  }
  return out;
}
