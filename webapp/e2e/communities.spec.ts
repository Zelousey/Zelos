/**
 * Communities (Founder Program) in the app, through the Functions emulator: the hub
 * (milestones, trending, biggest, by state), creating a community (verified accounts only),
 * and joining / leaving another one.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });
test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? { integerValue: String(x) } : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
const verify = (uid: string) =>
  fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-zelos/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
const isoWeek = () => {
  const d = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `w${y}${String(w).padStart(2, '0')}`;
};
const player = async (browser: Browser, info: TestInfo) => (await browser.newContext(info.project.use)).newPage();

test('communities: hub, create (verified only), join and leave', async ({ page, browser }, info) => {
  const tag = `${info.project.name}${Date.now()}`.toLowerCase();
  const cid = `rats-${tag}-tx`;
  await put(`communities/${cid}`, { name: `Rats ${tag}`, state: 'TX', slug: cid, founder: 'cmFounderUid01', founderName: 'Rita', members: 2, counted: 6, xp: 900, tier: 1, title: 'Founder', rewarded: [5], weeks: { [isoWeek()]: 3 }, createdAt: Date.now(), lastJoinAt: Date.now() });
  await put(`communities/${cid}/members/cmFounderUid01`, { name: 'Rita', joinedAt: 1, xp: 600, counted: false, founder: true });
  await put(`communities/${cid}/members/cmMemberUid001`, { name: 'Max', joinedAt: 2, xp: 300, counted: true, founder: false });

  await page.goto('communities');
  await expect(page.getByRole('list', { name: 'Founder milestones' })).toContainText('Legendary Founder');
  const card = page.getByRole('link', { name: new RegExp(`Rats ${tag}`) });
  await expect(card.first()).toBeVisible();
  await expect(page.getByText('+3 joined this week').first()).toBeVisible();
  await page.getByLabel('State').last().selectOption('TX');
  await expect(page.getByRole('link', { name: new RegExp(`Rats ${tag}`) })).toHaveCount(3); // trending, biggest, Texas

  // an unverified account can't start one: the server says why
  const uid = await signIn(page, `cm-${tag}@example.com`);
  await page.getByLabel('Community name').fill(`Clan ${tag.slice(-6)}`);
  await page.getByLabel('State').first().selectOption('CT');
  await page.getByRole('button', { name: 'Create community' }).click();
  await expect(page.getByRole('alert')).toHaveText('Verify your email (or sign in with Google) to start a community.');
  expect(await axe(page)).toEqual([]);

  // verified (a fresh sign-in picks up the verified email): create it and land on its page
  await verify(uid);
  await page.reload();
  await signIn(page, `cm-${tag}@example.com`);
  await page.getByLabel('Community name').fill(`Clan ${tag.slice(-6)}`);
  await page.getByLabel('State').first().selectOption('CT');
  await page.getByRole('button', { name: 'Create community' }).click();
  await expect(page).toHaveURL(/\/communities\/clan-[a-z0-9-]+-ct$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: `Clan ${tag.slice(-6)}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share invite link' })).toBeVisible();
  await expect(page.getByText('5 more real members to Founder (+250 tokens).')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // another verified player joins the seeded community, then leaves it
  const p2 = await player(browser, info);
  await p2.goto(`communities/${cid}`);
  const uid2 = await signIn(p2, `cm2-${tag}@example.com`);
  await verify(uid2);
  await p2.reload();
  await signIn(p2, `cm2-${tag}@example.com`);
  await expect(p2.getByRole('list').filter({ hasText: 'Rita' })).toContainText('Max');
  await p2.getByRole('button', { name: 'Join this community' }).click();
  await expect(p2.getByRole('button', { name: 'Share invite link' })).toBeVisible({ timeout: 30_000 });
  await expect(p2.getByRole('link', { name: 'Rita' })).toBeVisible();
  await p2.getByRole('button', { name: 'Leave' }).click();
  await p2.getByRole('dialog').getByRole('button', { name: 'Leave' }).click();
  await expect(p2.getByRole('button', { name: 'Join this community' })).toBeVisible({ timeout: 30_000 });
  await p2.context().close();
});
