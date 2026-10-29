/**
 * Invites end to end in the browser against the real Python functions on the emulators:
 * a host makes a "join Zelos" link and a Battle link, sends one to a username, and a new
 * player opens the link signed out, signs in, accepts, sees the celebration and +50 XP;
 * the bell shows Accept for invites. Skipped when functions/venv is missing.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const put = (path: string, fields: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
// Trading 101 Chapter 1 passed: battles need it (written by learn_quiz in real life)
const passBasics = (uid: string) =>
  fetch(`${BASE}/users/${uid}?updateMask.fieldPaths=learnPassed`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { learnPassed: { mapValue: { fields: { basics: { integerValue: String(Date.now()) } } } } } }) });
// each player gets their own browser context (own sign-in), at this project's screen size
const player = async (browser: Browser, info: TestInfo) => (await browser.newContext(info.project.use)).newPage();
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

test('make a battle invite, open it as a new player, accept with a celebration', async ({ browser }, info) => {
  const id = `${info.project.name}${Date.now()}`;
  // host
  const host = await player(browser, info);
  await host.goto('invite');
  await expect(host.getByText('Sign in to invite friends.')).toBeVisible();
  const hostUid = await signIn(host, `host-${id}@example.com`);
  await put(`traders/${hostUid}`, { name: { stringValue: 'Ada' } });
  await passBasics(hostUid);
  await host.getByRole('button', { name: /^Battle/ }).click();
  await host.getByLabel('Battle name').fill('Friday Showdown');
  await host.getByText('$500', { exact: true }).click();
  await host.getByRole('button', { name: 'Create battle and get the link' }).click();
  await expect(host.getByRole('heading', { name: 'Your invite is ready' })).toBeVisible();
  const url = await host.getByLabel('Invite link').inputValue();
  expect(url).toMatch(/^https:\/\/agentictrading\.info\/app\/i\/[A-Za-z0-9]{10}$/);
  const code = url.split('/').pop()!;
  const r = await new AxeBuilder({ page: host }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);

  // a new player opens the link signed out
  const guest = await player(browser, info);
  await guest.goto(`i/${code}`);
  await expect(guest.getByRole('heading', { name: /Ada invited you\s*to a Trade War/ })).toBeVisible();
  await expect(guest.getByText(/Friday Showdown · \$500 virtual buy-in · 3 days/)).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Sign in to accept' })).toBeVisible();
  const guestUid = await signIn(guest, `guest-${id}@example.com`);
  // a brand-new player passes Trading 101 Chapter 1 first, then comes back to the invite
  await expect(guest.getByText('Battles unlock after Chapter 1')).toBeVisible();
  await expect(guest.getByRole('link', { name: 'Take the quiz' })).toHaveAttribute('href', `/app/learn/basics/quiz?next=%2Fi%2F${code}`);
  await passBasics(guestUid);
  await guest.getByRole('button', { name: 'Accept' }).click();
  await expect(guest.getByRole('status').filter({ hasText: 'You’re in the battle!' })).toBeVisible();
  await expect(guest.getByText('+50 XP for joining from an invite')).toBeVisible();
  await expect(guest.getByRole('link', { name: 'Go to the battle room' })).toHaveAttribute('href', /\/battles\/[A-Za-z0-9]{12}$/);

  // the host's bell says so
  await host.goto('dashboard');
  await host.getByRole('button', { name: /Open notifications/ }).filter({ visible: true }).first().click();
  await expect(host.getByText(/joined Zelos from your invite/)).toBeVisible();
  await guest.context().close();
  await host.context().close();
});

test('invite a friend by username: Accept right in their bell', async ({ browser }, info) => {
  const id = `${info.project.name}${Date.now()}`;
  const friend = await player(browser, info);
  await friend.goto('news'); // not the Dashboard: it sends a new user to /welcome, which can cut the sign-in call short
  const friendUid = await signIn(friend, `friend-${id}@example.com`);
  const uname = `fr_${id.slice(-12)}`.toLowerCase();
  await put(`usernames/${uname}`, { uid: { stringValue: friendUid } });

  const host = await player(browser, info);
  await host.goto('invite');
  await signIn(host, `host2-${id}@example.com`);
  await host.getByRole('button', { name: /^Invite a friend/ }).click();
  await expect(host.getByRole('heading', { name: 'Your invite is ready' })).toBeVisible();
  await host.getByLabel('Or send it to a Zelos user').fill('@' + uname);
  await host.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(host.getByRole('status').filter({ hasText: `Sent to @${uname}` })).toBeVisible();
  // coach stays locked below Level 3
  await host.getByRole('button', { name: 'Make another invite' }).click();
  await expect(host.getByRole('button', { name: /^Coach/ })).toBeDisabled();

  await friend.getByRole('button', { name: /Open notifications/ }).filter({ visible: true }).first().click();
  const dialog = friend.getByRole('dialog', { name: 'Notifications' });
  await expect(dialog.getByText(/invited you to Zelos Trade War/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Accept' }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Accepted' })).toBeVisible();
  await friend.context().close();
  await host.context().close();
});

test('a broken invite link explains itself', async ({ page }) => {
  await page.goto('i/Nope000000');
  await expect(page.getByText('This invite link doesn’t exist')).toBeVisible();
  await page.goto('i/bad');
  await expect(page.getByText('This invite link doesn’t exist')).toBeVisible();
});

test('invitation cards in the bell: each kind shows who, what and its own actions (N-R2)', async ({ page }, info) => {
  await page.goto('dashboard');
  const uid = await signIn(page, `cards-${info.project.name}${Date.now()}@example.com`);
  const s = (v: string) => ({ stringValue: v });
  const n = (v: number) => ({ integerValue: String(v) });
  const now = Date.now();
  const code = (k: string) => `${k}${info.project.name === 'phone' ? 'P' : 'D'}${String(now).slice(-6)}`.slice(0, 10).padEnd(10, 'x');
  const base = { from: s('hostUid000001'), fromName: s('Ada'), fromUsername: s('ada_trades'), status: s('open'), uses: n(0), createdAt: n(now), expiresAt: n(now + 864e5) };
  const invites = {
    battle: { ...base, kind: s('battle'), warId: s('abcdefghijkm'), warName: s('Friday fight'), buyIn: n(500), days: n(3) },
    squad: { ...base, kind: s('squad'), squadId: s('squadid0001'), squadName: s('Desk Ten') },
    coach: { ...base, kind: s('coach') },
  };
  const codes: Record<string, string> = {};
  let i = 0;
  for (const [k, fields] of Object.entries(invites)) {
    codes[k] = code(k.slice(0, 2));
    await put(`invites/${codes[k]}`, fields);
    await put(`users/${uid}/inbox/inv${k}`, { kind: s('friends'), title: s(`Ada invited you (${k})`), body: s(''), at: n(now - ++i * 1000), read: { booleanValue: false }, action: { mapValue: { fields: { type: s('invite'), code: s(codes[k]), kind: s(k) } } } });
  }
  const ch = `ch${String(now).slice(-8)}`;
  const war = `w${info.project.name === 'phone' ? 'P' : 'D'}${String(now).slice(-10)}`;
  await put(`tradeWars/${war}`, { name: s('Night fight'), host: s('hostUid000001'), status: s('lobby'), players: { arrayValue: { values: [s('hostUid000001')] } }, invited: { arrayValue: { values: [s(uid)] } }, buyIn: n(1000), days: n(1), maxPlayers: n(2) });
  await put(`twInvites/${ch}`, { to: s(uid), from: s('hostUid000001'), fromName: s('Rex'), fromUsername: s('rex_wins'), warId: s(war), warName: s('Night fight'), buyIn: n(1000), days: n(1), mode: s('duel'), status: s('pending'), createdAt: n(now) });
  await put(`users/${uid}/inbox/chal`, { kind: s('challenges'), title: s('Rex challenged you to a Trade War'), body: s(''), at: n(now), read: { booleanValue: false }, action: { mapValue: { fields: { type: s('tw'), id: s(ch) } } } });

  await page.getByRole('button', { name: /Open notifications/ }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Notifications' });
  const card = (label: string) => dialog.locator('li').filter({ hasText: label });
  // a battle invite: who, the battle, Join the battle
  await expect(card('Battle invite')).toContainText('From Ada @ada_trades');
  await expect(card('Battle invite')).toContainText('Friday fight · $500 virtual buy-in · 3 days');
  await expect(card('Battle invite').getByRole('button', { name: 'Join the battle' })).toBeVisible();
  await expect(card('Battle invite').getByRole('link', { name: 'See details' })).toHaveAttribute('href', `/app/i/${codes.battle}`);
  // team-up: the squad, Join the squad
  await expect(card('Team-up invite')).toContainText('Desk Ten');
  await expect(card('Team-up invite').getByRole('button', { name: 'Join the squad' })).toBeVisible();
  // coaching: what the coach sees, Start coaching
  await expect(card('Coaching offer')).toContainText('Your coach will see your level');
  await expect(card('Coaching offer').getByRole('button', { name: 'Start coaching' })).toBeVisible();
  // a challenge: Accept or Decline
  const c = card('Battle challenge');
  await expect(c).toContainText('From Rex @rex_wins');
  await expect(c).toContainText('Night fight · $1,000 virtual buy-in · 1 day');
  expect(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/cards-${info.project.name}.png` });
  await c.getByRole('button', { name: 'Decline' }).click();
  await expect(c.getByRole('status')).toHaveText('Declined');
  await expect(c.getByRole('button', { name: 'Accept' })).toHaveCount(0);
});
