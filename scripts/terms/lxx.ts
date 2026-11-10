/**
 * The Septuagint (Swete, First1KGreek TEI transcription; CC BY-SA 4.0), read from the TEI text
 * itself, with lemmas from QuantForge's Morpheus analysis where a word form matches.
 *
 * Why not the analysed files alone: they drop every word after an inline marginal note (4–31% of
 * words, depending on the book). The transcription keeps them, but it has OCR slips (Gen 1:3 lacks
 * "θεὸς Γενη-"), so every Greek form on a card must also be checked against the printed Swete.
 */
import fs from 'node:fs';

export interface LxxToken {
  dataset: 'LXX';
  /** "<abbr>.<chapter>.<verse>" in the Septuagint's own numbering, e.g. "Gen.1.2". */
  ref: string;
  wordIndex: number; // 1-based within the verse, in the transcription
  /** The word as transcribed, punctuation removed, NFC. */
  text: string;
  /** Morpheus lemma for this form in this verse, when the analysis has it. */
  lemma?: string;
  parse?: string;
  file: string;
}

/** Verse text from a Swete TEI file: notes, page and line breaks removed. Keys "chapter.verse". */
export function readLxxTei(file: string): Map<string, string> {
  const xml = fs
    .readFileSync(file, 'utf8')
    .replace(/<note\b[^>]*>[\s\S]*?<\/note>/g, ' ')
    .replace(/<(pb|lb|milestone)\b[^>]*\/>/g, ' ');
  const out = new Map<string, string>();
  let chapter = '';
  const re =
    /<div type="textpart" subtype="(chapter|verse)" n="([^"]+)">([\s\S]*?)(?=<div type="textpart"|<\/body>)/g;
  for (let m: RegExpExecArray | null; (m = re.exec(xml));) {
    if (m[1] === 'chapter') {
      chapter = m[2]!;
      continue;
    }
    const text = m[3]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .normalize('NFC');
    if (text) out.set(`${chapter}.${m[2]}`, text);
  }
  return out;
}

/** Lemmas from a Morpheus file: verse ("chapter.verse") → normalised form → lemma and parse. */
export function readLxxLemmas(
  file: string,
): Map<string, Map<string, { lemma: string; parse: string }>> {
  const out = new Map<string, Map<string, { lemma: string; parse: string }>>();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const c = raw.split(' ');
    if (c.length < 9 || !/^\d{9}$/.test(c[0]!) || c[8] === 'morpheus-proper') continue;
    const key = `${Number(c[0]!.slice(3, 6))}.${Number(c[0]!.slice(6, 9))}`;
    const forms = out.get(key) ?? new Map();
    const form = normal(c[4]!);
    if (!forms.has(form))
      forms.set(form, { lemma: c[6]!.normalize('NFC'), parse: `${c[1]} ${c[2]}` });
    out.set(key, forms);
  }
  return out;
}

export function lxxTokens(
  verses: Map<string, string>,
  lemmas: Map<string, Map<string, { lemma: string; parse: string }>>,
  abbr: string,
  file: string,
): LxxToken[] {
  const out: LxxToken[] = [];
  for (const [cv, text] of verses) {
    const forms = lemmas.get(cv);
    text
      .split(' ')
      .map((w) => w.replace(/[^\p{L}\p{M}ʼ’]/gu, ''))
      .filter(Boolean)
      .forEach((w, i) => {
        const hit = forms?.get(normal(w));
        out.push({
          dataset: 'LXX',
          ref: `${abbr}.${cv}`,
          wordIndex: i + 1,
          text: w,
          lemma: hit?.lemma,
          parse: hit?.parse,
          file,
        });
      });
  }
  return out;
}

/** Lower-case, accents kept, punctuation and elision marks removed: how forms are matched. */
function normal(w: string): string {
  return w
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}]/gu, '');
}
