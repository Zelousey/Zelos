/**
 * Owner list 2026-11-13: a position opens its own view (a stock: its trade page with the chart and
 * Buy / Sell; an option: the stock's chart, the contract's chart and your contracts), entry pins on
 * the chart for what you still hold, Invite friends first in the phone menu, the bull vs bear
 * track record.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const nyDay = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
function nextFriday(): string {
  const d = new Date(nyDay(Date.now()) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const v = (x: unknown): Record<string, unknown> =>
  typeof x === 'string' ? { stringValue: x } : Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
const fields = (o: Record<string, unknown>) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x && typeof x === 'object' ? { mapValue: fields(x as Record<string, unknown>) } : v(x)])) });

test('the phone menu starts with Invite friends, bold', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the ☰ menu is the phone layout');
  await page.goto('dashboard');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const sheet = page.getByRole('dialog', { name: 'Menu' });
  const first = sheet.getByRole('link').first();
  await expect(first).toContainText('Invite friends');
  await first.click();
  await expect(page).toHaveURL(/\/invite$/);
});

test('a stock position opens its trade page with entry pins; an option position opens the stock chart, the contract chart and your contracts', async ({ page }, info) => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs a server practice account (Functions emulator)');
  await page.goto('practice');
  const uid = await signIn(page, `pos-${info.project.name}${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();

  // you hold 5 AAPL (two buys) and 2 calls, as if the buys had filled
  const now = Date.now();
  const exp = nextFriday();
  const cid = `AAPL|${exp.replace(/-/g, '')}|C|33000`;
  const label = `AAPL $330 Call ${exp.slice(5).replace('-', '/')}`;
  const acct = { positions: { AAPL: { qty: 5, avg: 310, openedDay: nyDay(now - 9 * 864e5) } }, options: { [cid]: { u: 'AAPL', kind: 'call', strike: 330, exp, qty: 2, avg: 4.5, label } } };
  expect((await fetch(`${BASE}/practiceAccounts/${uid}?updateMask.fieldPaths=positions&updateMask.fieldPaths=options`, { method: 'PATCH', headers: H, body: JSON.stringify(fields(acct)) })).ok).toBe(true);
  const fills = [
    { kind: 'fill', sym: 'AAPL', side: 'buy', qty: 3, price: 300, at: now - 8 * 864e5, day: nyDay(now - 8 * 864e5) },
    { kind: 'fill', sym: 'AAPL', side: 'buy', qty: 2, price: 325, at: now - 3 * 864e5, day: nyDay(now - 3 * 864e5) },
    { kind: 'fill', sym: 'AAPL', opt: cid, label, side: 'buy', qty: 2, price: 4.5, at: now - 864e5, day: nyDay(now - 864e5) },
  ];
  for (const [i, f] of fills.entries()) expect((await fetch(`${BASE}/practiceAccounts/${uid}/history/seed${i}`, { method: 'PATCH', headers: H, body: JSON.stringify(fields(f)) })).ok).toBe(true);

  // tap the position (not its buttons): its trade page, the daily chart with a pin for each buy
  await page.reload();
  const row = page.locator(info.project.name === 'phone' ? 'li' : 'tr').filter({ hasText: /^AAPL/ }).filter({ visible: true }).first();
  await row.locator('.num').filter({ hasText: /\$/ }).first().click();
  await expect(page).toHaveURL(/\/practice\/trade\/AAPL$/);
  await page.getByRole('tab', { name: 'D', exact: true }).click().catch(() => {});
  await expect(page.locator('[data-pins="2"]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Buy$/ }).or(page.getByRole('tab', { name: 'Buy' })).first()).toBeVisible();

  // the option position: stock chart (one pin), the contract's chart, and your contracts underneath
  await page.goto('practice');
  await page.getByRole('link', { name: label }).first().click();
  await expect(page).toHaveURL(new RegExp(`/options/AAPL\\?pos=`));
  await expect(page.getByRole('heading', { name: 'AAPL, the stock' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This contract' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your AAPL contracts' })).toBeVisible();
  await page.getByRole('tab', { name: 'D', exact: true }).first().click();
  await expect(page.locator('[data-pins="1"]').first()).toBeVisible();
});
