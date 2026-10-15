/**
 * Beginners (owner 2026-10-15): Trading 101 lessons, the quiz on its own, then the help it
 * unlocks: a guided first trade with tap-to-explain words, and a Quick battle with a friend.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

test('Trading 101: six lessons, each with a Try it link', async ({ page }) => {
  await page.goto('learn');
  await expect(page.getByRole('heading', { name: 'Trading 101', level: 1 })).toBeVisible();
  const list = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Lessons' }) });
  await expect(list.getByRole('link')).toHaveCount(6);
  await axe(page);
  await list.getByRole('link', { name: /Market, limit and stop orders/ }).click();
  await expect(page.getByRole('heading', { name: 'Market, limit and stop orders', level: 1 })).toBeVisible();
  await expect(page.getByText(/Limit order: only buy at your price or lower/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the trade ticket' })).toHaveAttribute('href', /\/markets\/MSFT$/);
  await page.getByRole('link', { name: /Next: Stop-loss and take-profit/ }).click();
  await expect(page.getByRole('heading', { name: 'Stop-loss and take-profit', level: 1 })).toBeVisible();
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

  test('the quiz sets your level; a beginner gets a guided first trade and a Quick battle', async ({ page }, info) => {
    await page.goto('learn');
    const uid = await signIn(page, `learn-${info.project.name}${Date.now()}@example.com`);
    await page.getByRole('link', { name: 'Take the quiz' }).click();
    await expect(page.getByRole('heading', { name: 'Find your level' })).toBeVisible();
    await page.getByText('A little: a few trades').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Compete with my friends').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('You made $5', { exact: true }).click(); // wrong
    await expect(page.getByText('Not quite.')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Not sure yet').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('It only buys at $100 or less').click();
    await expect(page.getByText('Nice!')).toBeVisible();
    await page.getByRole('button', { name: 'See my level' }).click();
    await expect(page.getByRole('heading', { name: 'Beginner', level: 1 })).toBeVisible();
    await expect(page.getByText('Knowledge checks: 1 of 3 right.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Make a guided first trade/ })).toBeVisible();
    await axe(page);
    await expect.poll(async () => (await get(`users/${uid}`)).fields?.skill?.mapValue?.fields?.level?.stringValue).toBe('beginner');
    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(page.getByText('Beginner')).toBeVisible();

    // lesson done
    await page.goto('learn/stocks');
    await page.getByRole('button', { name: 'Mark as done' }).click();
    await expect(page.getByText('Lesson done. Nice!')).toBeVisible();
    await page.goto('learn');
    await expect(page.getByText('1 of 6 lessons done')).toBeVisible();

    // guided first trade with tap-to-explain words
    await page.goto('practice');
    await page.getByRole('button', { name: 'Start with $10,000' }).click();
    await expect(page.getByText('$10,000.00').first()).toBeVisible();
    await page.goto('practice/trade/AAPL');
    await expect(page.getByText('Your first trade, step by step')).toBeVisible();
    await expect(page.getByText('Fills right away at the current price.')).toBeVisible();
    await page.getByRole('button', { name: 'What is “Market order”?' }).click();
    const help = page.getByRole('dialog', { name: 'Market order' });
    await expect(help.getByText(/Buy or sell right away at the current price/)).toBeVisible();
    await expect(help.getByText('Stop-loss', { exact: true })).toBeVisible();
    await help.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('tab', { name: 'Limit' }).click();
    await expect(page.getByText('Waits until the price reaches your limit (or better).')).toBeVisible();

    // Quick battle: classic rules up front, game modes one tap away
    await page.goto('invite');
    await page.getByRole('button', { name: /Battle/ }).first().click();
    await expect(page.getByText('Quick battle', { exact: true })).toBeVisible();
    await expect(page.getByText('Last Man Standing', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose game modes' }).click();
    await expect(page.getByText(/Last Man Standing/).first()).toBeVisible();
  });
});
