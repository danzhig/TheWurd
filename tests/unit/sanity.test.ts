import { describe, expect, it } from 'vitest';
import plan from '@/content/plan/reading-plan.json';

describe('reading plan file', () => {
  it('is present and has steps', () => {
    expect(plan.steps.length).toBeGreaterThan(0);
  });
});
