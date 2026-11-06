import type { BookGroup, Testament } from '../../lib/types';

export interface CanonBook {
  id: string; // OSIS id
  name: string;
  usfm: string; // book code in the WEBC USFM files
  tvtms: string; // book abbreviation used by STEPBible TVTMS
  testament: Testament;
  group: BookGroup;
  /** True for books whose plan references use Hebrew (MT) numbering, mapped to WEBC with TVTMS. */
  hebrewNumbering?: boolean;
}

const OT: [string, string, string, string, BookGroup, boolean?][] = [
  ['Gen', 'Genesis', 'GEN', 'Gen', 'Pentateuch', true],
  ['Exod', 'Exodus', 'EXO', 'Exo', 'Pentateuch', true],
  ['Lev', 'Leviticus', 'LEV', 'Lev', 'Pentateuch', true],
  ['Num', 'Numbers', 'NUM', 'Num', 'Pentateuch', true],
  ['Deut', 'Deuteronomy', 'DEU', 'Deu', 'Pentateuch', true],
  ['Josh', 'Joshua', 'JOS', 'Jos', 'Historical', true],
  ['Judg', 'Judges', 'JDG', 'Jdg', 'Historical', true],
  ['Ruth', 'Ruth', 'RUT', 'Rut', 'Historical', true],
  ['1Sam', '1 Samuel', '1SA', '1Sa', 'Historical', true],
  ['2Sam', '2 Samuel', '2SA', '2Sa', 'Historical', true],
  ['1Kgs', '1 Kings', '1KI', '1Ki', 'Historical', true],
  ['2Kgs', '2 Kings', '2KI', '2Ki', 'Historical', true],
  ['1Chr', '1 Chronicles', '1CH', '1Ch', 'Historical', true],
  ['2Chr', '2 Chronicles', '2CH', '2Ch', 'Historical', true],
  ['Ezra', 'Ezra', 'EZR', 'Ezr', 'Historical', true],
  ['Neh', 'Nehemiah', 'NEH', 'Neh', 'Historical', true],
  ['Tob', 'Tobit', 'TOB', 'Tob', 'Historical'],
  ['Jdt', 'Judith', 'JDT', 'Jdt', 'Historical'],
  ['Esth', 'Esther', 'ESG', 'Est', 'Historical'],
  ['1Macc', '1 Maccabees', '1MA', '1Ma', 'Historical'],
  ['2Macc', '2 Maccabees', '2MA', '2Ma', 'Historical'],
  ['Job', 'Job', 'JOB', 'Job', 'Wisdom', true],
  ['Ps', 'Psalms', 'PSA', 'Psa', 'Wisdom', true],
  ['Prov', 'Proverbs', 'PRO', 'Pro', 'Wisdom', true],
  ['Eccl', 'Ecclesiastes', 'ECC', 'Ecc', 'Wisdom', true],
  ['Song', 'Song of Songs', 'SNG', 'Sng', 'Wisdom', true],
  ['Wis', 'Wisdom', 'WIS', 'Wis', 'Wisdom'],
  ['Sir', 'Sirach', 'SIR', 'Sir', 'Wisdom'],
  ['Isa', 'Isaiah', 'ISA', 'Isa', 'Prophets', true],
  ['Jer', 'Jeremiah', 'JER', 'Jer', 'Prophets', true],
  ['Lam', 'Lamentations', 'LAM', 'Lam', 'Prophets', true],
  ['Bar', 'Baruch', 'BAR', 'Bar', 'Prophets'],
  ['Ezek', 'Ezekiel', 'EZK', 'Ezk', 'Prophets', true],
  ['Dan', 'Daniel', 'DAG', 'Dan', 'Prophets'],
  ['Hos', 'Hosea', 'HOS', 'Hos', 'Prophets', true],
  ['Joel', 'Joel', 'JOL', 'Jol', 'Prophets', true],
  ['Amos', 'Amos', 'AMO', 'Amo', 'Prophets', true],
  ['Obad', 'Obadiah', 'OBA', 'Oba', 'Prophets', true],
  ['Jonah', 'Jonah', 'JON', 'Jon', 'Prophets', true],
  ['Mic', 'Micah', 'MIC', 'Mic', 'Prophets', true],
  ['Nah', 'Nahum', 'NAM', 'Nam', 'Prophets', true],
  ['Hab', 'Habakkuk', 'HAB', 'Hab', 'Prophets', true],
  ['Zeph', 'Zephaniah', 'ZEP', 'Zep', 'Prophets', true],
  ['Hag', 'Haggai', 'HAG', 'Hag', 'Prophets', true],
  ['Zech', 'Zechariah', 'ZEC', 'Zec', 'Prophets', true],
  ['Mal', 'Malachi', 'MAL', 'Mal', 'Prophets', true],
];

const NT: [string, string, string, string, BookGroup][] = [
  ['Matt', 'Matthew', 'MAT', 'Mat', 'Gospels'],
  ['Mark', 'Mark', 'MRK', 'Mrk', 'Gospels'],
  ['Luke', 'Luke', 'LUK', 'Luk', 'Gospels'],
  ['John', 'John', 'JHN', 'Jhn', 'Gospels'],
  ['Acts', 'Acts', 'ACT', 'Act', 'Acts'],
  ['Rom', 'Romans', 'ROM', 'Rom', 'Letters'],
  ['1Cor', '1 Corinthians', '1CO', '1Co', 'Letters'],
  ['2Cor', '2 Corinthians', '2CO', '2Co', 'Letters'],
  ['Gal', 'Galatians', 'GAL', 'Gal', 'Letters'],
  ['Eph', 'Ephesians', 'EPH', 'Eph', 'Letters'],
  ['Phil', 'Philippians', 'PHP', 'Php', 'Letters'],
  ['Col', 'Colossians', 'COL', 'Col', 'Letters'],
  ['1Thess', '1 Thessalonians', '1TH', '1Th', 'Letters'],
  ['2Thess', '2 Thessalonians', '2TH', '2Th', 'Letters'],
  ['1Tim', '1 Timothy', '1TI', '1Ti', 'Letters'],
  ['2Tim', '2 Timothy', '2TI', '2Ti', 'Letters'],
  ['Titus', 'Titus', 'TIT', 'Tit', 'Letters'],
  ['Phlm', 'Philemon', 'PHM', 'Phm', 'Letters'],
  ['Heb', 'Hebrews', 'HEB', 'Heb', 'Letters'],
  ['Jas', 'James', 'JAS', 'Jas', 'Letters'],
  ['1Pet', '1 Peter', '1PE', '1Pe', 'Letters'],
  ['2Pet', '2 Peter', '2PE', '2Pe', 'Letters'],
  ['1John', '1 John', '1JN', '1Jn', 'Letters'],
  ['2John', '2 John', '2JN', '2Jn', 'Letters'],
  ['3John', '3 John', '3JN', '3Jn', 'Letters'],
  ['Jude', 'Jude', 'JUD', 'Jud', 'Letters'],
  ['Rev', 'Revelation', 'REV', 'Rev', 'Apocalypse'],
];

export const CANON: CanonBook[] = [
  ...OT.map(([id, name, usfm, tvtms, group, hebrewNumbering]) => ({
    id,
    name,
    usfm,
    tvtms,
    testament: 'OT' as const,
    group,
    hebrewNumbering: hebrewNumbering ?? false,
  })),
  ...NT.map(([id, name, usfm, tvtms, group]) => ({
    id,
    name,
    usfm,
    tvtms,
    testament: 'NT' as const,
    group,
  })),
];

export const CANON_BY_ID = new Map(CANON.map((b) => [b.id, b]));
