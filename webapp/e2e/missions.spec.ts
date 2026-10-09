/**
 * Missions & XP in the app: level and XP, streak, daily/weekly missions, every achievement,
 * recent XP and invite rewards; creating a squad unlocks "Squad Up" with its XP (server-paid)
 * and shows it on the public profile.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  x instanceof Date ? { timestampValue: x.toISOString() } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
const get = async (path: string) => {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? ((await r.json()) as { fields?: Record<string, Record<string, unknown>> }).fields ?? {} : null;
};
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const nyDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

test('level, streak, missions, achievements, recent XP and invites', async ({ page }, info) => {
  await page.goto('missions');
  await expect(page.getByText('Sign in to see your level')).toBeVisible();
  const uid = await signIn(page, `ms-${info.project.name}${Date.now()}@example.com`);
  const now = Date.now();
  await put(`users/${uid}`, {
    xp: 275,
    progress: { v: 1, updatedAt: now, day: { date: nyDay(), counts: { trade: 1, analyze: 2 }, analyzed: [], done: { trade: true } }, week: { key: '', counts: {}, done: {} }, streak: { days: 4, best: 6, lastDate: nyDay(-1), start: '' }, totals: {}, achievements: { 'first-trade': now } },
  });
  await put(`users/${uid}/activity/practice-trade:x1`, { type: 'practice-trade', label: 'Trade War trade', xp: 5, source: 'trade-war', createdAt: new Date(now - 60_000) });
  await put(`referrals/msRefFriend${info.project.name}`.slice(0, 40), { referrer: uid, createdAt: now });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Missions & XP', level: 1 })).toBeAttached();
  await expect(page.getByText('Level 3 · Risk Manager')).toBeVisible();
  await expect(page.getByText('125 XP to Level 4 (Platinum)')).toBeVisible();
  await expect(page.getByText('🔥 4')).toBeVisible();
  const daily = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Daily missions' }) });
  await expect(daily.getByLabel('1 of 1, done')).toBeVisible();
  await expect(daily.getByLabel('2 of 3')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly missions' })).toBeVisible();
  await expect(page.getByText('1 of 29')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'First Trade' }).getByText('Earned')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Centurion' })).toContainText('+200');
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Recent XP' }) })).toContainText('Trade War trade');
  await expect(page.getByText('1 friend(s) joined so far')).toBeVisible();
  await expect(page.getByText('🥉 Bronze recruiter')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
});

test('creating a squad in the app unlocks Squad Up', async ({ page }, info) => {
  await page.goto('social');
  const uid = await signIn(page, `msq-${info.project.name}${Date.now()}@example.com`);
  await put(`practiceProfiles/${uid}`, { name: 'Squad Sam', equity: 10000, growthPct: 0, xp: 0, achievements: [] });
  await page.getByLabel('Squad name').fill('Badge Squad');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/social\/\w{12}$/);
  await expect.poll(async () => JSON.stringify((await get(`practiceProfiles/${uid}`))?.achievements ?? null), { timeout: 30_000 }).toContain('squad-up');
  await page.goto('missions');
  await expect(page.getByRole('listitem').filter({ hasText: 'Squad Up' }).getByText('Earned')).toBeVisible();
  if (process.env.E2E_FUNCTIONS === '1') await expect.poll(async () => Number((await get(`users/${uid}`))?.xp?.integerValue ?? 0), { timeout: 30_000 }).toBe(25); // paid once by the server
});
