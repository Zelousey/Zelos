/**
 * The learning loop (research review 2026-11-22): a missed quick check comes back for review
 * (graded on the server, always free), a lesson starts the learning streak and counts toward
 * today's goal, and the week's learning XP puts you in the learning league.
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

test('a missed question comes back for free review; lessons build the streak, the goal and the league', async ({ page }, info) => {
  await page.goto('learn');
  const uid = await signIn(page, `loop-${info.project.name}-${Date.now()}@example.com`);
  await patch(`traders/${uid}`, { name: `Robin ${info.project.name}` });
  // nothing yet: no streak, nothing to review
  const card = page.getByRole('region', { name: 'Your learning' });
  await expect(card).toBeVisible();
  await expect(card.getByText('0 days')).toBeVisible();
  await expect(card.getByText('Questions you miss come back here.')).toBeVisible();

  // lesson 1, with the quick check answered wrong
  await page.goto('learn/basics/stocks');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '$13' }).click();
  await expect.poll(async () => Object.keys((await get(`users/${uid}`)).fields?.review?.mapValue?.fields ?? {}), { timeout: 20_000 }).toEqual(['c:stocks']);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();
  await expect(page.getByText('+10 XP')).toBeVisible();

  // the miss comes back tomorrow; pretend tomorrow is here
  await page.goto('learn');
  await expect(card.getByText('1 day', { exact: true })).toBeVisible();
  await expect(card.getByLabel('10 of 20 learning XP today')).toBeVisible();
  await expect(card.getByText('Nothing due today. 1 coming back later.')).toBeVisible();
  expect((await patch(`users/${uid}`, { review: { 'c:stocks': { box: 0, due: nyToday() } } })).ok).toBe(true);
  await expect(card.getByText('Questions you missed, back today. Free.')).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/loop-card-${info.project.name}.png`, fullPage: false });
  await axe(page);

  await card.getByRole('link', { name: 'Review now' }).click();
  await expect(page).toHaveURL(/\/app\/learn\/review$/);
  await expect(page.getByText(/Review · free · What is a stock\?/)).toBeVisible();
  await page.getByRole('group', { name: 'Answers' }).getByRole('button').first().click(); // the right answer
  await expect(page.getByText(/^Comes back for review /)).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/review-${info.project.name}.png` });
  await axe(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review done' })).toBeVisible();
  await expect(page.getByText('You got 1 of 1 right.')).toBeVisible();
  await expect(page.getByText('+2 XP')).toBeVisible();
  // the server moved it to box 1 (back in 3 days)
  const r = (await get(`users/${uid}`)).fields?.review?.mapValue?.fields as Record<string, { mapValue: { fields: { box: { integerValue: string } } } }>;
  expect(r['c:stocks']!.mapValue.fields.box.integerValue).toBe('1');

  // a smaller goal, then the league
  await page.getByRole('link', { name: 'All lessons' }).click();
  await expect(card.getByLabel('12 of 20 learning XP today')).toBeVisible();
  await card.getByRole('button', { name: 'Change goal' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Casual/ }).click();
  await expect(card.getByLabel('12 of 10 learning XP today')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Goal met · change' })).toBeVisible();
  await card.getByRole('link', { name: /This week’s learning league/ }).click();
  await expect(page.getByRole('heading', { name: 'This week’s learning league', level: 1 })).toBeVisible();
  const me = page.getByRole('listitem').filter({ hasText: `Robin ${info.project.name}` });
  await expect(me).toContainText('12 XP');
  await expect(me).toContainText('you');
  await axe(page);
});
