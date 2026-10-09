/**
 * Options (owner 2026-10-09: "full options trading now"): the option chain with modeled
 * prices, buying a put through the real practice_order function, cancelling it, and selling
 * a contract you hold. (Fills and expiry happen in the server's price pass, which
 * tests/rules/options.e2e.py covers.)
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
// the first listed expiration: next Friday in New York (same rule as the app and the server)
function nextFriday(): string {
  const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const short = (exp: string) => exp.slice(5).replace('-', '/');

test('the chain shows modeled prices to everyone, with no sideways scroll', async ({ page }) => {
  await page.goto('options/AAPL');
  await expect(page.getByRole('heading', { name: 'Options', level: 1 })).toBeAttached();
  await expect(page.getByText(/Option prices are modeled, not exchange quotes/)).toBeVisible();
  const rows = page.getByRole('region', { name: 'Option prices' }).getByRole('row');
  await expect(rows).toHaveCount(12); // header + 11 strikes around the money
  await expect(page.getByText('At the money')).toBeVisible();
  const more = page.getByRole('button', { name: 'Show all 31 strikes' });
  await more.evaluate((b) => b.scrollIntoView({ block: 'center' })); // clear of the phone tab bar
  await more.click();
  await expect(rows).toHaveCount(32);
  await page.getByRole('tab', { name: 'Puts' }).click();
  await expect(page.getByText(/A put gains value when the stock goes down/)).toBeVisible();
  await expect(page.getByText(/Sign in to open your practice account/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
});

test('buy a put, cancel it, and sell a contract you hold', async ({ page }, info) => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'orders go through the server (Functions emulator)');
  await page.goto('practice');
  const uid = await signIn(page, `opt-${info.project.name}${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();

  // AAPL is $333.63 in the fixture: strikes every $5, $335 at the money
  await page.goto('options/AAPL');
  const exp = nextFriday();
  await page.getByLabel('Expiration').selectOption(exp);
  await page.getByRole('tab', { name: 'Puts' }).click();
  await page.getByRole('button', { name: `Buy AAPL $335 Put ${short(exp)}` }).click();
  const sheet = page.getByRole('dialog', { name: `Buy AAPL $335 Put ${short(exp)}` });
  await sheet.getByLabel('Contracts').fill('500');
  await expect(sheet.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
  await sheet.getByLabel('Contracts').fill('2');
  await expect(sheet.getByText(/The most you can lose is what you pay/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Buy 2' }).click();
  await expect(page.getByText('Order placed. It fills at the next price update.')).toBeVisible();
  await expect(page.getByText(`Buy 2 AAPL $335 Put ${short(exp)}`)).toBeVisible();
  await page.getByRole('button', { name: `Cancel: Buy 2 AAPL $335 Put ${short(exp)}` }).click();
  await expect(page.getByText('No open orders.')).toBeVisible();

  // a contract you hold (as if a buy had filled): sell it back
  const cid = `AAPL|${exp.replace(/-/g, '')}|C|33000`;
  const pos = { u: { stringValue: 'AAPL' }, kind: { stringValue: 'call' }, strike: { doubleValue: 330 }, exp: { stringValue: exp }, qty: { integerValue: '3' }, avg: { doubleValue: 4.5 }, label: { stringValue: `AAPL $330 Call ${short(exp)}` } };
  const r = await fetch(`${BASE}/practiceAccounts/${uid}?updateMask.fieldPaths=options`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { options: { mapValue: { fields: { [cid]: { mapValue: { fields: pos } } } } } } }) });
  expect(r.ok).toBe(true);
  await expect(page.getByRole('link', { name: `AAPL $330 Call ${short(exp)}` })).toBeVisible();
  await page.getByRole('button', { name: `Sell: AAPL $330 Call ${short(exp)}` }).click();
  await expect(page.getByRole('dialog')).toContainText(`Sell 3 AAPL $330 Call ${short(exp)} at the model price`);
  await page.getByRole('dialog').getByRole('button', { name: 'Sell' }).click();
  await expect(page.getByText(`Sell 3 AAPL $330 Call ${short(exp)}`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Sell: AAPL $330 Call ${short(exp)}` })).toBeDisabled(); // all 3 are in the open order

  // Practice shows them too, and counts them in the account value
  await page.goto('practice');
  await expect(page.getByRole('heading', { name: 'Your options' })).toBeVisible();
  await expect(page.getByText(`Sell 3 AAPL $330 Call ${short(exp)} · Market`)).toBeVisible();
});
