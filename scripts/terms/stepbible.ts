/**
 * Readers for STEPBible's tagged texts (TAHOT, TAGNT), brief lexicons (TBESH, TBESG) and
 * morphology code tables (TEHMC, TEGMC). Every token keeps its source line so a card can cite it.
 */
import fs from 'node:fs';

export interface Token {
  dataset: 'TAHOT' | 'TAGNT';
  /** Verse in English numbering (as WEBC), e.g. "Gen.31.55". */
  ref: string;
  /** The same verse in the source's own numbering where it differs, e.g. "Gen.32.1". */
  sourceRef?: string;
  /** Word position in the verse, 1-based, as in the source ("#01"). */
  wordIndex: number;
  /** The word in its script, exactly as in the source (NFC-normalised). */
  text: string;
  gloss: string;
  /** Disambiguated Strong's numbers of the word's parts, e.g. ["H9003", "H7225G"]. */
  strongs: string[];
  /** The main lexeme (braced in TAHOT), e.g. "H7225G". */
  lexeme: string;
  grammar: string;
  /** Dictionary form of the main lexeme where the source gives it. */
  lemma?: string;
  /** TAGNT: which printed editions contain the word. */
  editions?: string;
  /** 1-based line in the source file. */
  line: number;
  file: string;
}

const REF = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#(\d+)/;

/** Parse a TAHOT file: one row per Hebrew or Aramaic word. */
export function parseTahot(file: string, name = file): Token[] {
  const out: Token[] = [];
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const m = REF.exec(raw);
      if (!m) return;
      const c = raw.split('\t');
      const [, book, ch, vs, hc, hv, idx] = m;
      const dStrongs = c[4] ?? '';
      const lexeme = /\{([^}]+)\}/.exec(dStrongs)?.[1] ?? dStrongs.split('/').pop() ?? '';
      const expanded = c[11] ?? c[10] ?? '';
      const lemma = new RegExp(`\\{?${escape(lexeme)}=([^=}]+)=`).exec(expanded)?.[1];
      out.push({
        dataset: 'TAHOT',
        ref: `${book}.${ch}.${vs}`,
        sourceRef: hc ? `${book}.${hc}.${hv}` : undefined,
        wordIndex: Number(idx),
        text: (c[1] ?? '').normalize('NFC'),
        gloss: (c[3] ?? '').trim(),
        strongs: dStrongs.replace(/[{}]/g, '').split(/[/\\]/).filter(Boolean),
        lexeme,
        grammar: (c[5] ?? '').trim(),
        lemma: lemma?.normalize('NFC'),
        line: i + 1,
        file: name,
      });
    });
  return out;
}

/** Parse a TAGNT file: one row per Greek word, with the editions that contain it. */
export function parseTagnt(file: string, name = file): Token[] {
  const out: Token[] = [];
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const m = REF.exec(raw);
      if (!m) return;
      const c = raw.split('\t');
      const [, book, ch, vs, , , idx] = m;
      const [strong = '', grammar = ''] = (c[3] ?? '').split('=');
      const [lemma = ''] = (c[4] ?? '').split('='); // "καί=and": dictionary form, then its gloss
      out.push({
        dataset: 'TAGNT',
        ref: `${book}.${ch}.${vs}`,
        wordIndex: Number(idx),
        // "Καὶ (Kai)": the word, then the source's own transliteration (not used: ours is generated).
        text: (c[1] ?? '').replace(/\s*\([^)]*\)\s*$/, '').normalize('NFC'),
        gloss: (c[2] ?? '').trim(),
        strongs: [strong.trim()],
        lexeme: strong.trim(),
        grammar: grammar.trim(),
        lemma: lemma.trim().normalize('NFC'),
        editions: (c[5] ?? '').trim(),
        line: i + 1,
        file: name,
      });
    });
  return out;
}

/** Tokens grouped by verse (English numbering). */
export function byVerse(tokens: Token[]): Map<string, Token[]> {
  const map = new Map<string, Token[]>();
  for (const t of tokens) map.set(t.ref, [...(map.get(t.ref) ?? []), t]);
  return map;
}

export interface LexEntry {
  /** Disambiguated Strong's number, e.g. "H7307G". */
  id: string;
  lemma: string;
  /** The source's transliteration (shown only as the lexicon's own spelling). */
  translit: string;
  morph: string;
  gloss: string;
  /** Meaning text with the source's HTML markup removed; numbered senses kept on separate lines. */
  meaning: string;
  line: number;
  file: string;
}

/** Parse TBESH or TBESG: tab-separated rows, one per extended Strong's number. */
export function parseBriefLexicon(file: string, name = file): Map<string, LexEntry> {
  const map = new Map<string, LexEntry>();
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      if (!/^[HG]\d{4}/.test(raw)) return;
      const c = raw.split('\t');
      // "H0430G = a Name of": the entry's own extended number comes first in the second column.
      const id = (c[1] ?? '').trim().split(/\s/)[0] ?? '';
      if (!id || map.has(id)) return;
      map.set(id, {
        id,
        lemma: (c[3] ?? '').trim().normalize('NFC'),
        translit: (c[4] ?? '').trim(),
        morph: (c[5] ?? '').trim(),
        gloss: (c[6] ?? '').trim(),
        meaning: stripHtml(c[7] ?? ''),
        line: i + 1,
        file: name,
      });
    });
  return map;
}

/** Parse TEHMC or TEGMC: grammar code → a readable expansion. */
export function parseMorphCodes(file: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [code, desc] = raw.split('\t');
    if (code && desc && /^[A-Z][\w-]*$/.test(code) && /Function=/.test(desc) && !map.has(code))
      map.set(code, desc.trim());
  }
  return map;
}

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
