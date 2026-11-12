import type { Metadata } from 'next';
import { ReaderShell } from '@/components/reader/ReaderShell';
import styles from '@/components/reader/reader.module.css';
import { getManifest } from '@/lib/data';
import { defaultNav, pathPosition } from '@/lib/nav';

export const dynamicParams = false;

export function generateStaticParams() {
  return getManifest().bridges.map((b) => ({ bridgeId: b.id }));
}

type Params = { params: Promise<{ bridgeId: string }> };

function bridge(id: string) {
  const b = getManifest().bridges.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown bridge ${id}`);
  return b;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { bridgeId } = await params;
  const b = bridge(bridgeId);
  return { title: `${b.title} · Scripture as Story`, description: b.text };
}

/** A full-screen card between books (PLAN §7). */
export default async function BridgePage({ params }: Params) {
  const { bridgeId } = await params;
  const b = bridge(bridgeId);
  return (
    <ReaderShell id={b.id} kind="bridge" heading={b.title} stop={false} nav={defaultNav(b.id)}>
      <main className={`vault-sky ${styles.bridge}`} data-bridge={b.id}>
        <span className="cloud-layer cloud-far" />
        <span className="cloud-layer cloud-mid" />
        <div
          className={styles.bridgeCard}
          data-pagefind-body=""
          data-pagefind-sort={`order:${pathPosition(b.id)}`}
          data-pagefind-meta="book:Bridge, status:bridge"
          data-pagefind-filter="part:path"
        >
          <p className="label">Between the books</p>
          <h1 id="page-heading" tabIndex={-1} className="display">
            {b.title}
          </h1>
          <hr className="gilt-rule" />
          <p className={styles.bridgeText}>{b.text}</p>
        </div>
      </main>
    </ReaderShell>
  );
}
