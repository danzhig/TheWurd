/**
 * pnpm themes:taxonomy — check content/themes/taxonomy.json against the datasets and write
 * docs/themes/taxonomy.md, the proposal the owner approves (Phase 6, P6.1). Every source must name
 * something in Nave's or OpenBible's data; the counts show how many candidate passages each
 * sub-theme has and how many fall on the path or in the library. Run `pnpm themes:fetch` first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { readNave } from './themes/naves';
import { readOpenBible, type OpenBibleRow } from './themes/openbible';
import { candidatesFor, readSectionIndex, readTaxonomy, sectionFor } from './themes/taxonomy';

const tax = readTaxonomy();
const nave = readNave(path.join(RAW_DIR, 'naves'));
const obByTopic = new Map<string, OpenBibleRow[]>();
for (const r of readOpenBible(path.join(RAW_DIR, 'openbible-topics')))
  obByTopic.set(r.topic, [...(obByTopic.get(r.topic) ?? []), r]);
const index = readSectionIndex();

const errors: string[] = [];
const ids = new Set<string>();
const lines: string[] = [];
let total = 0;
for (const t of tax.themes) {
  if (ids.has(t.id)) errors.push(`duplicate id ${t.id}`);
  ids.add(t.id);
  lines.push(`## ${t.title} (\`${t.id}\`)`, '', t.description, '');
  lines.push('| Sub-theme | Description | Sources | Passages | On the path | In the library |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const s of t.subthemes) {
    if (ids.has(s.id)) errors.push(`duplicate id ${s.id}`);
    ids.add(s.id);
    if (!s.id.startsWith(`${t.id}-`)) errors.push(`${s.id} should start with ${t.id}-`);
    const refs = new Map<string, string | undefined>();
    for (const src of s.sources) {
      try {
        for (const c of candidatesFor(src, nave, obByTopic))
          refs.set(c.ref, sectionFor(c.ref, index));
      } catch (err) {
        errors.push(`${s.id}: ${(err as Error).message}`);
      }
    }
    const placed = [...refs.values()].filter(Boolean) as string[];
    const lib = placed.filter((id) => index.library.has(id)).length;
    total += refs.size;
    const sources = s.sources.map((x) => `\`${x}\``).join(', ');
    lines.push(
      `| **${s.title}** (\`${s.id}\`) | ${s.description} | ${sources} | ${refs.size} | ${placed.length - lib} | ${lib} |`,
    );
  }
  lines.push('');
}

const subCount = tax.themes.reduce((n, t) => n + t.subthemes.length, 0);
const head = [
  '# Themes: taxonomy',
  '',
  tax.status === 'approved' && tax.approval
    ? `**Status: approved by ${tax.approval.by} on ${tax.approval.date}.**`
    : '**Status: proposed, awaiting the owner’s approval.** No passages are assigned until it is approved.',
  '',
  `${tax.themes.length} themes and ${subCount} sub-themes for the constellation view (docs/PLAN.md §16). Titles and descriptions are original prose and never quote scripture. Each sub-theme names the dataset topics its candidate passages will come from (P6.2): \`nave:KEY\` is a whole entry of Nave’s Topical Bible (public domain), \`nave:KEY#n\` one row of it, and \`openbible:topic\` a topic in OpenBible.info’s data (CC BY 4.0). Both datasets are pinned in \`sources/manifest.json\`.`,
  '',
  `The counts come from \`pnpm themes:taxonomy\`: distinct references the sources give (${total} in all, counting a passage once per sub-theme), and where each one’s first verse falls among the built sections. A reference outside any section is one the datasets give in a numbering WEBC does not use; P6.2 lists those for review rather than dropping them. Passages are proposed and approved per theme in P6.2, so these numbers are a ceiling, not a selection.`,
  '',
];
if (errors.length) {
  console.error(`FAILED:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
fs.mkdirSync('docs/themes', { recursive: true });
fs.writeFileSync('docs/themes/taxonomy.md', [...head, ...lines].join('\n'));
console.log(
  `wrote docs/themes/taxonomy.md: ${tax.themes.length} themes, ${subCount} sub-themes, ${total} candidate references`,
);
