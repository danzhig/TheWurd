/**
 * Loads every Phase 3 source (fetched by `pnpm terms:fetch`) into lookups keyed by verse, so
 * cards can be drafted from data and every form checked against the row it cites.
 */
import path from 'node:path';
import { CANON_BY_ID } from '../lib/canon';
import { RAW_DIR } from '../lib/paths';
import { parseLewisShort, type LsEntry } from './lewis-short';
import { lxxTokens, readLxxLemmas, readLxxTei, type LxxToken } from './lxx';
import {
  byVerse,
  parseBriefLexicon,
  parseMorphCodes,
  parseTagnt,
  parseTahot,
  type LexEntry,
  type Token,
} from './stepbible';
import { readUsfmVerses } from './usfm-verses';

/** Plan book (OSIS) → the Septuagint file and the book name it uses. */
export const LXX_BOOKS: Record<string, { file: string; abbr: string }[]> = {
  Gen: [{ file: '001-Gen', abbr: 'Gen' }],
  Exod: [{ file: '002-Exod', abbr: 'Exod' }],
  Num: [{ file: '004-Num', abbr: 'Num' }],
  Deut: [{ file: '005-Deut', abbr: 'Deut' }],
  Josh: [{ file: '006-Josh', abbr: 'Josh' }],
  Judg: [{ file: '007-Judg', abbr: 'Judg' }],
  Ruth: [{ file: '008-Ruth', abbr: 'Ruth' }],
  '1Sam': [{ file: '009-1Kgdms', abbr: '1Kgdms' }],
  '2Sam': [{ file: '010-2Kgdms', abbr: '2Kgdms' }],
  '1Kgs': [{ file: '011-3Kgdms', abbr: '3Kgdms' }],
  '2Kgs': [{ file: '012-4Kgdms', abbr: '4Kgdms' }],
  Ezra: [{ file: '016-2Esd', abbr: '2Esd' }], // Ezra = 2 Esdras 1–10
  Neh: [{ file: '016-2Esd', abbr: '2Esd' }], // Nehemiah = 2 Esdras 11–23
  Esth: [{ file: '017-Esth', abbr: 'Esth' }],
  Jdt: [{ file: '018-Jdt', abbr: 'Jdt' }],
  Tob: [{ file: '019-Tob', abbr: 'Tob' }],
  '1Macc': [{ file: '020-1Macc', abbr: '1Macc' }],
  Job: [{ file: '028-Job', abbr: 'Job' }],
  Jonah: [{ file: '037-Jonah', abbr: 'Jonah' }],
  Jer: [{ file: '045-Jer', abbr: 'Jer' }],
  // Catholic Daniel follows Theodotion's Greek; the Old Greek is kept for comparison.
  Dan: [
    { file: '053-DanTh', abbr: 'DanTh' },
    { file: '052-Dan', abbr: 'Dan' },
    { file: '051-SusTh', abbr: 'SusTh' },
    { file: '055-BelTh', abbr: 'BelTh' },
  ],
};

export interface TermSources {
  hebrew: Map<string, Token[]>; // "Gen.1.2" (English numbering)
  greek: Map<string, Token[]>; // "Luk.1.28"
  lxx: Map<string, LxxToken[]>; // "Gen.1.2", "1Kgdms.3.4" (Septuagint numbering)
  tbesh: Map<string, LexEntry>;
  tbesg: Map<string, LexEntry>;
  hebrewMorph: Map<string, string>;
  greekMorph: Map<string, string>;
  drc: Map<string, string>; // "GEN.1.2" (each text's own numbering)
  kjv: Map<string, string>;
  brenton: Map<string, string>;
  vulgate: Map<string, string>;
  lewisShort: Map<string, LsEntry>;
}

const raw = (f: string) => path.join(RAW_DIR, f);

export function loadTermSources(opts: { lewisShort?: boolean } = {}): TermSources {
  const hebrew = byVerse(
    ['Gen-Deu', 'Jos-Est', 'Job-Sng', 'Isa-Mal'].flatMap((p) =>
      parseTahot(raw(`TAHOT-${p}.txt`), `TAHOT ${p}`),
    ),
  );
  const greek = byVerse(
    ['Mat-Jhn', 'Act-Rev'].flatMap((p) => parseTagnt(raw(`TAGNT-${p}.txt`), `TAGNT ${p}`)),
  );
  const lxx = new Map<string, LxxToken[]>();
  const seen = new Set<string>();
  for (const files of Object.values(LXX_BOOKS))
    for (const { file, abbr } of files) {
      if (seen.has(file)) continue;
      seen.add(file);
      const tokens = lxxTokens(
        readLxxTei(raw(`lxx-tei-${file}.xml`)),
        readLxxLemmas(raw(`lxx-${file}.txt`)),
        abbr,
        `LXX ${file}`,
      );
      for (const t of tokens) lxx.set(t.ref, [...(lxx.get(t.ref) ?? []), t]);
    }
  return {
    hebrew,
    greek,
    lxx,
    tbesh: parseBriefLexicon(raw('TBESH.txt'), 'TBESH'),
    tbesg: parseBriefLexicon(raw('TBESG.txt'), 'TBESG'),
    hebrewMorph: parseMorphCodes(raw('TEHMC.txt')),
    greekMorph: parseMorphCodes(raw('TEGMC.txt')),
    drc: readUsfmVerses(raw('drc')),
    kjv: readUsfmVerses(raw('kjv')),
    brenton: readUsfmVerses(raw('brenton')),
    vulgate: readUsfmVerses(raw('vulgate')),
    lewisShort: opts.lewisShort ? parseLewisShort(raw('lat.ls.perseus-eng2.xml')) : new Map(),
  };
}

/** "Gen.1.2" (OSIS) → the STEPBible key ("Gen.1.2") and the USFM key ("GEN.1.2"). */
export function keysFor(osisRef: string): { step: string; usfm: string; book: string } {
  const [book, c, v] = osisRef.split('.');
  const b = CANON_BY_ID.get(book!);
  if (!b) throw new Error(`Unknown book in ${osisRef}`);
  return { step: `${b.tvtms}.${c}.${v}`, usfm: `${b.usfm}.${c}.${v}`, book: book! };
}
