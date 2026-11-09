import type { Metadata } from 'next';
import Link from 'next/link';
import { GROUP_LABEL, GROUP_ORDER } from '@/components/vault/data';
import { getManifest } from '@/lib/data';
import { ABOUT_GROUPS, aboutData } from './about';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About this path · Scripture as Story',
  description: 'Why the path follows these books, in this order, and what lies outside it.',
};

/**
 * About this path: how the reading plan is shaped and why. Every list, count and name comes from
 * the plan data; the prose around them explains the shape and never quotes scripture.
 */
export default function AboutPage() {
  const m = getManifest();
  const a = aboutData(m);
  const name = (id: string) => m.books.find((b) => b.id === id)?.name ?? id;
  const bookLink = (id: string) => (
    <Link href={`/book/${id}/`} className={styles.book}>
      {name(id)}
    </Link>
  );

  return (
    <main className={styles.page} data-testid="about">
      <nav className={styles.nav}>
        <Link href="/">← All books</Link>
      </nav>

      <header className={styles.header}>
        <p className="label">Scripture as Story</p>
        <h1 id="page-heading" tabIndex={-1} className="display">
          About this path
        </h1>
        <p className={styles.lede}>
          This path reads the Bible as one story, in the order it happened. It follows{' '}
          {a.pathBooks.length} of the {m.books.length} books of the Catholic Bible, the ones that
          carry the story, from the creation of the world to the first Christians reaching Rome.
        </p>
      </header>

      <section aria-labelledby="testaments">
        <h2 id="testaments">Two testaments, one story</h2>
        <p>
          The <strong>Old Testament</strong> ({a.otTotal} books in a Catholic Bible) is everything
          before Jesus: creation, Abraham&rsquo;s family, the escape from Egypt, the kings of Israel
          and Judah, exile and return. The <strong>New Testament</strong> ({a.ntTotal} books) is
          Jesus and the first Christians.
        </p>
        <p>
          The path takes {a.ot.length} books from the Old Testament and {a.nt.length} from the New:
        </p>
        <div className={styles.columns}>
          <div>
            <h3 className="label">Old Testament</h3>
            <ol className={styles.pathList}>
              {a.ot.map((id) => (
                <li key={id}>{bookLink(id)}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="label">New Testament</h3>
            <ol className={styles.pathList}>
              {a.nt.map((id) => (
                <li key={id}>{bookLink(id)}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="spiral">
        <h2 id="spiral">The spiral</h2>
        <p>
          On the map of books, the path is a gold thread that spirals inward. {name(a.first)} sits
          on the outer rim; {name(a.last)} sits at the centre, in the light. The story moves toward
          it.
        </p>
        <p>
          Inside a book, each section is a stop on a line: a gilt disc is read in full, a hollow
          ring is skimmed, a faint fold is skipped, and a dashed ring is an optional detour.
        </p>
      </section>

      <section aria-labelledby="ending">
        <h2 id="ending">Why it ends with {name(a.last)}</h2>
        <p>
          Acts is not the last book of the Bible (that is Revelation), but it is the last chapter of
          the story. Luke wrote it as the sequel to his gospel: the first church in Jerusalem,
          Paul&rsquo;s journeys, and Paul in Rome under house arrest, still preaching. It stops
          there, in the middle of history. The story is left open.
        </p>
      </section>

      <section aria-labelledby="bridges">
        <h2 id="bridges">Bridges</h2>
        <p>
          Where the story jumps across years, a short bridge between two books fills the gap. They
          are the stars between the books on the map.
        </p>
        <ul className={styles.plain}>
          {a.bridges.map((b) => (
            <li key={b.id}>
              <Link href={`/bridge/${b.id}/`}>{b.title}</Link>
              <span className={styles.muted}> · after {name(b.after)}</span>
            </li>
          ))}
        </ul>
      </section>

      {a.detour ? (
        <section aria-labelledby="detour">
          <h2 id="detour">
            The detour into {name(a.detour.bookId).replace(/\s*\(excursion\)$/, '')}
          </h2>
          <p>
            Luke tells most of Jesus&rsquo;s life, but not the raising of Lazarus, which only John
            tells (John 11). It is offered as an optional detour after Luke {a.detour.afterRange}.
            To take it, switch on &ldquo;Include optional detours&rdquo; in reading settings (Aa).
            On the map it hangs off {name(a.detour.hostId)} on a dashed line.
          </p>
        </section>
      ) : null}

      {a.movable ? (
        <section aria-labelledby="job">
          <h2 id="job">Where {name(a.movable.id)} goes</h2>
          <p>
            {name(a.movable.id)} is a story with no fixed place in the history. The path sets it
            after {name(a.movable.after)}; you can move it after any other book in reading settings.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="outside">
        <h2 id="outside">The books outside the path</h2>
        <p>
          The other {a.offpathCount} books stay on the map, dimmed, in the outer ring. They are
          scripture as much as the rest; this path leaves them out because they are mostly not
          narrative, or because they retell events the path already covers.
        </p>
        {GROUP_ORDER.map((label) => {
          const books = a.offpath.filter((b) => GROUP_LABEL[b.group] === label);
          if (!books.length) return null;
          return (
            <div key={label} className={styles.group}>
              <h3 className="label">{label}</h3>
              <p>{ABOUT_GROUPS[label]}</p>
              <p className={styles.names}>
                {books.map((b, i) => (
                  <span key={b.id}>
                    {i ? ' · ' : ''}
                    <span title={b.tagline}>{b.name}</span>
                  </span>
                ))}
              </p>
            </div>
          );
        })}
      </section>

      <p className={styles.footer}>
        <Link href="/">Back to all books</Link>
      </p>
    </main>
  );
}
