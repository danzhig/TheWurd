/**
 * Nave's Topical Bible from CrossWire's SWORD module (zLD driver: a compressed lexicon).
 *
 * Layout (all integers little-endian uint32):
 * - dict.idx: one (offset, size) per entry into dict.dat;
 * - dict.dat: the entry's key, CRLF, then (block number, index within the block);
 * - dict.zdx: one (offset, size) per block into dict.zdt;
 * - dict.zdt: zlib blocks; each starts with a count, then (offset, size) pairs into the block.
 *
 * Each entry is TEI: `<entryFree n="KEY"><def>…</def></entryFree>`. Its rows are the `<lb/>` lines
 * and the `<item>`s of its lists; a row's references are its `<ref osisRef>` attributes (OSIS,
 * English numbering). Rows are numbered from 1 within the entry, so `Nave:MERCY#5` cites a row.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export interface NaveRow {
  /** Citation: `Nave:<KEY>#<n>`. */
  id: string;
  /** The row's own words with the references taken out (e.g. "INSTANCES OF", "David to Saul"). */
  label: string;
  /** OSIS references, single verses or ranges (`Gen.39.21-Gen.39.23`). */
  refs: string[];
  /** Other Nave entries this row points to (`See GOD`). */
  see: string[];
}

export interface NaveEntry {
  key: string;
  rows: NaveRow[];
}

const u32 = (b: Buffer, at: number) => b.readUInt32LE(at);

/** Read every entry of the module in `dir` (the unpacked zip: `modules/lexdict/zld/nave/dict.*`). */
export function readNave(dir: string): Map<string, NaveEntry> {
  const base = path.join(dir, 'modules/lexdict/zld/nave/dict');
  const [idx, dat, zdx, zdt] = ['idx', 'dat', 'zdx', 'zdt'].map((x) =>
    fs.readFileSync(`${base}.${x}`),
  ) as [Buffer, Buffer, Buffer, Buffer];
  const blocks = new Map<number, string[]>();
  const block = (n: number): string[] => {
    let b = blocks.get(n);
    if (!b) {
      const raw = zlib.inflateSync(
        zdt.subarray(u32(zdx, n * 8), u32(zdx, n * 8) + u32(zdx, n * 8 + 4)),
      );
      b = [];
      for (let i = 0; i < u32(raw, 0); i++) {
        const o = u32(raw, 4 + i * 8);
        b.push(
          raw
            .subarray(o, o + u32(raw, 8 + i * 8))
            .toString('utf8')
            .replace(/\0+$/, ''),
        );
      }
      blocks.set(n, b);
    }
    return b;
  };
  const out = new Map<string, NaveEntry>();
  for (let i = 0; i < idx.length / 8; i++) {
    const e = dat.subarray(u32(idx, i * 8), u32(idx, i * 8) + u32(idx, i * 8 + 4));
    const crlf = e.indexOf('\r\n');
    const key = e.subarray(0, crlf).toString('utf8');
    const text = block(u32(e, crlf + 2))[u32(e, crlf + 6)] ?? '';
    out.set(key, { key, rows: parseEntry(key, text) });
  }
  return out;
}

/** Split one entry's TEI into rows (exported for tests). */
export function parseEntry(key: string, tei: string): NaveRow[] {
  const def = /<def>([\s\S]*)<\/def>/.exec(tei)?.[1] ?? tei;
  // A row is an <lb/> line or a list item; list wrappers carry no text of their own.
  const pieces = def
    .replace(/<\/?list>/g, '\n')
    .split(/<lb\/>|<item>|<\/item>|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return pieces.map((p, i) => {
    const refs = [...p.matchAll(/osisRef="([^"]+)"/g)].map((m) => m[1]!);
    const see = [...p.matchAll(/target="Nave:([^"]+)"/g)].map((m) => m[1]!);
    const label = p
      .replace(/<ref osisRef="[^"]*">[^<]*<\/ref>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/^→\s*/, '')
      .replace(/[\s;,]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { id: `Nave:${key}#${i + 1}`, label, refs, see };
  });
}
