/**
 * pnpm themes:topics <words…> [--rows] — what the theme datasets hold for a topic (Phase 6).
 *
 * For each word, lists the Nave entries whose key contains it (rows, references) and the OpenBible
 * topics that contain it (passages, total votes score). With --rows, prints every Nave row and the
 * top OpenBible passages with their citations. Run `pnpm themes:fetch` first.
 */
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { readNave } from './themes/naves';
import { readOpenBible } from './themes/openbible';

const args = process.argv.slice(2);
const rows = args.includes('--rows');
const words = args.filter((a) => !a.startsWith('--')).map((w) => w.toLowerCase());
if (!words.length) {
  console.error('usage: pnpm themes:topics <word…> [--rows]');
  process.exit(1);
}

const nave = readNave(path.join(RAW_DIR, 'naves'));
const ob = readOpenBible(path.join(RAW_DIR, 'openbible-topics'));
const obTopics = new Map<string, typeof ob>();
for (const r of ob) obTopics.set(r.topic, [...(obTopics.get(r.topic) ?? []), r]);

for (const w of words) {
  console.log(`\n=== ${w}`);
  const keys = [...nave.keys()].filter((k) => k.toLowerCase().includes(w));
  for (const k of keys) {
    const e = nave.get(k)!;
    const refs = e.rows.reduce((n, r) => n + r.refs.length, 0);
    console.log(`Nave ${k}: ${e.rows.length} rows, ${refs} refs`);
    if (rows)
      for (const r of e.rows)
        if (r.refs.length || r.see.length)
          console.log(
            `  ${r.id}  ${r.label.slice(0, 70)}  [${r.refs.length} refs${r.see.length ? `; see ${r.see.join(', ')}` : ''}]`,
          );
  }
  const topics = [...obTopics.keys()].filter((t) => t.toLowerCase().includes(w));
  for (const t of topics
    .sort((a, z) => obTopics.get(z)!.length - obTopics.get(a)!.length)
    .slice(0, 15)) {
    const list = obTopics.get(t)!;
    const score = list.reduce((n, r) => n + r.score, 0);
    console.log(`OpenBible "${t}": ${list.length} passages, score ${score}`);
    if (rows)
      for (const r of [...list].sort((a, z) => z.score - a.score).slice(0, 10))
        console.log(`  ${r.id}  ${r.ref}  (${r.score})`);
  }
}
