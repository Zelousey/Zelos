/**
 * Take this trade (owner 2026-11-19): an alert shows what the trade might look like, why it was
 * picked and the live price; one tap places it (stop, target and a time exit), or Decline sends it to
 * Declined alerts. Also the strategy scoreboard on the Alerts page and the high-risk switch.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { ...Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])), createdAt: { timestampValue: new Date().toISOString() } } }) });
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const checks = { above50: true, trend: true, above20: true, macdUp: true, macdBull: true, rsiZone: true, rsiTurn: false, greenDay: true, strongClose: true, volume: true, market: true, leader: true, notStretched: false };
const alert = (id: string) =>
  put(`alerts/${id}`, {
    strategy: 'momentum-trader', status: 'qualified', ticker: 'AAPL', direction: 'long', setupLabel: '11 of 13 checks', score: 11, scoreMax: 13, checks,
    entry: 333.6, stop: 329.1, target1: 340.35, target2: 344.85, riskPerShare: -4.5, rewardPerShare: 6.75, rewardRiskRatio: '1.5 : 1', holdDays: 3, plannedAt: '10:00',
    reasoning: 'AAPL passed 11 of the 13 chart checks.', marketRegime: 'Bullish',
  });

test('take a Momentum Trader alert in one tap; decline another and find it in Declined alerts', async ({ page }, info) => {
  const tag = `${info.project.name}${Date.now() % 100000}`;
  await alert(`momentum-trader-2026-11-2${info.project.name === 'phone' ? 1 : 0}`);
  await alert(`momentum-trader-2026-11-1${info.project.name === 'phone' ? 9 : 8}`);
  await page.goto('dashboard');
  const uid = await signIn(page, `take-${tag}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();

  const id = `momentum-trader-2026-11-2${info.project.name === 'phone' ? 1 : 0}`;
  await page.goto(`alerts/${id}`);
  const card = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Take this trade' }) }).last();
  await expect(page.getByRole('heading', { name: 'Take this trade' })).toBeVisible();
  await expect(page.getByRole('img', { name: /What the AAPL trade might look like/ })).toBeVisible();
  await expect(page.getByText('✓ MACD histogram rising')).toBeVisible();
  await expect(page.getByLabel('Close it after')).toHaveValue('3');
  await expect(page.getByRole('link', { name: 'Open the live chart' })).toBeVisible();
  await expect(page.getByLabel('Shares')).toHaveValue('7'); // ~1% risk, capped at a quarter of the account
  await expect(page.getByTestId('price-path')).toBeVisible(); // the last 30 days
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/take-${info.project.name}.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await page.getByRole('button', { name: /^Take trade: buy 7 AAPL/ }).click();
  await expect(page.getByText('You took this trade.')).toBeVisible();
  void card;

  const other = `momentum-trader-2026-11-1${info.project.name === 'phone' ? 9 : 8}`;
  await page.goto(`alerts/${other}`);
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByText('You declined this one.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take it back · 2 tokens' })).toBeVisible();
  await expect.poll(async () => (await get(`users/${uid}/alertDecisions/${other}`)).fields?.status?.stringValue).toBe('declined'); // saved
  await page.goto('alerts/declined');
  await expect(page.getByRole('heading', { name: 'Declined alerts' })).toBeVisible();
  await expect(page.getByRole('link', { name: /AAPL/ })).toBeVisible();

  await page.goto('alerts');
  await expect(page.getByRole('heading', { name: 'Strategy scoreboard' })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/board-${info.project.name}.png`, fullPage: true });
});

test('Momentum Max is hidden until high-risk strategies are turned on', async ({ page }) => {
  await page.goto('strategies');
  await expect(page.getByRole('link', { name: 'Momentum Trader', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Momentum Max', exact: true })).toHaveCount(0);
  await page.getByLabel(/Show high-risk strategies/).check();
  await expect(page.getByRole('link', { name: 'Momentum Max', exact: true })).toBeVisible();
});
