/**
 * New quick-check types (research review 2026-11-22: vary the practice): tap the level on a chart,
 * spot the pattern on an unlabelled chart, and put the steps in order. The server grades them, and a
 * miss comes back for review in the same form.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
test.describe.configure({ timeout: 120_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: H }).then((r) => r.json() as Promise<{ fields?: Record<string, { mapValue?: { fields?: Record<string, unknown> } }> }>);
type V = string | number | { [k: string]: V };
const v = (x: V): unknown => (typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? { integerValue: String(x) } : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } });
const patch = (path: string, data: Record<string, V>) =>
  fetch(`${BASE}/${path}?${Object.keys(data).map((k) => `updateMask.fieldPaths=${k}`).join('&')}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
const axe = async (page: Page) => {
  await settled(page);
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
};
const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const shot = (page: Page, name: string, info: { project: { name: string } }) => (process.env.SHOTS ? page.screenshot({ path: `${process.env.SHOTS}/${name}-${info.project.name}.png` }) : null);
/** Through a lesson's scenes to its first quick check. */
async function toCheck(page: Page, path: string, scenes: number) {
  await page.goto(path);
  for (let i = 0; i < scenes; i++) await page.getByRole('button', { name: 'Continue' }).click();
}

test('tap the level, spot the pattern, put it in order; a missed order question comes back in review', async ({ page }, info) => {
  await page.goto('learn');
  const uid = await signIn(page, `ck-${info.project.name}-${Date.now()}@example.com`);
  // every chapter open (written by the server's learn_quiz in real life)
  const passed = { basics: 1, risk: 1, charts: 1, signals: 1, patterns: 1 };
  expect((await patch(`users/${uid}`, { learnPassed: passed })).ok).toBe(true);

  // stop-loss lesson: the first check as before, then "Quick check 2 of 2 · Tap the level"
  await toCheck(page, 'learn/risk/stops', 3);
  await expect(page.getByText('Quick check 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Your shares were sold around $95' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Quick check 2 of 2 · Tap the level')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You bought on a bounce off support. Where does your stop-loss go?' })).toBeVisible();
  const levels = page.getByRole('group', { name: 'Levels on the chart' });
  await expect(levels.getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Pick an answer' })).toBeDisabled();
  await axe(page);
  await shot(page, 'check-level', info);
  await levels.getByRole('button', { name: /B · \$134/ }).click();
  await expect(page.getByText(/^Right\. B sits just under the floor/)).toBeVisible();
  await shot(page, 'check-level-done', info);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();

  // double tops: spot the pattern on an unlabelled chart
  await toCheck(page, 'learn/patterns/pat-double', 3);
  await page.getByRole('group', { name: 'Answers' }).getByRole('button').nth(1).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Spot it: what pattern is this?' })).toBeVisible();
  await shot(page, 'check-spot', info);
  await page.getByRole('button', { name: 'Double top' }).click();
  await expect(page.getByText(/^Right\. Two peaks at the same high/)).toBeVisible();

  // planning your exit: put the plan in order, wrong on purpose
  await toCheck(page, 'learn/risk/exit-plan', 3);
  await page.getByRole('group', { name: 'Answers' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Quick check 2 of 2 · Put it in order')).toBeVisible();
  const steps = page.getByRole('group', { name: 'Steps to place' });
  // tap a step, then take it back
  await steps.getByRole('button', { name: 'Set your stop-loss' }).click();
  await page.getByRole('button', { name: 'Step 1: Set your stop-loss. Tap to take it back' }).click();
  await expect(steps.getByRole('button')).toHaveCount(5);
  for (const st of ['Choose your entry price', 'Find a setup with a reason', 'Set your stop-loss', 'Work out how many shares from the stop', 'Place the order with its stop and target']) await steps.getByRole('button', { name: st }).click();
  await shot(page, 'check-order', info);
  await axe(page);
  await page.getByRole('button', { name: 'Check my order' }).click();
  await expect(page.getByText(/^The reason comes first, then the entry and the stop/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'The right order' })).toContainText('Find a setup with a reason');
  await shot(page, 'check-order-done', info);
  // the server saw the wrong order and queued it for review
  await expect.poll(async () => Object.keys((await get(`users/${uid}`)).fields?.review?.mapValue?.fields ?? {}), { timeout: 20_000 }).toContain('c:exit-plan:2');

  // review it (due today, as if a day had passed), the right way round this time
  expect((await patch(`users/${uid}`, { review: { 'c:exit-plan:2': { box: 0, due: nyToday() } } })).ok).toBe(true);
  await page.goto('learn/review');
  await expect(page.getByRole('heading', { name: 'Put a trade plan in order.' })).toBeVisible();
  const again = page.getByRole('group', { name: 'Steps to place' });
  for (const st of ['Find a setup with a reason', 'Choose your entry price', 'Set your stop-loss', 'Work out how many shares from the stop', 'Place the order with its stop and target']) await again.getByRole('button', { name: st }).click();
  await page.getByRole('button', { name: 'Check my order' }).click();
  await expect(page.getByText(/^Comes back for review /)).toBeVisible();
  await expect(page.getByRole('list', { name: 'The right order' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('You got 1 of 1 right.')).toBeVisible();
});
