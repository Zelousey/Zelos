/**
 * Community posts (owner 2026-11-13): a closed Solo trade or a finished battle becomes a card you
 * can post to the community with a short thesis, or send to other apps. The server builds the card
 * from the real record, so the numbers can't be made up. Solo trades and Trade War are separate tabs.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  x === null
    ? { nullValue: null }
    : typeof x === 'string'
      ? { stringValue: x }
      : typeof x === 'boolean'
        ? { booleanValue: x }
        : typeof x === 'number'
          ? Number.isInteger(x)
            ? { integerValue: String(x) }
            : { doubleValue: x }
          : Array.isArray(x)
            ? { arrayValue: { values: x.map(v) } }
            : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
// Trading 101 Chapter 1 passed: battles need it
const passBasics = (uid: string) =>
  fetch(`${BASE}/users/${uid}?updateMask.fieldPaths=learnPassed`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { learnPassed: { mapValue: { fields: { basics: { integerValue: String(Date.now()) } } } } } }) });
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json() as Promise<{ fields?: Record<string, { stringValue?: string }>; error?: unknown }>);
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id);

test('a closed Solo trade: share it with a thesis, see it in the community, delete it', async ({ page }, info) => {
  await page.goto('dashboard');
  const uid = await signIn(page, `post-${info.project.name}-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  // a trade the server closed earlier (as practice.py records it)
  await put(`practiceAccounts/${uid}/history/trade0001`, { kind: 'trade', sym: 'AAPL', qty: 10, entry: 318.4, exit: 333.63, pnl: 152.3, pct: 4.78, openDay: '2026-11-02', closeDay: '2026-11-12', at: Date.now() - 60_000 });
  await page.reload();
  await page.getByText('Activity & account settings').click();
  await page.getByRole('button', { name: 'Share your AAPL trade' }).click();
  const sheet = page.getByRole('dialog', { name: 'Share your trade' });
  await expect(sheet).toContainText('+$152.30');
  await expect(sheet).toContainText('+4.78%');
  await expect(sheet).toContainText('Buy 10 @ $318.40 · Sell @ $333.63');
  await expect(sheet).toContainText('Put in $3,184.00');
  await expect(sheet.getByRole('button', { name: 'Download image' })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await sheet.getByLabel(/Your thesis/).fill(`Bought the pullback to the 50-day average, sold into the earnings pop (${info.project.name}).`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/share-${info.project.name}.png` });
  await sheet.getByRole('button', { name: 'Share to community' }).click();
  await expect(sheet.getByRole('link', { name: /See it in the community/ })).toBeVisible();
  const doc = await get(`posts/${uid}_s_trade0001`);
  expect(doc.fields?.thesis?.stringValue).toContain('pullback');
  // the server's card, from the real trade (not from the page)
  expect(JSON.stringify(doc.fields?.card)).toContain('333.63');
  await sheet.getByRole('link', { name: /See it in the community/ }).click();
  await expect(page).toHaveURL(/\/communities\?feed=solo$/);
  const post = page.getByRole('listitem').filter({ hasText: `earnings pop (${info.project.name})` });
  await expect(post).toContainText('AAPL');
  await expect(post).toContainText('+4.78%');
  expect(await axe(page)).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/feed-${info.project.name}.png`, fullPage: true });
  // the Trade War tab is separate
  await page.getByRole('tab', { name: 'Trade War' }).click();
  await expect(page.getByText(`earnings pop (${info.project.name})`)).toHaveCount(0);
  await page.getByRole('tab', { name: 'Solo trades' }).click();
  // once per trade
  await page.goto('dashboard');
  await page.getByText('Activity & account settings').click();
  await page.getByRole('button', { name: 'Share your AAPL trade' }).click();
  await page.getByRole('dialog', { name: 'Share your trade' }).getByRole('button', { name: 'Share to community' }).click();
  await expect(page.getByText(/already shared this one/).first()).toBeVisible();
  // delete it
  await page.goto('communities');
  await page.getByRole('listitem').filter({ hasText: `earnings pop (${info.project.name})` }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete this post?' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(`earnings pop (${info.project.name})`)).toHaveCount(0);
});

test('a finished battle: share your result to the Trade War tab', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('zelosClashOff', '1'));
  await page.goto('battles');
  const uid = await signIn(page, `postb-${info.project.name}-${Date.now()}@example.com`);
  await passBasics(uid);
  const id = 'pb' + Math.random().toString(36).slice(2, 12).padEnd(10, 'x');
  const now = Date.now();
  await put(`tradeWars/${id}`, {
    name: 'Friday Duel', host: uid, hostName: 'Me', buyIn: 500, days: 1, maxPlayers: 2, status: 'ended', players: [uid, 'rivalUid0001'], names: { [uid]: 'Me', rivalUid0001: 'Rex' },
    rules: {}, modes: { bounties: true }, startAt: now - 2 * 86400_000, endAt: now - 86400_000, createdAt: now - 3 * 86400_000, rewardsPaid: true, rewards: [],
    results: [
      { uid, name: 'Me', start: 500, final: 531, pnl: 31, pnlPct: 6.2, trades: 7, out: false, outReason: null, rank: 1 },
      { uid: 'rivalUid0001', name: 'Rex', start: 500, final: 490, pnl: -10, pnlPct: -2, trades: 3, out: false, outReason: null, rank: 2 },
    ],
  });
  await page.goto(`battles/${id}`);
  await expect(page.getByText('You won this battle!')).toBeVisible();
  await page.getByRole('button', { name: 'Share your result' }).click();
  const sheet = page.getByRole('dialog', { name: 'Share your battle' });
  await expect(sheet).toContainText('1st place');
  await expect(sheet).toContainText('+6.20%');
  await sheet.getByLabel(/Your thesis/).fill(`Held NVDA all week and let the bounty come to me (${info.project.name}).`);
  await sheet.getByRole('button', { name: 'Share to community' }).click();
  await expect(sheet.getByRole('link', { name: /See it in the community/ })).toBeVisible();
  await page.goto('communities?feed=battle');
  await expect(page.getByRole('tab', { name: 'Trade War' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('listitem').filter({ hasText: `let the bounty come to me (${info.project.name})` })).toContainText('Friday Duel');
});

test('the share card pops up after a trade closes, and Settings can turn that off', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('shareReset')) {
      localStorage.removeItem('zelosShareAfterTrade');
      sessionStorage.setItem('shareReset', '1');
    }
  });
  await page.goto('dashboard');
  const uid = await signIn(page, `posta-${info.project.name}-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  await page.waitForTimeout(1500);
  // a sale fills on the server: the card comes up by itself
  await put(`practiceAccounts/${uid}/history/trade0003`, { kind: 'trade', sym: 'MSFT', qty: 3, entry: 541.25, exit: 529.3, pnl: -35.85, pct: -2.21, openDay: '2026-11-05', closeDay: '2026-11-12', at: Date.now() });
  const sheet = page.getByRole('dialog', { name: 'Share your trade' });
  await expect(sheet).toContainText('MSFT');
  await expect(sheet).toContainText('−$35.85');
  await sheet.getByRole('button', { name: 'Close' }).click();
  // Settings: on by default; off means no card next time
  await page.goto('settings');
  const sw = page.getByRole('switch', { name: 'Share card after every trade' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await page.goto('dashboard');
  await page.waitForTimeout(1500);
  await put(`practiceAccounts/${uid}/history/trade0004`, { kind: 'trade', sym: 'AMD', qty: 2, entry: 610, exit: 649.42, pnl: 78.84, pct: 6.46, openDay: '2026-11-05', closeDay: '2026-11-12', at: Date.now() });
  await page.waitForTimeout(2500);
  await expect(page.getByRole('dialog', { name: 'Share your trade' })).toHaveCount(0);
});
