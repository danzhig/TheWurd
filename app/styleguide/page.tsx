import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { VerseText } from '@/components/reader/VerseText';
import { MotionDemo } from '@/components/ui/MotionDemo';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import {
  AA_NORMAL,
  DERIVED,
  MOTION,
  PALETTE,
  textPairs,
  THEMES,
  type ThemeName,
} from '@/lib/design/tokens';
import { ReadingPlanSchema, type SectionFile } from '@/lib/types';
import styles from './styleguide.module.css';

export const metadata: Metadata = { title: 'Styleguide · Scripture as Story' };

const ROOT = process.cwd();
const section = (id: string) =>
  JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/data/sections', `${id}.json`), 'utf8'),
  ) as SectionFile;
const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'content/plan/reading-plan.json'), 'utf8')),
);

// Sample text comes from the built WEBC data, never typed (CLAUDE.md rule 2).
const creation = section('gen-01');
const song = section('deut-04');
const prose = creation.verses.slice(0, 5);
const poetry = song.verses.slice(0, 4);

const book = (id: string) => plan.books.find((b) => b.id === id)!;
const sec = (id: string) => plan.books.flatMap((b) => b.sections).find((s) => s.id === id)!;
const note = plan.notes.find((n) => n.id === 'n-gen-11')!;
const skim = sec('gen-11').inner![0]!;
const skip = sec('gen-x1');
const contentNote = sec('judg-10').contentNote!;
const nextSection = sec('gen-02');

const PALETTE_NOTES: Record<string, string> = {
  night: 'Vault background',
  umber: 'Cards on Vault',
  smoke: 'Clouds; muted text on Vellum',
  cloud: 'Body text on Vault',
  vellum: 'Reader page',
  ink: 'Body text on Vellum',
  gold: 'Hairlines, thread; accent text on Vault',
  goldLight: 'Oculus, active states',
  vermilion: 'Current position, content notes',
  lapis: 'Links, New Testament thread',
};
const DERIVED_NOTES: Record<string, string> = {
  smokeLight: 'Muted text on Vault',
  vermilionLight: 'Alert text on Vault',
  lapisLight: 'Link text on Vault',
  goldInk: 'Accent text on Vellum',
  parchment: 'Card surface on Vellum',
};

function Swatch({ name, hex, note }: { name: string; hex: string; note: string }) {
  return (
    <li className={styles.swatch}>
      <span className={styles.chip} style={{ background: hex }} />
      <span>
        <code>--{name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}</code>{' '}
        <span className={styles.hex}>{hex}</span>
        <br />
        <span className={styles.muted}>{note}</span>
      </span>
    </li>
  );
}

function ReaderSample({ theme }: { theme: ThemeName }) {
  return (
    <article data-theme={theme} className={styles.page}>
      <p className="label">{theme === 'vault' ? 'Vault' : 'Vellum'}</p>
      <h3 className="display">{creation.title}</h3>
      <p className={styles.ref}>
        {creation.bookName} {creation.range}
      </p>
      <VerseText verses={prose} dropCap />
      <hr className="gilt-rule" />
      <p className={styles.ref}>
        {song.bookName} {song.range} · {song.title}
      </p>
      <VerseText verses={poetry} />
    </article>
  );
}

export default function Styleguide() {
  const pairs = textPairs();
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className="label">Design system · M2</p>
        <h1 className="display">Styleguide</h1>
        <p className="tagline">Tokens, type, materials and motion for Scripture as Story.</p>
        <SettingsPanel />
      </header>

      <section aria-labelledby="palette">
        <h2 id="palette" className="display">
          Palette
        </h2>
        <p className={styles.muted}>The plan&rsquo;s colours, unchanged.</p>
        <ul className={styles.swatches}>
          {Object.entries(PALETTE).map(([k, v]) => (
            <Swatch key={k} name={k} hex={v} note={PALETTE_NOTES[k] ?? ''} />
          ))}
        </ul>
        <p className={styles.muted}>
          Text-safe shades: the same hues at the nearest lightness that meets WCAG AA as text.
        </p>
        <ul className={styles.swatches}>
          {Object.entries(DERIVED).map(([k, v]) => (
            <Swatch key={k} name={k} hex={v} note={DERIVED_NOTES[k] ?? ''} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="contrast">
        <h2 id="contrast" className="display">
          Text contrast
        </h2>
        <p className={styles.muted}>
          Every text colour on every background, both themes. AA needs {AA_NORMAL}:1.
        </p>
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label="Text contrast table"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Theme</th>
                <th scope="col">Text</th>
                <th scope="col">On</th>
                <th scope="col">Sample</th>
                <th scope="col">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={`${p.theme}-${p.fg}-${p.bg}`}>
                  <td>{p.theme}</td>
                  <td>
                    <code>{p.fg}</code>
                  </td>
                  <td>
                    <code>{p.bg}</code>
                  </td>
                  <td>
                    <span
                      className={styles.sample}
                      style={{ color: THEMES[p.theme][p.fg], background: THEMES[p.theme][p.bg] }}
                    >
                      Aa Genesis
                    </span>
                  </td>
                  <td>
                    {p.ratio.toFixed(2)} {p.ratio >= AA_NORMAL ? 'AA' : 'FAIL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="type">
        <h2 id="type" className="display">
          Type
        </h2>
        <div className={styles.typeGrid}>
          {['Gen', '1Macc', 'Luke'].map((id) => (
            <div key={id}>
              <p className={`book-name ${styles.bookName}`}>{book(id).name}</p>
              <p className="tagline">{book(id).tagline}</p>
            </div>
          ))}
        </div>
        <p className={styles.muted}>
          Display: Cormorant Garamond, with true small capitals for book names. Body: EB Garamond
          with old-style figures: <span className={styles.figures}>1234567890</span>.
        </p>
      </section>

      <section aria-labelledby="reader">
        <h2 id="reader" className="display">
          The page
        </h2>
        <div className={styles.readerPair}>
          <ReaderSample theme="vellum" />
          <ReaderSample theme="vault" />
        </div>
      </section>

      <section aria-labelledby="components">
        <h2 id="components" className="display">
          Reader parts
        </h2>
        <div className={styles.parts}>
          <div className={styles.fold}>
            <p className="label">
              Skim · {sec('gen-11').title} {skim.range}
            </p>
            <p>{skim.label}</p>
            <button type="button" className={styles.buttonQuiet}>
              Read it anyway
            </button>
          </div>
          <div className={styles.skip}>
            <hr className="gilt-rule" />
            <p>
              <span className="label">Skipped · Genesis {skip.range}</span> {skip.summary}
            </p>
          </div>
          <aside className={styles.note}>
            <p className="label">Note</p>
            <p>{note.text}</p>
          </aside>
          <aside className={styles.contentNote}>
            <p className="label">Content note</p>
            <p>{contentNote}</p>
          </aside>
          <div className="highlight-bar">
            <p className="label">Slow down</p>
            <p className={styles.muted}>
              Highlighted passages carry a thin gold bar in the margin.
            </p>
          </div>
          <a className={styles.next} href="#components">
            <span className="label">Next</span>
            <span className="display">{nextSection.title}</span>
            <span className={styles.muted}>Genesis {nextSection.range}</span>
          </a>
          <div className={styles.buttons}>
            <button type="button" className={styles.button}>
              Continue
            </button>
            <button type="button" className={styles.buttonQuiet}>
              Mark as read
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="materials">
        <h2 id="materials" className="display">
          Materials
        </h2>
        <div className={`vault-sky ${styles.sky}`} data-theme="vault">
          <span className="cloud-layer cloud-far" />
          <span className="cloud-layer cloud-mid" />
          <span className="cloud-layer cloud-near" />
          <div className={`gilt-frame ${styles.medallion}`}>
            <span className="book-name">{book('Gen').name}</span>
            <span className="tagline">{book('Gen').tagline}</span>
          </div>
        </div>
        <p className={styles.muted}>
          Three pre-rendered cloud layers (AVIF, WebP fallback), oculus and vignette as gradients,
          film grain tile.
        </p>
      </section>

      <section aria-labelledby="motion">
        <h2 id="motion" className="display">
          Motion
        </h2>
        <p className={styles.muted}>
          Camera: <code>{MOTION.easeCamera}</code>, {MOTION.durCamera}. Interface: {MOTION.durUi}.
          Reduced motion: every transition {MOTION.durReduced}.
        </p>
        <MotionDemo />
      </section>
    </main>
  );
}
