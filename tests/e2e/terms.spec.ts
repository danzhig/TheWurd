import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PLAN P3.2: the Depth toggle and the word-card deck (Genesis seed terms, drafts). */

async function open(page: Page, id: string) {
  await page.goto(`/read/${id}/`);
  await expect(page.locator('html')).toHaveAttribute('data-reader', id);
}

test.describe('Depth and word cards', () => {
  test('Depth marks the terms; a term opens its deck; keys and dots move through the cards', async ({
    page,
  }) => {
    await open(page, 'gen-02');
    const term = page.locator('[data-term="gen-3-15-pronoun"]');
    await expect(term).not.toHaveAttribute('role', 'button');
    await page.getByTestId('depth-toggle').click();
    await expect(page.getByTestId('depth-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(term).toHaveAttribute('role', 'button');
    await term.focus();
    await page.keyboard.press('Enter');
    const deck = page.getByTestId('term-deck');
    await expect(deck).toBeVisible();
    await expect(deck.getByTestId('term-draft')).toBeVisible();
    await expect(deck.locator('[data-card="original"]')).toContainText('H1931');
    const dots = deck.getByRole('navigation', { name: 'Cards' }).getByRole('button');
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
    await dots.last().click();
    await expect(dots.last()).toHaveAttribute('aria-current', 'true');
    await expect(deck.locator('[data-card="debate"]')).toBeInViewport();
    // Arrow keys move cards, not sections, while the deck is open.
    await expect(page).toHaveURL(/\/read\/gen-02\//);
    await page.keyboard.press('Escape');
    await expect(deck).toBeHidden();
  });

  test('Depth is remembered, and absent where a section has no terms', async ({ page }) => {
    await open(page, 'gen-01');
    await page.getByTestId('depth-toggle').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-01');
    await expect(page.getByTestId('depth-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-depth', 'on');
    await open(page, 'gen-03');
    await expect(page.getByTestId('depth-toggle')).toHaveCount(0);
  });

  test('the Vulgate card shows the Latin as written', async ({ page }) => {
    await open(page, 'gen-02');
    await page.getByTestId('depth-toggle').click();
    await page.locator('[data-term="gen-3-15-pronoun"]').click();
    const latin = page
      .getByTestId('term-deck')
      .locator('[data-card="vulgate"] [lang="la"]')
      .first();
    expect(await latin.evaluate((el) => getComputedStyle(el).fontFeatureSettings)).toMatch(
      /locl.*0/,
    );
  });

  test('no serious accessibility issues with the deck open', async ({ page }) => {
    await open(page, 'gen-01');
    await page.getByTestId('depth-toggle').click();
    await page.locator('[data-term="gen-1-2-ruach"]').click();
    await expect(page.getByTestId('term-deck')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });

  test('/review lists the drafts with their citations', async ({ page }) => {
    await page.goto('/review/');
    await expect(page.locator('[data-review]')).toHaveCount(6);
    await expect(page.locator('[data-review="gen-3-15-pronoun"]')).toContainText('TAHOT');
  });
});
