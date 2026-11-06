/**
 * Step 4 — resolve-plan: expand every section's range (plan numbering) into WEBC verses, settle
 * WEBC verses that two plan verses share (split verses) and WEBC verses with no plan-numbered
 * counterpart, then check every anchor.
 */
import type { PlanBook, PlanSection, ReadingPlan } from '../lib/types';
import type { BookMapping } from './map-versification';
import { expandRange, type PlanKey } from './lib/ranges';

export interface ResolvedFold {
  range: string;
  status: 'skim' | 'skip';
  label: string;
  units: string[];
}

export interface ResolvedSection {
  section: PlanSection;
  bookId: string;
  order: number;
  units: string[]; // WEBC unit refs in WEBC order
  folds: ResolvedFold[];
}

export interface AnchorResult {
  sectionId: string;
  ref: string; // plan numbering
  webc: string[];
  mustContain: string[];
  missing: string[];
  inSection: boolean;
  kind: 'plan' | 'structure-map';
}

export interface Decision {
  kind: 'split-verse' | 'orphan-verse';
  bookId: string;
  unit: string;
  assignedTo: string;
  candidates: string[];
  detail: string;
}

export interface Resolution {
  sections: ResolvedSection[];
  anchors: AnchorResult[];
  decisions: Decision[];
  errors: string[];
}

export function wordPresent(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\p{L}])${esc}($|[^\\p{L}])`, 'iu').test(text);
}

function unitsFor(keys: PlanKey[], m: BookMapping): string[] {
  const set = new Set<string>();
  for (const k of keys) for (const u of m.planToUnits.get(k) ?? []) set.add(u);
  return [...set].sort((a, b) => m.unitOrder.get(a)! - m.unitOrder.get(b)!);
}

function planOrder(a: PlanKey, b: PlanKey): number {
  const [ca, va] = a.split(':');
  const [cb, vb] = b.split(':');
  const na = /^\d+$/.test(ca!) ? Number(ca) : -1;
  const nb = /^\d+$/.test(cb!) ? Number(cb) : -1;
  return na !== nb ? na - nb : ca !== cb ? ca!.localeCompare(cb!) : Number(va) - Number(vb);
}

export function resolveBook(book: PlanBook, m: BookMapping): Resolution {
  const errors: string[] = [];
  const decisions: Decision[] = [];
  const anchors: AnchorResult[] = [];

  // 1. Expand ranges.
  const claimed = new Map<string, { sectionId: string; keys: PlanKey[] }[]>();
  const sectionKeys = new Map<string, PlanKey[]>();
  for (const s of book.sections) {
    let keys: PlanKey[] = [];
    try {
      keys = expandRange(s.range, m.inventory);
    } catch (err) {
      errors.push(`${s.id}: range "${s.range}" does not resolve: ${(err as Error).message}`);
      continue;
    }
    sectionKeys.set(s.id, keys);
    for (const k of keys) {
      for (const u of m.planToUnits.get(k) ?? []) {
        const list = claimed.get(u) ?? [];
        const entry = list.find((e) => e.sectionId === s.id);
        if (entry) entry.keys.push(k);
        else list.push({ sectionId: s.id, keys: [k] });
        claimed.set(u, list);
      }
    }
  }

  // 2. Settle ownership.
  const owner = new Map<string, string>();
  for (const [u, list] of claimed) {
    if (list.length === 1) {
      owner.set(u, list[0]!.sectionId);
      continue;
    }
    const planKeys = m.unitToPlan.get(u) ?? [];
    if (planKeys.length > 1) {
      // One WEBC verse holds the text of several plan verses that fall in different sections.
      const first = [...list].sort((a, b) =>
        planOrder(a.keys.sort(planOrder)[0]!, b.keys.sort(planOrder)[0]!),
      )[0]!;
      owner.set(u, first.sectionId);
      decisions.push({
        kind: 'split-verse',
        bookId: book.id,
        unit: u,
        assignedTo: first.sectionId,
        candidates: list.map((e) => `${e.sectionId} (plan ${e.keys.join(', ')})`),
        detail: `WEBC ${u} contains plan verses ${planKeys.join(' + ')}; WEBC cannot divide it, so it stays with the section holding its first part.`,
      });
    } else {
      errors.push(`Overlap: WEBC ${u} is claimed by ${list.map((e) => e.sectionId).join(' and ')}`);
    }
  }
  // WEBC verses with no plan-numbered counterpart go with the preceding verse's section.
  for (const o of m.orphans) {
    const i = m.unitOrder.get(o.unit)!;
    const neighbour = m.units[i - 1] ?? m.units[i + 1];
    const to = neighbour ? owner.get(neighbour.ref) : undefined;
    if (!to) {
      errors.push(`WEBC ${o.unit} has no plan counterpart and no neighbouring section`);
      continue;
    }
    owner.set(o.unit, to);
    decisions.push({
      kind: 'orphan-verse',
      bookId: book.id,
      unit: o.unit,
      assignedTo: to,
      candidates: [to],
      detail: `WEBC ${o.unit} has no counterpart in Hebrew numbering (${o.source}); it goes with the verse before it.`,
    });
  }

  // 3. Coverage: every WEBC unit exactly once.
  const gaps = m.units.filter((u) => !owner.has(u.ref)).map((u) => u.ref);
  if (gaps.length) errors.push(`Coverage gap in ${book.id}: ${compress(gaps)}`);

  // 4. Build sections, folds, contiguity and order checks.
  const sections: ResolvedSection[] = [];
  let prevLast = -1;
  book.sections.forEach((s, idx) => {
    const units = m.units.filter((u) => owner.get(u.ref) === s.id).map((u) => u.ref);
    if (!units.length) {
      errors.push(`${s.id}: resolves to no WEBC verses`);
      return;
    }
    const first = m.unitOrder.get(units[0]!)!;
    const last = m.unitOrder.get(units.at(-1)!)!;
    if (last - first + 1 !== units.length) errors.push(`${s.id}: WEBC verses are not contiguous`);
    if (first <= prevLast)
      errors.push(`${s.id}: starts before the previous section ends (plan order vs WEBC order)`);
    prevLast = last;
    const folds: ResolvedFold[] = [];
    for (const f of s.inner ?? []) {
      try {
        const fu = unitsFor(expandRange(f.range, m.inventory), m).filter(
          (u) => owner.get(u) === s.id,
        );
        const outside = unitsFor(expandRange(f.range, m.inventory), m).filter(
          (u) => owner.get(u) !== s.id,
        );
        if (outside.length)
          errors.push(
            `${s.id}: inner fold ${f.range} reaches outside the section (${outside.join(', ')})`,
          );
        folds.push({ ...f, units: fu });
      } catch (err) {
        errors.push(`${s.id}: inner fold "${f.range}" does not resolve: ${(err as Error).message}`);
      }
    }
    sections.push({ section: s, bookId: book.id, order: idx + 1, units, folds });
  });

  // 5. Anchors.
  const textOf = new Map(m.units.map((u) => [u.ref, u.text]));
  const checkAnchor = (
    sectionId: string,
    ref: string,
    words: string[],
    kind: AnchorResult['kind'],
  ) => {
    const units = m.planToUnits.get(ref) ?? [];
    const text = units.map((u) => textOf.get(u) ?? '').join(' ');
    const missing = units.length ? words.filter((w) => !wordPresent(text, w)) : [...words];
    const inSection = kind === 'structure-map' || units.some((u) => owner.get(u) === sectionId);
    anchors.push({ sectionId, ref, webc: units, mustContain: words, missing, inSection, kind });
    if (!units.length) errors.push(`${sectionId}: anchor ${ref} does not resolve to a WEBC verse`);
    else if (missing.length) {
      errors.push(
        `${sectionId}: anchor ${book.id} ${ref} (WEBC ${units.join(', ')}) is missing ${missing.map((w) => `«${w}»`).join(', ')}. WEBC text: "${text}"`,
      );
    } else if (!inSection)
      errors.push(`${sectionId}: anchor ${ref} lies outside the section in WEBC`);
  };
  for (const s of book.sections)
    for (const a of s.anchors ?? []) checkAnchor(s.id, a.ref, a.mustContain, 'plan');
  for (const c of m.structureChecks)
    checkAnchor(`structure-map:${book.id}`, c.ref, c.mustContain, 'structure-map');

  return { sections, anchors, decisions, errors };
}

export function resolvePlan(plan: ReadingPlan, mappings: Map<string, BookMapping>): Resolution {
  const out: Resolution = { sections: [], anchors: [], decisions: [], errors: [] };
  for (const book of plan.books) {
    const r = resolveBook(book, mappings.get(book.id)!);
    out.sections.push(...r.sections);
    out.anchors.push(...r.anchors);
    out.decisions.push(...r.decisions);
    out.errors.push(...r.errors);
  }
  return out;
}

/** 'Gen.1.1, Gen.1.2, Gen.1.3' → 'Gen.1.1–Gen.1.3' runs, for messages. */
export function compress(refs: string[]): string {
  if (refs.length <= 6) return refs.join(', ');
  return `${refs.slice(0, 3).join(', ')} … ${refs.slice(-3).join(', ')} (${refs.length} verses)`;
}
