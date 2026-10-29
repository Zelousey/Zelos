/**
 * The Trade War hub (Phase 5): where the tab opens (Solo > a running battle's Overview > the
 * mode picker), the section row (switches without a reload), the scoped Overview and the
 * Squad section's Together / Compete split.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string'
    ? { stringValue: x }
    : typeof x === 'number'
      ? { integerValue: String(x) }
      : Array.isArray(x)
        ? { arrayValue: { values: x.map(v) } }
        : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity), null, { timeout: 2000 }).catch(() => undefined);
const axe = async (page: Page) => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};
const row = (page: Page) => page.getByRole('navigation', { name: 'Trade War sections' });
/** Wait until this tab has noted the Trade War section (hub.ts noteSection, sessionStorage). */
const remembered = (page: Page, section: string) =>
  page.waitForFunction((x) => (JSON.parse(sessionStorage.getItem('zelosTradeWarSection') ?? 'null') as { section?: string } | null)?.section === x, section);

test('nothing running: the tab asks how you want to play; the section row switches without a reload', async ({ page }) => {
  await page.goto('trade-war');
  await expect(page.getByRole('heading', { name: 'How do you want to play?' })).toBeVisible();
  const modes = page.getByRole('list', { name: 'Ways to play' });
  await expect(modes.getByRole('link')).toHaveCount(2); // Solo and Battle (Squad is inside Battle); the war zone shows once built
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/modes-${test.info().project.name}.png`, fullPage: true });
  expect(await axe(page)).toEqual([]);

  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
  const stops: [string, RegExp, string | RegExp][] = [
    ['Solo', /\/trade-war\/solo$/, 'Solo: your practice account'],
    ['Battle', /\/battles$/, 'Battles'],
    ['Leaderboards', /\/leaderboard$/, 'Leaderboard'],
    ['Strategies', /\/strategies$/, 'Strategies'],
    ['Overview', /\/trade-war\/overview$/, 'Trade War'],
  ];
  for (const [name, url, heading] of stops) {
    await row(page).getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expect(row(page).getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1); // never reloaded
  await expect(page.getByText('Sign in to see your Solo account, your battles and your squads in one place.')).toBeVisible();
});

test('a running battle: the tab opens the Overview, every number says its mode; Solo reopens when you were last there', async ({ page }, info) => {
  await page.goto('trade-war');
  const uid = await signIn(page, `hub-${info.project.name}${Date.now()}@example.com`);
  const now = Date.now();
  await put(`tradeWars/hub-${uid}`, { name: 'Hub fight', status: 'active', players: [uid], maxPlayers: 4, createdAt: now - 3600_000, endAt: now + 2 * 86400_000 });
  await put(`tradeWars/hubdone-${uid}`, { name: 'Old fight', status: 'ended', players: [uid], maxPlayers: 4, createdAt: now - 9 * 86400_000, endAt: now - 6 * 86400_000, results: [{ uid, rank: 2 }, { uid: 'x', rank: 1 }] });
  await page.goto('dashboard');
  await page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link', { name: 'Trade War' }).click();
  await expect(page).toHaveURL(/\/trade-war$/);
  const summary = page.getByRole('region', { name: 'Your Trade War at a glance' });
  await expect(summary).toContainText('Solo · Account value');
  await expect(summary.getByRole('link', { name: 'Not started' })).toHaveAttribute('href', '/app/trade-war/solo'); // no Solo account yet
  await expect(summary).toContainText('Battle · Running');
  await expect(summary).toContainText('Squad · Your squads');
  const battles = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Battles', exact: true }) }).first();
  await expect(battles.getByRole('link', { name: /Hub fight/ })).toHaveAttribute('href', `/app/battles/hub-${uid}`);
  await expect(page.getByRole('link', { name: /Old fight/ })).toBeVisible(); // recent results
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/overview-${info.project.name}.png`, fullPage: true });
  await expect(page.getByText('Leaderboard: Solo accounts (battle results stay in each battle room)')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // A beats B: after Solo, the tab reopens Solo even with a battle running
  await row(page).getByRole('link', { name: 'Solo', exact: true }).click();
  await expect(page).toHaveURL(/\/trade-war\/solo$/);
  await remembered(page, 'solo'); // the tab remembers Solo before we leave (a reload right away could beat it)
  await page.goto('dashboard');
  await page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link', { name: 'Trade War' }).click();
  await expect(page).toHaveURL(/\/trade-war\/solo$/);
  // another section ends the Solo session: back to the Overview
  await row(page).getByRole('link', { name: 'Battle', exact: true }).click();
  await remembered(page, 'battle');
  await page.goto('trade-war');
  await expect(page.getByRole('region', { name: 'Your Trade War at a glance' })).toBeVisible();
});

test('Squad: Together and Compete; a Compete format opens the battle form with its rules picked', async ({ page }, info) => {
  await page.goto('social');
  const uid = await signIn(page, `hubsq-${info.project.name}${Date.now()}@example.com`);
  await put(`users/${uid}?updateMask.fieldPaths=learnPassed`, { learnPassed: { basics: Date.now() } }); // battles open after Chapter 1 (learn_quiz writes this in real life)
  await page.reload();
  const ways = page.getByRole('group', { name: 'Ways to play as a squad' });
  await expect(ways.getByRole('heading', { name: 'Together' })).toBeVisible();
  await expect(ways.getByRole('heading', { name: 'Compete' })).toBeVisible();
  await expect(row(page).getByRole('link', { name: 'Battle', exact: true })).toHaveAttribute('aria-current', 'page'); // squads live under Battle
  expect(await axe(page)).toEqual([]);
  await ways.getByRole('link', { name: /Last Man Standing battle/ }).click();
  await expect(page).toHaveURL(/\/invite\?kind=battle&mode=lms$/);
  await expect(page.getByText('Elimination rules')).toBeVisible();
});

test('Battle starts with a choice: a head-to-head Duel, or Squad', async ({ page }) => {
  await page.goto('battles');
  const kinds = page.getByRole('region', { name: 'How do you want to battle?' });
  await expect(kinds.getByRole('link', { name: /^Duel/ })).toHaveAttribute('href', '/app/invite?kind=battle');
  await kinds.getByRole('link', { name: /^Squad/ }).click();
  await expect(page).toHaveURL(/\/social$/);
  await expect(row(page).getByRole('link', { name: 'Battle', exact: true })).toHaveAttribute('aria-current', 'page');
});
