import { vaultData } from '@/components/vault/data';
import { Vault, type VaultBook } from '@/components/vault/Vault';
import { getFullManifest, getManifest } from '@/lib/data';

/** Level 0: the Vault (PLAN §9). */
export default function Home() {
  const m = getManifest();
  const full = getFullManifest();
  const books: VaultBook[] = m.books.map((b) => {
    // Library books (Phase 5) count their own sections, in the library's ledger.
    const own = (b.library ? full : m).sections.filter((s) => s.bookId === b.id);
    const stops = own.filter((s) => s.status === 'read' || s.status === 'skim');
    return {
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      taglineDraft: b.taglineDraft,
      group: b.group,
      inPlan: b.inPlan,
      library: !!b.library,
      stops: (stops.length ? stops : own.filter((s) => s.status === 'optional')).map((s) => s.id),
      minutes: stops.reduce((n, s) => n + s.minutes, 0),
    };
  });
  const sections = Object.fromEntries(
    m.sections.map((s) => [s.id, { title: s.title, bookId: s.bookId }]),
  );
  return (
    <Vault
      data={vaultData(m)}
      books={books}
      bridges={m.bridges.map((b) => ({ id: b.id, title: b.title, after: b.after }))}
      sections={sections}
    />
  );
}
