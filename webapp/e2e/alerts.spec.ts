/**
 * Alerts in the app: the list with the track record and strategy filter, one finished alert
 * (plan, result, why), a live locked alert unlocked with tokens (real tokens_spend on the
 * emulators), a no-setup day, the notification switches and turning notifications on for this device.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>, ts?: string) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { ...Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])), ...(ts ? { createdAt: { timestampValue: ts } } : {}) } }) });
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const plan = { entry: 100, stop: 95, target1: 110, target2: 118, riskPerShare: 5, rewardPerShare: 10, rewardRiskRatio: 2, setupLabel: 'Pullback in uptrend', score: 64, scoreMax: 80, direction: 'long', marketRegime: 'S&P 500 above its 200-day average' };

test.beforeAll(async () => {
  await put('alerts/swing-trader-2026-09-30', { strategy: 'swing-trader', status: 'qualified', ticker: 'NVDA', ...plan, reasoning: 'Pulled back to the 20-day average on falling volume.', technicals: { RSI: 48, 'Volume vs avg': '0.7x' }, outcome: { result: 'hit-target', exitPrice: 110.4, notes: 'Target 1 hit on day 3.' } }, day(9));
  await put('alerts/breakout-rider-2026-10-01', { strategy: 'breakout-rider', status: 'qualified', ticker: 'AMD', ...plan, setupLabel: 'Flat base', outcome: { result: 'stopped-out', exitPrice: 95 } }, day(8));
  await put('alerts/options-scanner-2026-10-02', { strategy: 'options-scanner', status: 'no-qualifying-setup', marketRegime: 'Choppy' }, day(7));
  // a 3-Leg Options alert (open, so the track record above is unchanged); numbers as functions/three_leg.py works them out
  const legs = [
    { type: 'call', side: 'buy', strike: 180, qty: 1, price: 6 },
    { type: 'call', side: 'sell', strike: 190, qty: 2, price: 2.5 },
    { type: 'call', side: 'buy', strike: 200, qty: 1, price: 0.8 },
  ];
  await fetch(`${BASE}/alerts/three-leg-2026-10-09`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {
    ...Object.fromEntries(Object.entries({ strategy: 'three-leg', status: 'qualified', ticker: 'AAPL', setupLabel: 'Pin near 190', direction: 'long', kind: 'bull-butterfly', kindLabel: 'Bull call butterfly', expiration: '2026-11-20', entry: 188.5, netCost: 180, maxProfit: 820, maxLoss: 180 }).map(([k, x]) => [k, v(x)])),
    legs: { arrayValue: { values: legs.map(v) } },
    breakevens: { arrayValue: { values: [v(181.8), v(198.2)] } },
    createdAt: { timestampValue: day(1) },
  } }) });
  // a live alert: teaser in alerts, the full one in alertsLocked
  const until = Date.now() + 3 * 3600000;
  await put('alerts/swing-trader-2026-10-08', { strategy: 'swing-trader', status: 'qualified', setupLabel: 'Bull flag', score: 70, scoreMax: 80, locked: true, lockedUntil: until }, day(0));
  await put('alertsLocked/swing-trader-2026-10-08', { strategy: 'swing-trader', status: 'qualified', ticker: 'MSFT', ...plan, setupLabel: 'Bull flag', lockedUntil: until, released: false }, day(0));
});

test('the list, the track record and a finished alert', async ({ page }) => {
  await page.goto('alerts');
  await expect(page.getByRole('heading', { name: 'Alerts', level: 1 })).toBeVisible();
  await expect(page.getByText('50%')).toBeVisible(); // 1 win, 1 loss
  const list = page.locator('section').filter({ has: page.getByRole('heading', { name: 'All alerts' }) });
  await expect(list.getByRole('link', { name: /NVDA/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /🔒 Live Swing Trader Bull flag/ })).toBeVisible(); // live: ticker hidden
  await expect(list.getByText('MSFT')).toHaveCount(0);
  await expect(list.getByRole('link', { name: /No setup/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  // filter
  await page.getByRole('tab', { name: 'Breakout Rider' }).click();
  await expect(list.getByRole('link', { name: /AMD/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /NVDA/ })).toHaveCount(0);
  await expect(page.getByText('0%')).toBeVisible();
  await page.getByRole('tab', { name: 'All' }).click();
  // a finished alert
  await list.getByRole('link', { name: /NVDA/ }).click();
  await expect(page.getByRole('heading', { name: 'NVDA', level: 1 })).toBeVisible();
  await expect(page.getByText('Hit target').first()).toBeVisible();
  await expect(page.getByText('Exit $110.40')).toBeVisible();
  await expect(page.getByText('Reward is 2.0× the risk').first()).toBeVisible();
  await expect(page.getByText('Pulled back to the 20-day average on falling volume.')).toBeVisible();
  // one tap to the ticket, with the alert's stop and first target already filled in
  await expect(page.getByRole('link', { name: 'Trade this setup' })).toHaveAttribute('href', /\/practice\/trade\/NVDA\?sl=95&tp=110$/);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  // a 3-Leg Options alert: the three positions, cost, most it can make and lose
  await page.goto('alerts/three-leg-2026-10-09');
  await expect(page.getByRole('heading', { name: 'AAPL', level: 1 })).toBeVisible();
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Bull call butterfly' }) });
  await expect(card.getByRole('row')).toHaveCount(4); // header + 3 legs
  await expect(card.getByText('Sell 2')).toBeVisible();
  await expect(card.getByText('$180.00').first()).toBeVisible();
  await expect(card.getByText('$820.00')).toBeVisible();
  await expect(card.getByText('$181.80 · $198.20')).toBeVisible();
  await expect(card.getByRole('img', { name: 'Profit or loss at expiration, by stock price' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  // a no-setup day
  await page.goto('alerts/options-scanner-2026-10-02');
  await expect(page.getByRole('heading', { name: 'No setup today' }).first()).toBeVisible();
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

  test('unlock a live alert with tokens; notification switches', async ({ page }, info) => {
    await page.goto('alerts/swing-trader-2026-10-08');
    await expect(page.getByRole('heading', { name: /Locked/, level: 1 })).toBeVisible();
    const uid = await signIn(page, `alerts-${info.project.name}${Date.now()}@example.com`);
    await put(`wallets/${uid}`, { balance: 50, welcomed: true, passes: {} });
    await page.reload();
    await page.getByRole('button', { name: 'Unlock · 10 tokens' }).click();
    await expect(page.getByRole('heading', { name: 'MSFT', level: 1 })).toBeVisible();
    await expect(page.getByText('$95.00')).toBeVisible();
    const w = await get(`wallets/${uid}`);
    expect(w.fields.balance.integerValue).toBe('40');

    // a browser that can show notifications and hasn't been asked yet (CI's headless browser starts
    // with them blocked); asking is answered "Block"
    if (info.project.name !== 'phone')
      await page.addInitScript(() => {
        const w = window as unknown as Record<string, unknown>;
        w.PushManager ??= function PushManager() {};
        Object.defineProperty(Notification, 'permission', { get: () => 'default' });
        Object.defineProperty(Notification, 'requestPermission', { value: () => Promise.resolve('denied') });
      });
    await page.goto('alerts?tab=notify');
    // this device: an iPhone has to add Zelos to the Home Screen first; elsewhere it offers Turn on
    const device = page.getByRole('region', { name: 'Notifications on this device' });
    if (info.project.name === 'phone') await expect(device.getByText('On iPhone: add Zelos to your Home Screen')).toBeVisible();
    else {
      await expect(device.getByText('Get notified on this device')).toBeVisible();
      await device.getByRole('button', { name: 'Turn on' }).click();
      await expect(page.getByText('Notifications are blocked for Zelos. Allow them in your settings, then try again.')).toBeVisible();
    }
    const sw = page.getByRole('switch', { name: 'Breakout Rider' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    // saved on the account (the switch flips at once; the write lands a moment later)
    await expect
      .poll(async () => ((await get(`users/${uid}`)).fields?.notificationPrefs?.mapValue?.fields?.strategies?.arrayValue?.values ?? []).map((x: { stringValue: string }) => x.stringValue))
      .toEqual(['swing-trader', 'options-scanner', 'three-leg']);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  });
});
