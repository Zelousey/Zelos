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

test('Trading 101: chapter 1 path, an animated lesson with a quick check, old links redirect', async ({ page }) => {
  await page.goto('learn');
  await expect(page.getByRole('heading', { name: 'Trading 101', level: 1 })).toBeVisible();
  const ch = page.getByRole('region', { name: 'The basics' });
  await expect(ch.getByText('Chapter 1')).toBeVisible();
  await expect(ch.getByRole('listitem')).toHaveCount(9); // 8 lessons + the chapter quiz
  await expect(ch.getByRole('link', { name: /Chapter quiz/ })).toBeVisible();
  await axe(page);

  await ch.getByRole('link', { name: 'Lesson 1: What is a stock?' }).click();
  await expect(page).toHaveURL(/\/app\/learn\/basics\/stocks$/);
  await expect(page.getByRole('heading', { name: 'Meet a company' })).toBeVisible();
  await axe(page);
  for (const next of ['Cut it into pieces', 'Buy one share', 'When it does well, the price goes up', 'It can go down too']) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: next })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /How much did you make/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick an answer' })).toBeDisabled();
  await page.getByRole('button', { name: '$13' }).click();
  await expect(page.getByText(/Not quite. \$13 is what the share is worth now/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();
  await expect(page.getByText('Sign in to save your progress and earn XP.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Look at real stocks' })).toHaveAttribute('href', /\/markets$/);
  await page.getByRole('link', { name: 'Next: Why prices move' }).click();
  await expect(page.getByRole('heading', { name: 'More buyers: the price goes up' })).toBeVisible();

  // chapter 2: charts & volume (signed out, every lesson is open to read)
  await page.goto('learn');
  const ch2 = page.getByRole('region', { name: 'Charts & volume' });
  await expect(ch2.getByText('Chapter 2')).toBeVisible();
  await expect(ch2.getByRole('listitem')).toHaveCount(9);
  await ch2.getByRole('link', { name: 'Lesson 7: RSI' }).click();
  await expect(page).toHaveURL(/\/app\/learn\/charts\/rsi$/);
  await expect(page.getByRole('heading', { name: 'A score from 0 to 100' })).toBeVisible();
  await axe(page);
  for (const next of ['Above 70: overbought', 'Below 30: oversold']) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: next })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /It has run up fast/ }).click();
  await expect(page.getByText(/Right. Above 70 is overbought/)).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: 'Next: Your chart checklist' })).toBeVisible();

  // the old one-page lessons land on their new place
  await page.goto('learn/orders');
  await expect(page).toHaveURL(/\/app\/learn\/basics\/buy-sell$/);
  await expect(page.getByRole('heading', { name: 'The trade ticket' })).toBeVisible();
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

    // a lesson, start to finish: 10 XP from the server, and the next lesson opens
    await page.goto('learn');
    const ch = page.getByRole('region', { name: 'The basics' });
    const ch2 = page.getByRole('region', { name: 'Charts & volume' });
    await expect(ch.getByRole('link', { name: /Lesson 2/ })).toHaveCount(0); // locked until lesson 1 is done
    await expect(ch2.getByText('Finish Chapter 1 (or pass its quiz) to open this chapter.')).toBeVisible();
    await expect(ch2.getByRole('link')).toHaveCount(0);
    await page.goto('learn/basics/prices');
    await expect(page.getByText('This lesson isn’t open yet')).toBeVisible();
    await page.goto('learn/basics/stocks');
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: '$3' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('+10 XP')).toBeVisible();
    await expect.poll(async () => (await get(`users/${uid}`)).fields?.learnDone?.arrayValue?.values?.map((v: { stringValue: string }) => v.stringValue)).toEqual(['stocks']);
    await page.goto('learn');
    await expect(ch.getByText('1 of 8 lessons done')).toBeVisible();
    await expect(ch.getByRole('link', { name: 'Lesson 2: Why prices move' })).toBeVisible();

    // test out: the chapter quiz, graded by the server (wrong first, then right)
    await ch.getByRole('link', { name: /Chapter quiz/ }).click();
    await expect(page.getByRole('heading', { name: 'Chapter 1 quiz: The basics', level: 1 })).toBeVisible();
    const pick = async (answers: number[]) => {
      const qs = page.getByRole('group');
      for (const [i, a] of answers.entries()) await qs.nth(i).getByRole('radio').nth(a).check();
    };
    await pick([0, 1, 0, 0, 1]);
    await page.getByRole('button', { name: 'Check my answers' }).click();
    await expect(page.getByText('Not quite yet')).toBeVisible();
    await expect(page.getByText('0 of 5 right. You need 4 to pass.')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await pick([1, 0, 2, 2, 0]);
    await page.getByRole('button', { name: 'Check my answers' }).click();
    await expect(page.getByText('You passed!')).toBeVisible();
    await expect(page.getByText('+50 XP')).toBeVisible();
    await axe(page);
    await expect.poll(async () => !!(await get(`users/${uid}`)).fields?.learnPassed?.mapValue?.fields?.basics).toBe(true);
    await page.goto('learn');
    await expect(ch.getByText('Passed', { exact: true })).toBeVisible();
    await expect(ch.getByRole('link', { name: 'Lesson 8: Battles with friends' })).toBeVisible(); // a passed chapter opens every lesson
    await expect(ch2.getByRole('link', { name: 'Lesson 1: Timeframes' })).toBeVisible(); // ...and the next chapter
    await expect(ch2.getByRole('link', { name: /Lesson 2/ })).toHaveCount(0);
    await page.goto('learn/charts/trends');
    await expect(page.getByText('This lesson isn’t open yet')).toBeVisible();
    await page.goto('learn/charts/timeframes');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'One hour of trading' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('+10 XP')).toBeVisible();

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
