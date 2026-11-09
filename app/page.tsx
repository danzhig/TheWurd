import { vaultData } from '@/components/vault/data';
import { Vault, type VaultBook } from '@/components/vault/Vault';
import { getManifest } from '@/lib/data';
import { jobOptions } from '@/lib/nav';

/** Level 0: the Vault (PLAN §9). */
export default function Home() {
  const m = getManifest();
  // Only what the client needs to re-lay the spiral if the reader moves Job.
  const manifest = {
    books: m.books.map((b) => ({ ...b, tagline: '', setting: undefined })),
    steps: m.steps,
    sections: m.sections.map(
      ({ id, bookId, status, minutes }) =>
        ({ id, bookId, status, minutes }) as (typeof m.sections)[number],
    ),
    bridges: m.bridges.map((b) => ({ ...b, text: '' })),
  };
  const books: VaultBook[] = m.books.map((b) => {
    const own = m.sections.filter((s) => s.bookId === b.id);
    const stops = own.filter((s) => s.status === 'read' || s.status === 'skim');
    return {
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      taglineDraft: b.taglineDraft,
      group: b.group,
      inPlan: b.inPlan,
      stops: (stops.length ? stops : own.filter((s) => s.status === 'optional')).map((s) => s.id),
      minutes: stops.reduce((n, s) => n + s.minutes, 0),
    };
  });
  const sections = Object.fromEntries(
    m.sections.map((s) => [s.id, { title: s.title, bookId: s.bookId }]),
  );
  return (
    <Vault
      manifest={manifest}
      initial={vaultData(manifest)}
      books={books}
      bridges={m.bridges.map((b) => ({ id: b.id, title: b.title, after: b.after }))}
      sections={sections}
      jobOptions={jobOptions()}
    />
  );
}
