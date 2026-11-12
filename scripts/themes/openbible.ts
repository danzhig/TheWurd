/**
 * OpenBible.info topical data (`topic-scores.txt`, CC BY 4.0): one row per topic and passage, with
 * a quality score from readers' votes. References are OSIS, English numbering, a verse or a range
 * (`Exod.20.1-Exod.20.26`). Rows are cited by their line number in the file: `OpenBible:L123`.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface OpenBibleRow {
  id: string;
  topic: string;
  ref: string;
  score: number;
}

/** Read the file from `dir` (the unpacked zip), or a file path given directly. */
export function readOpenBible(dirOrFile: string): OpenBibleRow[] {
  const file = fs.statSync(dirOrFile).isDirectory()
    ? path.join(dirOrFile, 'topic-scores.txt')
    : dirOrFile;
  return parseOpenBible(fs.readFileSync(file, 'utf8'));
}

export function parseOpenBible(text: string): OpenBibleRow[] {
  const rows: OpenBibleRow[] = [];
  text.split('\n').forEach((line, i) => {
    if (i === 0 || !line.trim()) return; // header
    const [topic, ref, score] = line.split('\t');
    if (!topic || !ref) return;
    rows.push({ id: `OpenBible:L${i + 1}`, topic, ref, score: Number(score) || 0 });
  });
  return rows;
}
