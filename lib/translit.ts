/**
 * Transliteration generated from the source token (PLAN §18, check 9: never typed). A simplified
 * general-purpose style: consonants and vowels only, cantillation dropped. Hebrew follows the SBL
 * general-purpose scheme in outline (sh, ts, kh, f, v; vocal sheva as "e"); Greek the common
 * academic one (ē, ō, ch, ph, th, rough breathing as "h").
 */

// ---------------------------------------------------------------------------------------------
// Hebrew
// ---------------------------------------------------------------------------------------------

const DAGESH = 'ּ';
const SHIN_DOT = 'ׁ';
const SIN_DOT = 'ׂ';
const SHEVA = 'ְ';
const HOLAM = 'ֹ';

const VOWEL: Record<string, string> = {
  'ַ': 'a', // patah
  'ָ': 'a', // qamats
  'ֵ': 'e', // tsere
  'ֶ': 'e', // segol
  'ִ': 'i', // hiriq
  [HOLAM]: 'o', // holam
  'ֺ': 'o', // holam haser for vav
  'ֻ': 'u', // qubuts
  'ֲ': 'a', // hataf patah
  'ֱ': 'e', // hataf segol
  'ֳ': 'o', // hataf qamats
  'ׇ': 'o', // qamats qatan
};

const CONSONANT: Record<string, [soft: string, hard?: string]> = {
  א: ['ʾ'],
  ב: ['v', 'b'],
  ג: ['g'],
  ד: ['d'],
  ה: ['h'],
  ו: ['v'],
  ז: ['z'],
  ח: ['ḥ'],
  ט: ['ṭ'],
  י: ['y'],
  כ: ['kh', 'k'],
  ך: ['kh', 'k'],
  ל: ['l'],
  מ: ['m'],
  ם: ['m'],
  נ: ['n'],
  ן: ['n'],
  ס: ['s'],
  ע: ['ʿ'],
  פ: ['f', 'p'],
  ף: ['f', 'p'],
  צ: ['ts'],
  ץ: ['ts'],
  ק: ['q'],
  ר: ['r'],
  ש: ['sh'],
  ת: ['t'],
};

interface Letter {
  base: string;
  marks: string;
}

function letters(word: string): Letter[] {
  const out: Letter[] = [];
  for (const ch of word.normalize('NFD')) {
    if (CONSONANT[ch]) out.push({ base: ch, marks: '' });
    // Vowel points, dagesh and the shin/sin dots only; cantillation, meteg, maqaf and punctuation
    // (sof pasuq) are dropped.
    else if (/[ְ-ׇּׁׂ]/.test(ch) && out.length) out.at(-1)!.marks += ch;
  }
  return out;
}

export function transliterateHebrew(text: string): string {
  return text
    .replace(/[/\\]/g, '') // TAHOT morpheme separators
    .split(/[\s־־]+/) // words, split at spaces and maqaf
    .filter(Boolean)
    .map(hebrewWord)
    .join('-');
}

function hebrewWord(word: string): string {
  const ls = letters(word);
  let out = '';
  ls.forEach((l, i) => {
    const next = ls[i + 1];
    const { base, marks } = l;
    // Vav as a vowel letter: shureq (dagesh, no vowel) and holam male.
    if (base === 'ו' && marks === DAGESH) {
      out += 'u';
      return;
    }
    if (base === 'ו' && /^[\u05B9\u05BA]$/.test(marks.replace('\u05BD', '')) && i > 0) {
      out += 'o';
      return;
    }
    // Yod after hiriq or tsere, and a final he after a vowel, are vowel letters.
    const prev = ls[i - 1];
    if (base === 'י' && !marks && prev && /[ִֵֶ]/.test(prev.marks)) return;
    if (base === 'ה' && !marks && !next && prev && /[ֵֶַָ]/.test(prev.marks)) return;
    const c = CONSONANT[base]!;
    let cons = marks.includes(DAGESH) && c[1] ? c[1] : c[0];
    if (base === 'ש') cons = marks.includes(SIN_DOT) ? 's' : marks.includes(SHIN_DOT) ? 'sh' : 'sh';
    out += cons;
    // Vowels: holam may sit on the next letter (a vav), so look ahead for it.
    for (const m of marks) if (VOWEL[m]) out += VOWEL[m];
    if (marks.includes(SHEVA)) {
      // Vocal sheva: at the start of a word, or after another sheva-closed syllable.
      const vocal = i === 0 || (prev?.marks.includes(SHEVA) ?? false);
      if (vocal && next) out += 'e';
    }
    // Furtive patah on a final guttural is read before it ("ruach").
    if (!next && /[חעה]/.test(base) && marks.includes('ַ')) {
      out = out.slice(0, -(cons.length + 1)) + 'a' + cons;
    }
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Greek
// ---------------------------------------------------------------------------------------------

const GREEK: Record<string, string> = {
  α: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'ē',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'ph',
  χ: 'ch',
  ψ: 'ps',
  ω: 'ō',
};

export function transliterateGreek(text: string): string {
  const words = text.normalize('NFD').toLowerCase().split(/\s+/);
  return words
    .map((w) => {
      const rough = w.includes('̔');
      const base = w.replace(/[̀-ͯ᾽’ʼ’']/g, '');
      let out = '';
      for (let i = 0; i < base.length; i++) {
        const ch = base[i]!;
        const next = base[i + 1] ?? '';
        if (ch === 'γ' && /[γκξχ]/.test(next)) {
          out += 'n';
          continue;
        }
        if (ch === 'υ' && /[αεηο]/.test(base[i - 1] ?? '')) {
          out += 'u'; // au, eu, ēu, ou
          continue;
        }
        if (ch === 'ρ' && i === 0 && rough) {
          out += 'rh';
          continue;
        }
        out += GREEK[ch] ?? (/\p{L}/u.test(ch) ? ch : '');
      }
      if (rough && !base.startsWith('ρ')) out = `h${out}`;
      return out;
    })
    .filter(Boolean)
    .join(' ');
}
