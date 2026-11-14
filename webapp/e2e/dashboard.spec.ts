/**
 * The Trade War dashboard against the Firestore emulator: the signed-out welcome with the
 * public leaderboard, and a signed-in player whose server-written data (XP, practice
 * account, public profile, a Trade War) and mission progress are seeded through the
 * emulator's admin REST API (fake demo-zelos project only).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type V = Record<string, unknown>;
function enc(v: unknown): V {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, enc(x)])) } };
}
async function put(path: string, data: Record<string, unknown>) {
  const r = await fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }) });
  if (!r.ok) throw new Error(`seed ${path}: ${r.status} ${await r.text()}`);
}
async function signIn(page: Page, who: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((email) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(email, 'secret123').then((c) => c.user.uid), `${who}@example.com`);
}
const nyDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

test.beforeAll(async () => {
  // two public leaderboard entries way above anyone the tests create
  await put('practiceProfiles/topA', { name: 'Ada', equity: 91000, growthPct: 810, level: 6, source: 'server' });
  await put('practiceProfiles/topB', { name: 'Bo', equity: 52000, growthPct: 420, level: 4, source: 'server' });
});

// the page row is gone (owner 2026-11-14); ?p= still opens the older panels for saved links
const openPage = (page: Page, name: string) => page.goto(`dashboard?p=${name.toLowerCase()}`);

test('signed out: welcome on Trading; missions and the public leaderboard on Profile; the market on Market', async ({ page }) => {
  await page.goto('dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome to Zelos Trade War' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to start' })).toBeVisible();
  await expect(page.getByText(/Challenge friends to a Trade War/)).toBeVisible();
  await openPage(page, 'Profile');
  await expect(page.getByRole('heading', { name: 'Daily missions' })).toBeVisible();
  await expect(page.getByText('Make 1 Trade War trade')).toBeVisible();
  const board = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Leaderboard' }) });
  await expect(board.getByRole('listitem').first()).toContainText('Ada');
  await expect(board.getByRole('listitem').first()).toContainText('$91,000');
  await openPage(page, 'Market');
  await expect(page.getByRole('heading', { name: 'US indexes' })).toBeVisible(); // chart first
  await page.getByRole('tab', { name: 'Globe' }).click();
  await expect(page.getByRole('heading', { name: 'World markets' })).toBeVisible();
  await expect(page.getByText(/exchanges open|All major exchanges are closed/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /S&P 500 \(SPY\)/ })).toBeVisible();
  await openPage(page, 'Strategies');
  await expect(page.getByRole('link', { name: 'Open alerts →' })).toHaveAttribute('href', '/app/alerts');
  await page.getByRole('button', { name: '← Back to Trading' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('signed in: the Solo account and battles on Trading; trader card, missions and rank on Profile', async ({ page }, info) => {
  await page.goto('dashboard');
  const uid = await signIn(page, `dash-${info.project.name}-${Date.now()}`);
  const now = Date.now();
  await put(`users/${uid}`, {
    xp: 275,
    watchlist: ['AAPL', 'NVDA'],
    progress: { v: 1, updatedAt: now, day: { date: nyDay(), counts: { trade: 1, analyze: 2 }, analyzed: [], done: { trade: true } }, week: { key: '', counts: {}, done: {} }, streak: { days: 4, best: 6, lastDate: nyDay(-1), start: '' }, totals: {}, achievements: { 'first-trade': now } },
  });
  await put(`traders/${uid}`, { name: 'Casey', username: 'casey_t' });
  await put('markets/earnings', { updatedAt: new Date().toISOString(), bySymbol: { NVDA: { date: nyDay(3), eps: 1.21 }, AAPL: { date: nyDay(9), eps: 2.4 }, MSFT: { date: nyDay(1), eps: 3.1 } } });
  await put(`practiceAccounts/${uid}`, { v: 3, cash: 9000, positions: { AAPL: { qty: 5, avg: 200, openedDay: '2026-10-01' } }, orders: {}, realized: 0, resets: 0, resetHistory: [], peak: 10500, stats: { trades: 3, wins: 2, losses: 1 } });
  await put(`practiceProfiles/${uid}`, { name: 'Casey', equity: 11000, growthPct: 10, level: 3, achievements: ['centurion'], source: 'server' });
  await put(`tradeWars/war-${uid.slice(0, 8)}`, { name: 'Friday Showdown', status: 'active', players: [uid, 'topA'], maxPlayers: 4, createdAt: now, endAt: now + 5 * 36e5 });

  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeAttached();
  await expect(page.getByText('Welcome back, Casey')).toBeAttached();
  // Trading: the account first (owner 2026-10-20), every list says it's Solo (S1, M2)
  const acct = page.getByRole('region', { name: 'Solo · Your practice account' });
  await expect(acct).toBeVisible();
  await expect(acct.getByRole('link', { name: 'AAPL', exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solo · Positions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Battle · Your battles' })).toBeVisible();
  // no pending orders: two small cards cycle through today's market movers instead (owner 2026-11-15),
  // labelled as the market, not your account
  await expect(page.getByRole('heading', { name: 'Solo · Pending orders' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Market · top gainers today: / })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Market · top losers today: / })).toBeVisible();
  // your own top gainers and losers today (green and red cards), then the positions, then Battle
  const gain = page.getByRole('region', { name: 'Your top gainers' });
  await expect(gain).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your top losers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What’s moving your account' })).toHaveCount(0);
  const earn = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Upcoming earnings' }) });
  await expect(earn).toContainText('Your stocks reporting soon');
  await expect(earn.getByRole('link').first()).toContainText('NVDA');
  await expect(page.getByText('Today’s line follows your trades', { exact: false })).toHaveCount(0);
  if (info.project.name === 'phone') {
    const [gainBox, posBox, battleBox] = await Promise.all([gain.boundingBox(), page.getByRole('heading', { name: 'Solo · Positions' }).boundingBox(), page.getByRole('heading', { name: 'Battle · Your battles' }).boundingBox()]);
    expect(gainBox!.y).toBeLessThan(posBox!.y);
    expect(posBox!.y).toBeLessThan(battleBox!.y);
  }
  // a gainer opens its detail: your effect today, open P&L, earnings and filings
  if (await gain.getByRole('button').count()) {
    await gain.getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toContainText('since you opened it');
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('link', { name: /Friday Showdown/ })).toContainText(/Live · [56]h left/);
  await page.waitForTimeout(600);
  const axe = async () => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(await axe()).toEqual([]);

  await openPage(page, 'Profile');
  const card = page.getByRole('region', { name: 'Your trader card' });
  await expect(card).toContainText('Level 3 · Risk Manager');
  await expect(card).toContainText('275 XP');
  await expect(card).toContainText('125 XP to Platinum');
  await expect(card).toContainText('🔥 4');
  await expect(card).toContainText('2/42'); // first-trade (progress) + centurion (public profile)
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  const missions = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Daily missions' }) });
  await expect(missions.getByLabel('1 of 1, done')).toBeVisible();
  await expect(missions.getByLabel('2 of 3')).toBeVisible();
  // rank comes from a count query: two seeded accounts are worth more
  await expect(page.getByText(/You’re #\d+ overall/)).toBeVisible();
  await page.waitForTimeout(600);
  expect(await axe()).toEqual([]);

  await openPage(page, 'Market');
  await expect(page.getByRole('heading', { name: 'Watchlist' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the top is one small line; on a phone a pull-down opens the sections as app icons', async ({ page }, info) => {
  await page.goto('dashboard');
  await expect(page.getByRole('navigation', { name: 'Dashboard pages' })).toHaveCount(0);
  await expect(page.getByText('Virtual money').first()).toBeVisible();
  const handle = page.getByRole('button', { name: 'Show all sections' });
  if (info.project.name !== 'phone') {
    await expect(handle).toHaveCount(0); // a computer has the sidebar
    return;
  }
  const apps = page.getByRole('navigation', { name: 'Zelos sections' });
  await expect(apps).toBeHidden();
  await handle.click();
  await expect(apps).toBeVisible();
  for (const name of ['Trade War', 'Strategies', 'Leaderboard', 'Training Ground', 'Hall of Minds', 'Profile']) await expect(apps.getByRole('link', { name })).toBeVisible();
  await page.getByRole('button', { name: 'Hide sections' }).click();
  await expect(apps).toBeHidden();
  // a swipe down from the top of the page opens it too (owner 2026-11-15), and Android's
  // pull-to-refresh is off on the Dashboard so the swipe isn't a reload
  await expect(apps).toBeHidden();
  await page.evaluate(() => {
    const t = (y: number) => new Touch({ identifier: 1, target: document.body, clientX: 180, clientY: y });
    window.dispatchEvent(new TouchEvent('touchstart', { touches: [t(120)] }));
    window.dispatchEvent(new TouchEvent('touchmove', { touches: [t(260)] }));
    window.dispatchEvent(new TouchEvent('touchend', { touches: [] }));
  });
  await expect(apps).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overscrollBehaviorY)).toBe('contain');
  await page.getByRole('button', { name: 'Hide sections' }).click();
  await expect(apps).toBeHidden();
  // pulling the handle down opens it too
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 120, { steps: 5 });
  await page.mouse.up();
  await expect(apps).toBeVisible();
  await apps.getByRole('link', { name: 'Strategies' }).click();
  await expect(page).toHaveURL(/\/strategies$/);
});
