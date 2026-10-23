/**
 * Profile in the app: someone else's profile (Trade War numbers, record, looks, achievements),
 * adding a friend and challenging them, and setting up your own (name, @username, bio,
 * picture). Reached from the leaderboard.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  x === null ? { nullValue: null } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
const get = async (path: string) => {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? ((await r.json()) as { fields?: Record<string, Record<string, unknown>> }).fields ?? {} : null;
};
// Trading 101 Chapter 1 passed: battles need it (written by learn_quiz in real life)
const passBasics = (uid: string) =>
  fetch(`${BASE}/users/${uid}?updateMask.fieldPaths=learnPassed`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { learnPassed: { mapValue: { fields: { basics: { integerValue: String(Date.now()) } } } } } }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

const OTHER = 'pfOtherTrader01';
// a 4x4 red PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8CAB+GTG8HSALfKY52fTcuYAAAAAElFTkSuQmCC', 'base64');

test.beforeAll(async () => {
  await put(`practiceProfiles/${OTHER}`, {
    name: 'Rival Rita', username: 'rival_rita', equity: 13250.5, growthPct: 32.5, netPnl: 3250.5, xp: 420, trades: 12, wins: 8, losses: 4, winRate: 67, tradeStreak: 4,
    start: 10000, peakEquity: 13900, resets: 0, realized: 3100, avgWin: 500, avgLoss: -225, winStreakBest: 5, virtualTrades: 20, streak: 6, since: 1_759_000_000_000,
    bestTrades: [{ sym: 'NVDA', label: 'NVDA', invested: 2000, pnl: 812.25, pct: 40.6, entry: 120.5, exit: 169.44, openDay: '2026-10-01', closeDay: '2026-10-06' }],
    mostTraded: [{ sym: 'AAPL', trades: 5, pnl: -40 }], topStocks: [{ sym: 'NVDA', pnl: 812.25 }],
    achievements: ['first-trade', 'first-win', 'club-12k', 'squad-up'],
  });
  await put(`traders/${OTHER}`, { name: 'Rival Rita', username: 'rival_rita', bio: 'Momentum trader. Catch me if you can.' });
  await put(`twRecords/${OTHER}`, { played: 3, wins: 2, losses: 1, surrenders: 1, recent: [{ w: 'warAbc123456', name: 'Friday Night Fight', rank: 1, of: 4, pnlPct: 6.25 }] });
  await put(`cosmetics/${OTHER}`, { color: 'gold', badge: 'rocket' });
});

test('someone else’s profile: numbers, record, achievements; add friend; challenge', async ({ page }, info) => {
  await page.goto(`profile/${OTHER}`);
  await expect(page.getByRole('heading', { name: /Rival Rita/, level: 1 })).toBeVisible();
  await expect(page.getByText('@rival_rita')).toBeVisible();
  await expect(page.getByText('Momentum trader. Catch me if you can.')).toBeVisible();
  await expect(page.getByText('Trade War: $13,250.50')).toBeVisible();
  await expect(page.getByText('🔥 6-day streak')).toBeVisible();
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Trade War record' }) })).toContainText('Friday Night Fight');
  await expect(page.getByText('4 of 29')).toBeVisible();
  await expect(page.getByText('$12K Club')).toBeVisible();
  await expect(page.getByText('Best trade')).toBeVisible();
  await expect(page.getByRole('cell', { name: '+$812.25' })).toBeVisible();
  await expect(page.getByText('Never reset. Still on the first $10,000.')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

  const me = await signIn(page, `pf-${info.project.name}${Date.now()}@example.com`);
  await passBasics(me);
  const add = page.getByRole('button', { name: '+ Add friend' });
  await add.click();
  await expect(page.getByRole('button', { name: '✓ Friends' })).toBeVisible();
  await expect.poll(async () => JSON.stringify((await get(`users/${me}`))?.friends ?? null)).toContain(OTHER);

  await page.getByRole('button', { name: /Challenge to a Trade War/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Challenge Rival Rita' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Battle name').fill('Profile duel');
  await expect(sheet.getByRole('radio', { name: '$5,000' })).toBeDisabled(); // a new player: big buy-ins are locked
  await sheet.getByText('Last Man Standing', { exact: true }).click();
  await sheet.getByLabel('Losing trades').selectOption({ label: 'Out after 3 losing trades' });
  await sheet.getByText('Game options').click();
  await sheet.getByLabel('Stop-loss and take-profit allowed').check();
  await sheet.getByRole('button', { name: 'Send challenge' }).click();
  await expect(page).toHaveURL(/\/battles\/[A-Za-z0-9]{12}$/, { timeout: 30_000 });
  await expect(page.getByText('Out after 3 losing trades.')).toBeVisible();
  await expect(page.getByText('Stop-loss and take-profit are allowed on buys.')).toBeVisible();
});

test('your own profile: set up name, @username, bio and picture', async ({ page }, info) => {
  await page.goto('profile');
  await expect(page.getByText('Sign in to see your profile')).toBeVisible();
  const id = `${info.project.name.replace(/\W/g, '')}${Date.now() % 1e7}`.toLowerCase().slice(0, 14);
  const uid = await signIn(page, `pfme-${id}@example.com`);
  await expect(page.getByRole('button', { name: 'Set up your profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Set up your profile' }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit profile' });
  await sheet.getByLabel('Your name').fill('Pat Profile');
  const uname = `pf_${id}`.slice(0, 20);
  await sheet.getByLabel('Your @username').fill(uname);
  await expect(sheet.getByText(`@${uname} is available`)).toBeVisible();
  await sheet.getByLabel('Bio').fill('Learning to swing trade.');
  await sheet.getByTestId('pf-file').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(sheet.getByRole('img', { name: 'Your profile picture' })).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Pat Profile', level: 1 })).toBeVisible();
  await expect(page.getByText(`@${uname}`)).toBeVisible();
  await expect(page.getByText('Learning to swing trade.')).toBeVisible();
  await expect(page.getByText('Your public profile')).toBeVisible();
  await expect(page.getByText('only you can see this')).toBeVisible(); // tokens card
  const t = await get(`traders/${uid}`);
  expect(String(t?.avatar?.stringValue ?? '')).toMatch(/^data:image\/jpeg;base64,/);
  expect(t?.bio?.stringValue).toBe('Learning to swing trade.');
  expect((await get(`usernames/${uname}`))?.uid?.stringValue).toBe(uid);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
});

test('the leaderboard opens profiles in the app', async ({ page }) => {
  await page.goto('leaderboard');
  await page.getByRole('link', { name: /Rival Rita/ }).click();
  await expect(page).toHaveURL(new RegExp(`/profile/${OTHER}$`));
  await expect(page.getByRole('heading', { name: /Rival Rita/, level: 1 })).toBeVisible();
});

test('profile looks: buy a photo frame and an animated badge; a chart theme follows you', async ({ page }, info) => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
  const id = `${info.project.name}${Date.now()}`;
  await page.goto('profile');
  const uid = await signIn(page, `pflk-${id}@example.com`);
  await put(`wallets/${uid}`, { balance: 450 });
  await put(`traders/${uid}`, { name: 'Looks Tester' });
  await page.goto('profile');
  await page.getByRole('button', { name: 'Profile looks' }).click();
  const shop = page.getByRole('dialog', { name: 'Profile looks' });
  await expect(shop.getByRole('heading', { name: 'Photo frames' })).toBeVisible();
  await expect(shop.getByRole('heading', { name: 'Chart themes' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await shop.getByRole('button', { name: /Gold frame/ }).click();
  await page.getByRole('dialog', { name: 'Buy this look?' }).getByRole('button', { name: 'Buy · 120 tokens' }).click();
  await expect(page.getByText('Gold frame is yours and switched on.')).toBeVisible();
  await expect(shop.getByRole('button', { name: /Gold frame/ })).toHaveAttribute('aria-pressed', 'true');
  await shop.getByRole('button', { name: /Spinning coin badge/ }).click();
  await page.getByRole('dialog', { name: 'Buy this look?' }).getByRole('button', { name: 'Buy · 200 tokens' }).click();
  await expect(page.getByText('Spinning coin badge is yours and switched on.')).toBeVisible();
  await shop.getByRole('button', { name: /Paper chart theme/ }).click();
  await page.getByRole('dialog', { name: 'Buy this look?' }).getByRole('button', { name: 'Buy · 100 tokens' }).click();
  await expect(page.getByText('Paper chart theme is yours and switched on.')).toBeVisible();
  // 30 left: the next buy is refused with the numbers
  await shop.getByRole('button', { name: /Diamond frame/ }).click();
  await page.getByRole('dialog', { name: 'Buy this look?' }).getByRole('button', { name: 'Buy · 120 tokens' }).click();
  await expect(page.getByText('You need 120 tokens and have 30.')).toBeVisible();
  await page.getByRole('dialog', { name: 'Buy this look?' }).getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Escape');
  // on the profile: the frame around the picture and the badge by the name
  await expect(page.locator('h1').getByText('🪙')).toBeVisible();
  const frame = await page.locator('[class*="frameRing"]').first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(frame).toContain('gradient');
  // the chart engine now draws with the theme on this device
  await expect.poll(() => page.evaluate(() => localStorage.getItem('zelosChartTheme'))).toBe('paper');
  // taking it off switches charts back to the plain look
  await page.getByRole('button', { name: 'Profile looks' }).click();
  await page.getByRole('dialog', { name: 'Profile looks' }).getByRole('button', { name: /Paper chart theme/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('zelosChartTheme'))).toBeNull();
});
