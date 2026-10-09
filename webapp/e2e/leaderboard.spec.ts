/**
 * Leaderboard in the app: all-time by account value, weekly/monthly/season boards from the
 * server's period numbers (practiceProfiles.p), your place, and the Friends board.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { monthKey, nyToday, seasonFor, weekKey } from '../src/features/leaderboard/periods';

test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const day = nyToday();
const W = weekKey(day), M = monthKey(day), S = seasonFor(day)?.id ?? 's1';
const prof = (name: string, equity: number, weekPct: number, extra: Record<string, unknown> = {}) => ({
  name, equity, growthPct: (equity / 10000 - 1) * 100, xp: 200, trades: 12, tradeStreak: 3,
  p: { [W]: { pct: weekPct, pnl: weekPct * 100 }, [M]: { pct: weekPct + 1, pnl: 500 }, [S]: { pct: weekPct + 2, pnl: 700, bestWin: 900 - equity / 100, xp: 150, winStreak: 4 } },
  ...extra,
});

test.beforeAll(async () => {
  await put('practiceProfiles/lbAlphaUser01', prof('Lb Alpha', 25000, 1.5));
  await put('practiceProfiles/lbBravoUser02', prof('Lb Bravo', 15000, 9.5));
  await put('practiceProfiles/lbCharlieUs03', prof('Lb Charlie', 9000, -2));
});

test('all-time, weekly and season boards', async ({ page }) => {
  await page.goto('leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard', level: 1 })).toBeVisible();
  const rows = page.getByRole('listitem');
  const names = async () => (await rows.allInnerTexts()).map((t) => t.match(/Lb \w+/)?.[0]).filter(Boolean);
  await expect(page.getByText('$25,000')).toBeVisible();
  expect((await names()).slice(0, 3)).toEqual(['Lb Alpha', 'Lb Bravo', 'Lb Charlie']);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await page.getByRole('tab', { name: 'Weekly' }).click();
  await expect(page.getByText('+9.5%').first()).toBeVisible();
  expect((await names()).slice(0, 3)).toEqual(['Lb Bravo', 'Lb Alpha', 'Lb Charlie']);
  await page.getByRole('tab', { name: /Season/ }).click();
  await page.getByRole('tab', { name: 'Biggest single win' }).click();
  await expect(page).toHaveURL(/b=season&c=bestWin/);
  expect((await names()).slice(0, 3)).toEqual(['Lb Charlie', 'Lb Bravo', 'Lb Alpha']); // 810 > 750 > 650
  // the Trade War hub links here
  await page.goto('trade-war');
  await page.getByRole('link', { name: /Leaderboards/ }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
});

test('your place and the Friends board', async ({ page }, info) => {
  await page.goto('leaderboard');
  const uid = await signIn(page, `lb-${info.project.name}${Date.now()}@example.com`);
  await put(`practiceProfiles/${uid}`, prof('Me Myself', 12000, 3));
  await page.reload();
  await expect(page.getByText(/You’re #\d+/)).toBeVisible();
  await expect(page.locator('li').filter({ hasText: 'Me Myself' }).getByText('you', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Friends' }).click();
  await expect(page.getByText('Add friends or join a squad')).toBeVisible();
  await put(`users/${uid}`, { friends: ['lbBravoUser02'] });
  await page.reload();
  const items = page.getByRole('listitem');
  await expect(items.filter({ hasText: 'Lb Bravo' })).toBeVisible();
  await expect(items.filter({ hasText: 'Lb Alpha' })).toHaveCount(0); // not a friend
});
