import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AA_NORMAL, contrast, textPairs, tokensCss } from '@/lib/design/tokens';

describe('design tokens', () => {
  it('computes WCAG contrast correctly', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it.each(textPairs().map((p) => [`${p.theme}: ${p.fg} on ${p.bg}`, p.ratio]))(
    'meets WCAG AA — %s',
    (_name, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    },
  );

  it('styles/tokens.css is up to date (run pnpm tokens)', () => {
    expect(fs.readFileSync('styles/tokens.css', 'utf8')).toBe(tokensCss());
  });
});
