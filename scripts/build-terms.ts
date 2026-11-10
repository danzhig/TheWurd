/**
 * pnpm terms:build — assemble the key-term card decks (PLAN §13) from `content/terms/*.json`.
 * Authors cite rows; every form, gloss and rendering is copied from the cited source here, and
 * each citation is checked: the English words must occur in the WEBC verse, the Vulgate and
 * English renderings in their verses, the Lewis & Short quote in its sense. Any failure stops the
 * build. Needs the Phase 3 sources (`pnpm terms:fetch`); writes `public/data/terms/<id>.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CANON_BY_ID } from './lib/canon';
import { CONTENT_DIR, DATA_DIR } from './lib/paths';
import { loadTermSources, type TermSources } from './terms/sources';
import { transliterateGreek, transliterateHebrew } from '../lib/translit';
import {
  TermFileSchema,
  VERSION_NAME,
  type BuiltTerm,
  type Card,
  type TermInput,
} from '../lib/terms';
import { verseText, type SectionFile } from '../lib/types';

const TERMS_IN = path.join(CONTENT_DIR, 'terms');
const TERMS_OUT = path.join(DATA_DIR, 'terms');

function fail(term: string, msg: string): never {
  throw new Error(`${term}: ${msg}`);
}

/** Start offset of the n-th occurrence of `needle` in `hay`, or -1. */
function nth(hay: string, needle: string, n: number): number {
  let at = -1;
  for (let i = 0; i < n; i++) {
    at = hay.indexOf(needle, at + 1);
    if (at < 0) return -1;
  }
  return at;
}

/**
 * The grammar of one part of a word: TAHOT writes "Hc/VNq3cp" for prefix + verb, with the "H"
 * once, so later parts get it back; the part is the one at the cited Strong's position.
 */
function grammarOf(
  code: string,
  index: number,
  hebrew: boolean,
  morph: Map<string, string>,
): string | undefined {
  const parts = code.split('/');
  const part = parts[index >= 0 && index < parts.length ? index : parts.length - 1]!;
  const full = hebrew && !/^H/.test(part) ? `H${part}` : part;
  const raw = morph.get(full) ?? morph.get(code);
  return raw ? plainGrammar(raw) : undefined;
}

/**
 * "Function=Pronoun ; Form=Personal ; Person=Third; Gender=Masculine" → "Pronoun, personal,
 * third person, masculine". Bracketed asides from the code table are kept.
 */
export function plainGrammar(raw: string): string {
  const parts = raw
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [key, ...rest] = p.split('=');
      const value = rest.join('=').trim();
      if (!value) return key!.trim();
      return key!.trim() === 'Person' ? `${value} person` : value;
    });
  const text = parts
    .join(', ')
    .replace(/\b[A-Za-z]+=/g, '') // "(hence Action=Simple)" → "(hence simple)"
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stepKey(osis: string): string {
  const [book, c, v] = osis.split('.');
  const b = CANON_BY_ID.get(book!);
  return b ? `${b.tvtms}.${c}.${v}` : osis;
}

export function buildTerm(t: TermInput, section: SectionFile, s: TermSources): BuiltTerm {
  const [, c, v] = t.ref.split('.').map(Number);
  const verse = section.verses.find((x) => x.c === c && x.v === v);
  if (!verse) fail(t.id, `${t.ref} is not in ${section.id}`);
  const text = verseText(verse);
  const start = nth(text, t.english.text, t.english.occurrence);
  if (start < 0)
    fail(t.id, `"${t.english.text}" (#${t.english.occurrence}) not found in WEBC ${t.ref}`);

  const citations: string[] = [];
  const isHebrew = t.lang !== 'grc';
  const lexicon = isHebrew ? s.tbesh : s.tbesg;
  const morph = isHebrew ? s.hebrewMorph : s.greekMorph;
  const translit = (x: string) => (isHebrew ? transliterateHebrew(x) : transliterateGreek(x));

  const heads: string[] = [];
  const original = t.original.map((o) => {
    const words = (o.dataset === 'TAHOT' ? s.hebrew : s.greek).get(stepKey(o.ref));
    const tok = words?.find((w) => w.wordIndex === o.wordIndex);
    if (!tok) fail(t.id, `${o.dataset} ${o.ref} has no word #${o.wordIndex}`);
    const strongs = o.strongs ?? tok.lexeme;
    if (!tok.strongs.includes(strongs) && tok.lexeme !== strongs)
      fail(
        t.id,
        `${o.dataset} ${o.ref} #${o.wordIndex} is ${tok.strongs.join('/')}, not ${strongs}`,
      );
    const lex = lexicon.get(strongs);
    const cite = `${tok.file}, line ${tok.line} (${o.ref} word ${o.wordIndex})`;
    citations.push(cite);
    if (lex) citations.push(`${lex.file} ${lex.id}, line ${lex.line}`);
    // Morpheme separators and the verse-end mark (sof pasuq) are not part of the word.
    const strip = (x: string) => x.replace(/[/\\׃]/g, '').trim();
    const form = strip(tok.text);
    // The card's title word: a verb as written (without its prefixes and suffixes), anything else
    // in its dictionary form.
    const index = tok.strongs.indexOf(strongs);
    const isVerb = /^H?V|^V-/.test(tok.grammar.split('/')[index] ?? tok.grammar);
    const part = strip(tok.text.split('/')[index] ?? form);
    const head = translit(isVerb ? part : (lex?.lemma ?? tok.lemma ?? form));
    heads.push(head);
    return {
      form,
      translit: translit(form),
      lemma: lex?.lemma ?? tok.lemma,
      strongs,
      grammar: tok.grammar,
      grammarText: grammarOf(tok.grammar, tok.strongs.indexOf(strongs), isHebrew, morph),
      gloss: lex?.gloss ?? tok.gloss,
      meaning: lex?.meaning.split('\n').slice(0, 8),
      cite,
    };
  });

  const lxx = t.lxx.map((l) => {
    const tok = s.lxx.get(l.ref)?.find((w) => w.wordIndex === l.wordIndex);
    if (!tok) fail(t.id, `Septuagint ${l.ref} has no word #${l.wordIndex}`);
    const cite = `Swete, ${tok.file} (${l.ref} word ${l.wordIndex})`;
    citations.push(cite);
    return { form: tok.text, translit: transliterateGreek(tok.text), lemma: tok.lemma, cite };
  });

  let vulgate: Extract<Card, { kind: 'vulgate' }> | null = null;
  if (t.vulgate) {
    const vt = s.vulgate.get(t.vulgate.ref);
    if (!vt?.includes(t.vulgate.words))
      fail(t.id, `Vulgate ${t.vulgate.ref} does not contain "${t.vulgate.words}"`);
    citations.push(`Clementine Vulgate ${t.vulgate.ref}`);
    let sense;
    if (t.vulgate.lewisShort) {
      const { key, sense: id, quote } = t.vulgate.lewisShort;
      const entry = s.lewisShort.get(key);
      const sn = entry?.senses.find((x) => x.id === id);
      if (!sn) fail(t.id, `Lewis & Short has no sense ${id} under ${key}`);
      if (!sn.text.includes(quote)) fail(t.id, `Lewis & Short ${id} does not contain "${quote}"`);
      citations.push(`Lewis & Short, ${entry!.orth}, Perseus ${id}`);
      sense = { headword: entry!.orth, text: quote, cite: `Lewis & Short, Perseus ${id}` };
    }
    vulgate = { kind: 'vulgate', words: t.vulgate.words, ref: t.vulgate.ref, sense };
  }

  const renderings = [{ version: 'webc', ref: t.ref, words: t.english.text }];
  const maps = { drc: s.drc, kjv: s.kjv, brenton: s.brenton };
  for (const r of t.renderings) {
    const vt = maps[r.version].get(r.ref);
    if (!vt?.includes(r.words)) fail(t.id, `${r.version} ${r.ref} does not contain "${r.words}"`);
    citations.push(`${VERSION_NAME[r.version]} ${r.ref}`);
    renderings.push({ version: r.version, ref: r.ref, words: r.words });
  }

  const fill = (txt: string) =>
    txt.replace(/\{(\w+)\}/g, (m, key: string) => {
      const value: Record<string, string | undefined> = {
        original: original.map((o) => o.form).join(' '),
        grammar: original[0]?.grammarText?.toLowerCase(),
        lxx: lxx.map((l) => l.form).join(' '),
        vulgate: t.vulgate?.words,
        webc: t.english.text,
        drc: t.renderings.find((r) => r.version === 'drc')?.words,
        kjv: t.renderings.find((r) => r.version === 'kjv')?.words,
        brenton: t.renderings.find((r) => r.version === 'brenton')?.words,
      };
      const out = value[key];
      if (out === undefined) fail(t.id, `debate placeholder ${m} has no data`);
      return out;
    });

  const cards: Card[] = [{ kind: 'original', lang: t.lang, words: original }];
  if (lxx.length)
    cards.push({ kind: 'septuagint', words: lxx, printCheck: t.status !== 'verified' });
  if (vulgate) cards.push(vulgate);
  cards.push({ kind: 'english', renderings });
  if (t.debate)
    cards.push({ kind: 'debate', text: fill(t.debate.text), sources: t.debate.sources });

  // PLAN §18 check 12: a verified term's interpretive text must cite its sources.
  if (t.status === 'verified' && t.debate && !t.debate.sources.length)
    fail(t.id, 'verified, but its "why it is debated" text cites no source');

  return {
    id: t.id,
    sectionId: section.id,
    ref: t.ref,
    status: t.status,
    span: { verse: verse.ref, start, end: start + t.english.text.length, text: t.english.text },
    title: heads.join(' '),
    cards,
    citations,
  };
}

function main() {
  const files = fs.existsSync(TERMS_IN)
    ? fs.readdirSync(TERMS_IN).filter((f) => f.endsWith('.json'))
    : [];
  const s = loadTermSources({ lewisShort: true });
  fs.mkdirSync(TERMS_OUT, { recursive: true });
  for (const old of fs.readdirSync(TERMS_OUT)) fs.rmSync(path.join(TERMS_OUT, old));
  let n = 0;
  for (const f of files.sort()) {
    const sectionId = f.replace(/\.json$/, '');
    const input = TermFileSchema.parse(JSON.parse(fs.readFileSync(path.join(TERMS_IN, f), 'utf8')));
    const section = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'sections', `${sectionId}.json`), 'utf8'),
    ) as SectionFile;
    const built = input.terms.map((t) => buildTerm(t, section, s));
    fs.writeFileSync(
      path.join(TERMS_OUT, `${sectionId}.json`),
      `${JSON.stringify({ sectionId, terms: built }, null, 1)}\n`,
    );
    n += built.length;
    console.log(`ok     ${sectionId}: ${built.map((b) => `${b.id} (${b.status})`).join(', ')}`);
  }
  console.log(`\n${n} terms built into public/data/terms/`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }
}
