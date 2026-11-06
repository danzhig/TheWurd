/**
 * Design tokens (docs/PLAN.md §8). This file is the single source: `pnpm tokens` writes
 * styles/tokens.css from it, and tests/unit/contrast.test.ts checks every text pair against WCAG AA.
 */

/** The plan's palette, unchanged. */
export const PALETTE = {
  night: '#14100C', // Vault background, edges of the ceiling
  umber: '#2A1F16', // panels and cards on the dark theme
  smoke: '#5B5248', // clouds, dimmed books; secondary text on Vellum
  cloud: '#B9AB97', // mid-cloud highlights, borders; body text on Vault
  vellum: '#F4ECDC', // reader page on the light theme
  ink: '#2A2118', // body text on vellum
  gold: '#C9A24A', // hairlines, verse numbers on Vault, the path thread
  goldLight: '#F0D48A', // the oculus, active and highlighted states
  vermilion: '#9E3B26', // sparing accent: current position, content notes
  lapis: '#2E4A6B', // rare accent: links in notes, the New Testament thread
} as const;

/**
 * Text-safe shades added in M2. Several plan colours are too dark (on Vault) or too pale (on
 * Vellum) to meet WCAG AA as text. Each shade keeps the plan colour's hue and changes only its
 * lightness, by the smallest step that passes 4.5:1 on both the page and the card surface. The plan
 * colours are still used as specified for hairlines, the thread, fills and large shapes.
 */
export const DERIVED = {
  smokeLight: '#958879', // smoke as secondary text on Vault (plan smoke: 2.5:1 on night)
  vermilionLight: '#D66B54', // vermilion as text on Vault (plan: 2.8:1)
  lapisLight: '#648CBC', // lapis as text on Vault (plan: 2.1:1)
  goldInk: '#795F24', // gold as text on Vellum: verse numbers, drop caps (plan gold: 2.0:1)
  parchment: '#EAE0CB', // card surface on Vellum
} as const;

export type ThemeName = 'vault' | 'vellum';

export const SEMANTIC_KEYS = [
  'bg', // page background
  'surface', // cards, panels, folds
  'text', // body text
  'text-strong', // headings
  'text-muted', // secondary text, captions, ranges
  'accent', // verse numbers, drop caps, small gold labels
  'accent-strong', // active / highlighted states
  'link', // links in notes
  'alert', // content notes, current position
  'rule', // gilt hairlines (decorative, not text)
  'rule-soft', // quiet dividers (decorative, not text)
] as const;
export type SemanticKey = (typeof SEMANTIC_KEYS)[number];

export const THEMES: Record<ThemeName, Record<SemanticKey, string>> = {
  vault: {
    bg: PALETTE.night,
    surface: PALETTE.umber,
    text: PALETTE.cloud,
    'text-strong': PALETTE.vellum,
    'text-muted': DERIVED.smokeLight,
    accent: PALETTE.gold,
    'accent-strong': PALETTE.goldLight,
    link: DERIVED.lapisLight,
    alert: DERIVED.vermilionLight,
    rule: PALETTE.gold,
    'rule-soft': PALETTE.smoke,
  },
  vellum: {
    bg: PALETTE.vellum,
    surface: DERIVED.parchment,
    text: PALETTE.ink,
    'text-strong': PALETTE.ink,
    'text-muted': PALETTE.smoke,
    accent: DERIVED.goldInk,
    'accent-strong': DERIVED.goldInk,
    link: PALETTE.lapis,
    alert: PALETTE.vermilion,
    rule: PALETTE.gold,
    'rule-soft': PALETTE.cloud,
  },
};

/** Every foreground used for text, on every background it can sit on, in each theme. */
export const TEXT_FOREGROUNDS: SemanticKey[] = [
  'text',
  'text-strong',
  'text-muted',
  'accent',
  'accent-strong',
  'link',
  'alert',
];
export const TEXT_BACKGROUNDS: SemanticKey[] = ['bg', 'surface'];

/** WCAG 2.2 AA for normal-size text. Large text needs only 3:1, but every pair is held to 4.5. */
export const AA_NORMAL = 4.5;

export const MOTION = {
  easeCamera: 'cubic-bezier(0.2, 0.7, 0.1, 1)',
  durCamera: '850ms',
  durCover: '700ms',
  durUi: '200ms',
  durReduced: '150ms',
} as const;

/** Reader text size: four steps (PLAN §10 settings); body sits at 19–21 px by default. */
export const TEXT_SIZES = ['18px', '20px', '22px', '24px'] as const;
export const DEFAULT_TEXT_SIZE = 1;

export const TYPE = {
  display: "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
  body: "'EB Garamond', Georgia, 'Times New Roman', serif",
  measure: '34em',
  lineHeight: '1.6',
} as const;

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((x) => channel(parseInt(x, 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

export interface TextPair {
  theme: ThemeName;
  fg: SemanticKey;
  bg: SemanticKey;
  ratio: number;
}

export function textPairs(): TextPair[] {
  const out: TextPair[] = [];
  for (const theme of Object.keys(THEMES) as ThemeName[]) {
    for (const fg of TEXT_FOREGROUNDS) {
      for (const bg of TEXT_BACKGROUNDS) {
        out.push({ theme, fg, bg, ratio: contrast(THEMES[theme][fg], THEMES[theme][bg]) });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export function tokensCss(): string {
  const L: string[] = [];
  L.push('/* Generated from lib/design/tokens.ts by `pnpm tokens`. Do not edit by hand. */', '');
  L.push(':root {');
  for (const [k, v] of Object.entries(PALETTE)) L.push(`  --${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(DERIVED)) L.push(`  --${kebab(k)}: ${v};`);
  L.push('');
  L.push(`  --font-display: ${TYPE.display};`);
  L.push(`  --font-body: ${TYPE.body};`);
  L.push(`  --measure: ${TYPE.measure};`);
  L.push(`  --line-height: ${TYPE.lineHeight};`);
  TEXT_SIZES.forEach((s, i) => L.push(`  --text-size-${i + 1}: ${s};`));
  L.push(`  --reader-size: var(--text-size-${DEFAULT_TEXT_SIZE + 1});`);
  L.push('');
  L.push(`  --ease-camera: ${MOTION.easeCamera};`);
  L.push(`  --dur-camera: ${MOTION.durCamera};`);
  L.push(`  --dur-cover: ${MOTION.durCover};`);
  L.push(`  --dur-ui: ${MOTION.durUi};`);
  L.push('}', '');
  TEXT_SIZES.forEach((_, i) =>
    L.push(
      `:root[data-text-size='${i + 1}'] {`,
      `  --reader-size: var(--text-size-${i + 1});`,
      '}',
      '',
    ),
  );
  L.push('@media (prefers-reduced-motion: reduce) {', '  :root {');
  L.push(`    --dur-camera: ${MOTION.durReduced};`);
  L.push(`    --dur-cover: ${MOTION.durReduced};`);
  L.push(`    --dur-ui: ${MOTION.durReduced};`);
  L.push('  }', '}', '');

  const block = (theme: ThemeName, indent = '  ') =>
    SEMANTIC_KEYS.map((k) => `${indent}--${k}: ${THEMES[theme][k]};`).join('\n');
  // Vault is the default when no theme is set (no JavaScript, or before the theme script runs).
  L.push(`:root,\n[data-theme='vault'] {\n  color-scheme: dark;\n${block('vault')}\n}`, '');
  L.push(`[data-theme='vellum'] {\n  color-scheme: light;\n${block('vellum')}\n}`, '');
  return L.join('\n');
}
