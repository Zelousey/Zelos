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
  await signIn(guest, `guest-${id}@example.com`);
  await guest.getByRole('button', { name: 'Accept' }).click();
  await expect(guest.getByRole('status').filter({ hasText: 'You’re in the battle!' })).toBeVisible();
  await expect(guest.getByText('+50 XP for joining from an invite')).toBeVisible();
  await expect(guest.getByRole('link', { name: 'Go to the battle room' })).toHaveAttribute('href', /practice\/war\.html\?w=[A-Za-z0-9]{12}$/);

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
  await friend.goto('dashboard');
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
