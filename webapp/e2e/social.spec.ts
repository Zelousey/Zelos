/**
 * Squads & friends in the app: create a squad, room code, competition, goal and chat as the
 * owner; a second trader joins with the room code and sees the chat; add and remove a friend
 * by @username; the owner deletes the squad.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 150_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
const exists = async (path: string) => (await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } })).ok;
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

test('a squad: create, room code, competition, goal, chat; a friend joins with the code; delete', async ({ page }, info) => {
  const tag = `${info.project.name}${Date.now()}`;
  await page.goto('social');
  await expect(page.getByText('Sign in to make or join a squad')).toBeVisible();
  const owner = await signIn(page, `sqowner-${tag}@example.com`);
  await put(`practiceProfiles/${owner}`, { name: 'Owner Olly', equity: 10800, netPnl: 800, growthPct: 8, xp: 120 });

  await page.getByLabel('Squad name').fill('E2E Squad');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/social\/[A-Za-z0-9]{12}$/);
  const squadId = page.url().split('/').pop()!;
  await expect(page.getByRole('heading', { name: /E2E Squad/, level: 1 })).toBeVisible();
  const board = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Squad leaderboard' }) });
  await expect(board.getByText('Owner Olly')).toBeVisible();
  await expect(board.getByText('+8.00%')).toBeVisible();

  // owner controls
  await page.getByRole('button', { name: 'Make a room code' }).click();
  const codeEl = page.locator('b').filter({ hasText: /^[A-HJ-NP-Z2-9]{6}$/ }).first();
  await expect(codeEl).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
  const code = (await codeEl.textContent())!;
  await page.getByRole('button', { name: 'Start a 7-day competition' }).click();
  await expect(page.getByRole('tab', { name: 'Competition' })).toBeVisible();
  await page.getByLabel('Goal name').fill('Green week');
  await page.getByRole('button', { name: 'Set goal' }).click();
  await expect(page.getByRole('heading', { name: 'Green week' })).toBeVisible();

  // chat
  await page.getByLabel('Message', { exact: true }).fill('Hello squad');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const log = page.getByRole('log', { name: 'Squad chat' });
  await expect(log.getByText('Hello squad')).toBeVisible();
  await log.getByRole('button', { name: 'Fire' }).click();
  await expect(log.getByRole('button', { name: 'Fire (1)' })).toHaveAttribute('aria-pressed', 'true');
  await axe(page);

  // a second trader joins with the room code
  const friend = await signIn(page, `sqfriend-${tag}@example.com`);
  await put(`practiceProfiles/${friend}`, { name: 'Friend Fran', equity: 9500, netPnl: -500, growthPct: -5, xp: 40 });
  await page.goto('social');
  await page.getByLabel('Room code').fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Find squad' }).click();
  await expect(page).toHaveURL(new RegExp(`/social/${squadId}$`));
  await page.getByRole('button', { name: 'Join E2E Squad' }).click();
  await expect(page.getByRole('log', { name: 'Squad chat' }).getByText('Hello squad')).toBeVisible({ timeout: 20_000 });
  await expect(board.getByText('Friend Fran')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave squad' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make a room code' })).toHaveCount(0); // not the owner

  // back to the owner: delete the squad
  await signIn(page, `sqowner-${tag}@example.com`);
  await page.reload();
  await page.getByRole('button', { name: 'Delete squad…' }).click();
  const dlg = page.getByRole('dialog', { name: 'Delete E2E Squad?' });
  await dlg.getByLabel('Squad name').fill('E2E Squad');
  await dlg.getByRole('button', { name: 'Delete squad' }).click();
  await expect(page).toHaveURL(/\/social$/);
  await expect.poll(() => exists(`squads/${squadId}`)).toBe(false);
  expect(await exists(`squadCodes/${code}`)).toBe(false);
});

test('friends: add by @username, see their stats, remove', async ({ page }, info) => {
  const F = 'sqBuddyTrader01';
  const handle = `buddy_${info.project.name}`.slice(0, 20);
  await put(`usernames/${handle}`, { uid: F });
  await put(`practiceProfiles/${F}`, { name: 'Buddy Bea', username: handle, equity: 12345, growthPct: 23.46, xp: 160 });
  await page.goto('social?tab=friends');
  await signIn(page, `sqbuddy-${info.project.name}${Date.now()}@example.com`);
  await page.getByLabel('Their @username').fill(handle);
  await page.getByRole('button', { name: 'Add friend' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Buddy Bea' });
  await expect(row).toContainText('$12,345');
  await expect(row).toContainText('+23.5%');
  await axe(page);
  await row.getByRole('button', { name: 'Remove Buddy Bea from your friends' }).click();
  await expect(page.getByText('No friends yet.')).toBeVisible();
  await page.getByLabel('Their @username').fill('nobody_here_x');
  await page.getByRole('button', { name: 'Add friend' }).click();
  await expect(page.getByText('No trader has the username @nobody_here_x yet.')).toBeVisible();
});
