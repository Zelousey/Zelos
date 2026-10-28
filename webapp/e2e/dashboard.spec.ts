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

const pages = (page: Page) => page.getByRole('navigation', { name: 'Dashboard pages' });
const openPage = async (page: Page, name: string) => {
  await pages(page).getByRole('link', { name, exact: true }).click();
  await expect(pages(page).getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
};

test('signed out: welcome on Trading; missions and the public leaderboard on Profile; the market on Market', async ({ page }) => {
  await page.goto('dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome to Zelos Trade War' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to start' })).toBeVisible();
  await expect(page.getByText(/Challenge friends to a Trade War/)).toBeVisible();
  await openPage(page, 'Profile');
  await expect(page).toHaveURL(/\/dashboard\?p=profile$/);
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
  await put(`practiceAccounts/${uid}`, { v: 3, cash: 9000, positions: { AAPL: { qty: 5, avg: 200, openedDay: '2026-10-01' } }, orders: {}, realized: 0, resets: 0, resetHistory: [], peak: 10500, stats: { trades: 3, wins: 2, losses: 1 } });
  await put(`practiceProfiles/${uid}`, { name: 'Casey', equity: 11000, growthPct: 10, level: 3, achievements: ['centurion'], source: 'server' });
  await put(`tradeWars/war-${uid.slice(0, 8)}`, { name: 'Friday Showdown', status: 'active', players: [uid, 'topA'], maxPlayers: 4, createdAt: now, endAt: now + 5 * 36e5 });

  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeAttached();
  await expect(page.getByText('Welcome back, Casey')).toBeAttached();
  // Trading: the account first (owner 2026-10-20), every list says it's Solo (S1, M2)
  const acct = page.getByRole('region', { name: 'Solo · Your practice account' });
  await expect(acct).toBeVisible();
  await expect(acct.getByRole('link', { name: 'AAPL', exact: true }).filter({ visible: true })).toBeVisible();
  await expect(acct.getByText('No open orders.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solo · Positions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Battle · Your battles' })).toBeVisible();
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
  await expect(card).toContainText('2/29'); // first-trade (progress) + centurion (public profile)
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

test('pages: arrow keys move along the row; a reload keeps the page', async ({ page }) => {
  await page.goto('dashboard');
  await pages(page).getByRole('link', { name: 'Trading', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\?p=profile$/);
  await expect(pages(page).getByRole('link', { name: 'Profile', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\?p=market$/);
  await page.reload();
  await expect(pages(page).getByRole('link', { name: 'Market', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'US indexes' })).toBeVisible();
  await page.keyboard.press('Tab'); // nothing breaks at the end of the row
});

test('phone swipe: sideways changes page, a scroll or a swipe on the chart does not', async ({ page }) => {
  test.skip(!test.info().project.use.isMobile, 'touch screens only');
  await page.goto('dashboard?p=profile');
  await expect(page.getByRole('heading', { name: 'Daily missions' })).toBeVisible();
  const swipe = (x0: number, x1: number, y0 = 420, y1 = 420) =>
    page.evaluate(
      ([x0, x1, y0, y1]) => {
        const target = document.elementFromPoint(x0, y0) ?? document.body;
        const ev = (type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
        ev('pointerdown', x0, y0);
        ev('pointerup', x1, y1);
      },
      [x0, x1, y0, y1],
    );
  await swipe(300, 120); // finger left → next page
  await expect(page).toHaveURL(/\?p=market$/);
  await swipe(120, 300); // finger right → back
  await expect(page).toHaveURL(/\?p=profile$/);
  await swipe(300, 260, 420, 600); // mostly down: a scroll
  await swipe(8, 200); // from the edge: the phone's back gesture
  await expect(page).toHaveURL(/\?p=profile$/);
});

test('missions are counted by the server: three charts in the app complete "Analyze 3 stocks"', async ({ page }, info) => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
  await page.goto('dashboard');
  await signIn(page, `missions-${info.project.name}-${Date.now()}`);
  for (const sym of ['AAPL', 'MSFT', 'NVDA']) {
    // each chart reports "analyze" to the server; wait for it before the next full page load
    const reported = page.waitForResponse((r) => r.url().includes('/mission_event') && r.request().method() === 'POST', { timeout: 30_000 });
    await page.goto(`markets/${sym}`);
    await expect(page.getByRole('heading', { level: 1, name: sym })).toBeVisible();
    await reported;
  }
  await page.goto('dashboard?p=profile');
  const missions = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Daily missions' }) });
  await expect(missions.getByLabel('3 of 3, done')).toBeVisible({ timeout: 15_000 });
  await expect(missions.getByText('Missions count on the website for now.')).toHaveCount(0);
});
