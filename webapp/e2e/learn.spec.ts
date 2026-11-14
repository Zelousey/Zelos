/**
 * Beginners (owner 2026-10-15): Trading 101 lessons, the quiz on its own, then the help it
 * unlocks: a guided first trade with tap-to-explain words, and a Quick battle with a friend.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
const put = (path: string, data: Record<string, number>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { integerValue: String(v) }])) }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
// lessons fade in: check contrast only once the entry animations are done (a half-faded line
// reads as low contrast; seen once in CI, 2026-10-22). Endless animations are ignored.
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
const axe = async (page: Page) => {
  await settled(page);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
};

test('Trading 101: chapter 1 path, an animated lesson with a quick check, old links redirect', async ({ page }) => {
  await page.goto('learn');
  await expect(page.getByRole('heading', { name: 'Trading 101', level: 1 })).toBeVisible();
  // every chapter is a book on a shelf (owner 2026-11-12); a book opens on two choices
  const shelf = page.getByRole('list', { name: 'Trading 101 books' });
  await expect(shelf.getByRole('link')).toHaveCount(10); // owner 2026-11-14: ten books
  await expect(shelf.getByRole('link', { name: /^Book 8: Advanced stock trading/ })).toContainText('Advanced');
  await expect(shelf.getByRole('link', { name: /^Book 10: The mental game/ })).toContainText('Always open');
  await axe(page);
  await shelf.getByRole('link', { name: /^Book 1: Stock trading fundamentals/ }).click();
  await expect(page).toHaveURL(/\/app\/learn\/basics$/);
  await expect(page.getByRole('link', { name: 'Learn from the start' })).toHaveAttribute('href', '/app/learn/basics/stocks');
  await expect(page.getByRole('link', { name: /Skip to the chapter quiz/ })).toHaveAttribute('href', '/app/learn/basics/quiz');
  const ch = page.getByRole('region', { name: 'Stock trading fundamentals' });
  await expect(ch.getByText('Chapter 1')).toBeVisible();
  await expect(ch.getByRole('listitem')).toHaveCount(12); // 11 lessons + the chapter quiz
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
  await page.getByRole('link', { name: 'Next: How the stock market works' }).click();
  await expect(page.getByRole('heading', { name: 'A giant marketplace' })).toBeVisible();
  await page.goto('learn/basics/prices');
  await expect(page.getByRole('heading', { name: 'More buyers: the price goes up' })).toBeVisible();
  // lesson 2 also covers market hours (owner list D): pre-market / after-hours, world markets, time zones
  for (const next of ['More sellers: the price goes down', 'Good news brings buyers', 'Bad news brings sellers', 'It moves all day', 'Before and after the bell', 'The world takes turns', 'Mind the clock']) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: next })).toBeVisible();
  }
  await expect(page.getByText(/London and New York are 4 hours apart instead of 5/)).toBeVisible();
  await axe(page);

  // chapter 4: indicators, forecasts & alerts (signed out, every lesson is open to read); RSI moved here
  await page.goto('learn/signals');
  const ch2 = page.getByRole('region', { name: 'Indicators, forecasts & alerts' });
  await expect(ch2.getByText('Chapter 4')).toBeVisible();
  await expect(ch2.getByRole('listitem')).toHaveCount(10);
  await ch2.getByRole('link', { name: 'Lesson 3: RSI' }).click();
  await expect(page).toHaveURL(/\/app\/learn\/signals\/rsi$/);
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
  await expect(page.getByRole('link', { name: 'Next: MACD' })).toBeVisible();

  // a chart pattern drawn as a chart, and runner contracts only in Advanced options
  await page.goto('learn/patterns/pat-hs');
  await expect(page.getByRole('heading', { name: 'What it looks like' })).toBeVisible();
  await axe(page);
  await page.goto('learn/adv-options/ao-runner');
  await expect(page.getByRole('heading', { name: 'Start with several' })).toBeVisible();

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
    await expect(page.getByRole('link', { name: /^Book 2: Positions, entries, exits & risk\. locked/ })).toBeVisible();
    // The mental game is never locked (owner 2026-11-14)
    await expect(page.getByRole('link', { name: /^Book 10: The mental game\. 0 of 10/ })).toBeVisible();
    await page.goto('learn/mind');
    await expect(page.getByRole('region', { name: 'The mental game' }).getByRole('link', { name: 'Lesson 1: Revenge trading' })).toBeVisible();
    const ch = page.getByRole('region', { name: 'Stock trading fundamentals' });
    const ch2 = page.getByRole('region', { name: 'Positions, entries, exits & risk' });
    await page.goto('learn/risk');
    await expect(page.getByText('Finish Chapter 1 (or pass its quiz) to open this chapter.').first()).toBeVisible();
    await expect(ch2.getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Skip to the chapter quiz/ })).toHaveCount(0);
    await page.goto('learn/basics');
    await expect(ch.getByRole('link', { name: /Lesson 2/ })).toHaveCount(0); // locked until lesson 1 is done
    await page.goto('learn/risk/quiz');
    await expect(page.getByText('Pass Chapter 1 first')).toBeVisible();
    await page.goto('learn');
    await page.goto('learn/basics/market-works');
    await expect(page.getByText('This lesson isn’t open yet')).toBeVisible();
    await page.goto('learn/basics/stocks');
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: '$3' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('+10 XP')).toBeVisible();
    await expect.poll(async () => (await get(`users/${uid}`)).fields?.learnDone?.arrayValue?.values?.map((v: { stringValue: string }) => v.stringValue)).toEqual(['stocks']);
    await page.goto('learn/basics');
    await expect(ch.getByText('1 of 11 lessons done')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue: How the stock market works' })).toHaveAttribute('href', '/app/learn/basics/market-works');
    await expect(ch.getByRole('link', { name: 'Lesson 2: How the stock market works' })).toBeVisible();

    // test out: the chapter quiz, graded by the server (wrong first, then right)
    await ch.getByRole('link', { name: /Chapter quiz/ }).click();
    await expect(page.getByRole('heading', { name: 'Chapter 1 quiz: Stock trading fundamentals', level: 1 })).toBeVisible();
    const pick = async (answers: number[]) => {
      const qs = page.getByRole('group');
      for (const [i, a] of answers.entries()) await qs.nth(i).getByRole('radio').nth(a).check();
    };
    await pick([0, 1, 0, 0, 1]);
    await page.getByRole('button', { name: 'Check my answers' }).click();
    await expect(page.getByText('Not quite yet')).toBeVisible();
    await expect(page.getByText('0 of 5 right. You need 4 to pass.')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    // the results showed the answers, so the next try waits 12 hours, or costs 10 tokens now (owner 2026-10-23)
    await expect(page.getByText(/^Free retake in 1[12]h \d+m$/)).toBeVisible();
    await expect(page.getByRole('radio').first()).toBeDisabled(); // the questions stay locked until then
    await put(`wallets/${uid}`, { balance: 12 });
    await page.getByRole('button', { name: 'Retake now · 10 tokens' }).click();
    await expect(page.getByText('This retake costs 10 tokens when you check your answers.')).toBeVisible();
    await pick([1, 0, 1, 2, 0]);
    await page.getByRole('button', { name: 'Check my answers' }).click();
    await expect(page.getByText('You passed!')).toBeVisible();
    await expect(page.getByText('10 tokens spent on the retake.')).toBeVisible();
    await expect.poll(async () => (await get(`wallets/${uid}`)).fields?.balance?.integerValue).toBe('2');
    await expect(page.getByText('+50 XP')).toBeVisible();
    await axe(page);
    await expect.poll(async () => !!(await get(`users/${uid}`)).fields?.learnPassed?.mapValue?.fields?.basics).toBe(true);
    await page.goto('learn/basics');
    await expect(ch.getByText('Passed', { exact: true })).toBeVisible();
    await expect(ch.getByRole('link', { name: 'Lesson 11: Battles with friends' })).toBeVisible(); // a passed chapter opens every lesson
    await page.goto('learn/risk');
    await expect(ch2.getByRole('link', { name: 'Lesson 1: What a position is' })).toBeVisible(); // ...and the next chapter
    await expect(ch2.getByRole('link', { name: /Lesson 2/ })).toHaveCount(0);
    await page.goto('learn/risk/entry');
    await expect(page.getByText('This lesson isn’t open yet')).toBeVisible();
    await page.goto('learn/risk/position');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'A 15-share position' }).click();
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

test('leave a lesson or the quiz for a chart, then come straight back to the same step (owner list D)', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  await page.goto('learn/basics/stocks');
  for (const next of ['Cut it into pieces', 'Buy one share']) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: next })).toBeVisible();
  }
  await expect(page).toHaveURL(/\/learn\/basics\/stocks\?step=2$/);
  // the step survives a reload (and the back button) because it's in the address
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Buy one share' })).toBeVisible();

  // off to a chart; a button brings you back to that exact step
  await nav.getByRole('link', { name: 'Market' }).click();
  const back = page.getByTestId('learn-return');
  await expect(back).toContainText('What is a stock?');
  await expect(back).toContainText('step 3 of');
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity), null, { timeout: 2000 }).catch(() => undefined);
  expect((await new AxeBuilder({ page }).include('[data-testid="learn-return"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await back.getByRole('link').click();
  await expect(page).toHaveURL(/\/learn\/basics\/stocks\?step=2$/);
  await expect(page.getByRole('heading', { name: 'Buy one share' })).toBeVisible();
  await expect(back).toHaveCount(0); // never shown inside Trading 101

  // the chapter quiz keeps your answers while you look at something else
  await page.goto('learn/basics/quiz');
  const qs = page.getByRole('group');
  await qs.nth(0).getByRole('radio').nth(1).check();
  await qs.nth(1).getByRole('radio').nth(2).check();
  await nav.getByRole('link', { name: 'Market' }).click();
  await expect(back).toContainText('Chapter 1 quiz');
  await back.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Chapter 1 quiz: Stock trading fundamentals', level: 1 })).toBeVisible();
  await expect(page.getByRole('group').nth(0).getByRole('radio').nth(1)).toBeChecked();
  await expect(page.getByRole('group').nth(1).getByRole('radio').nth(2)).toBeChecked();

  // closing the button hides it
  await nav.getByRole('link', { name: 'Market' }).click();
  await back.getByRole('button', { name: 'Hide' }).click();
  await expect(back).toHaveCount(0);
});
