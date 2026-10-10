/**
 * Practice account, end to end in the browser against the real Python Cloud Functions on
 * the emulators: sign in, open the $10,000 account, trade from a chart, see and cancel the
 * open order, and the ticket's own checks. (Fills happen in the server's price pass, which
 * tests/rules/practice_pass.e2e.py covers.) Skipped when functions/venv is missing.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function signIn(page: Page, who: string) {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  await page.evaluate((email) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<unknown> }).__zelosTestSignIn(email, 'secret123'), `${who}@example.com`);
}

test('open the account, buy from a chart with a bracket, see and cancel the order', async ({ page }, info) => {
  await page.goto('practice');
  await expect(page.getByText(/Sign in to open your practice account/)).toBeVisible();
  await signIn(page, `trader-${info.project.name}-${Date.now()}`);

  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  await expect(page.getByText('No positions yet.', { exact: false })).toBeVisible();

  // from the chart into the ticket
  await page.goto('markets/AAPL');
  await page.getByRole('link', { name: /Practice trade/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/app\/practice\/trade\/AAPL$/);
  await page.getByLabel('Shares', { exact: true }).fill('5');
  await page.getByLabel('Stop-loss + Take-profit').check();
  await expect(page.getByLabel('Stop-loss', { exact: true })).not.toHaveValue('');
  await expect(page.getByText(/Risk \$.* to make \$.* \(1 : 2\.0\)/)).toBeVisible();
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'Review order' }).click();

  const dialog = page.getByRole('dialog', { name: 'Confirm order' });
  await expect(dialog).toContainText('Buy 5 AAPL');
  await dialog.getByRole('button', { name: /Place order: Buy 5 AAPL/ }).click();
  await expect(page).toHaveURL(/\/app\/practice$/);
  await expect(page.getByText(/Buy order for 5 AAPL placed/)).toBeVisible();

  // the server holds the order; cash is untouched until it fills
  await expect(page.getByText('Buy 5 AAPL · Market')).toBeVisible();
  await noSidewaysScroll(page);
  await expect(page.getByText(/Orders fill on the next price update/)).toBeVisible();
  await page.getByRole('button', { name: /Cancel: Buy 5 AAPL/ }).click();
  await expect(page.getByText('No open orders.')).toBeVisible();
  await expect(page.getByText(/Buy 5 AAPL cancelled · Cancelled by you/)).toBeVisible();
});

test('the ticket checks input before anything is sent', async ({ page }, info) => {
  await page.goto('practice');
  await signIn(page, `checker-${info.project.name}-${Date.now()}`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  await page.goto('practice/trade/AAPL');
  const review = page.getByRole('button', { name: 'Review order' });
  await page.getByLabel('Shares', { exact: true }).fill('1000');
  await expect(page.getByText(/More than your buying power/)).toBeVisible();
  await expect(review).toBeDisabled();
  await page.getByRole('tab', { name: 'Sell' }).click();
  await page.getByLabel('Shares', { exact: true }).fill('1');
  await expect(page.getByText('You can sell up to 0 shares.')).toBeVisible();
  await expect(review).toBeDisabled();
  await page.getByRole('tab', { name: 'Buy' }).click();
  await page.getByRole('tab', { name: 'Limit' }).click();
  await page.getByLabel('Limit price').fill('');
  await expect(page.getByText('Enter a price.')).toBeVisible();
  await page.getByLabel('Limit price').fill('300');
  await expect(review).toBeEnabled();
  // Max fills the most whole shares the buying power allows at that price
  await page.getByRole('button', { name: 'Max' }).click();
  await expect(page.getByLabel('Shares', { exact: true })).toHaveValue('33');

  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.goto('practice');
  await expect(page.getByRole('img', { name: /Account value over time/ })).toBeVisible();
  const r2 = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r2.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('unknown symbols and signed-out visitors are handled', async ({ page }) => {
  await page.goto('practice/trade/ZZZZ');
  await expect(page.getByText('No data for ZZZZ')).toBeVisible();
  await page.goto('practice/trade/AAPL');
  await expect(page.getByRole('link', { name: 'Open Practice' })).toBeVisible();
});

test('account value chart: today and longer ranges, with a table (owner 2026-10-10)', async ({ page }, info) => {
  await page.goto('practice');
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  const uid = await page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), `chart-${info.project.name}-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
  const day = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return 'd' + d.toISOString().slice(0, 10).replace(/-/g, '');
  };
  const e = (v: number) => ({ mapValue: { fields: { e: { doubleValue: v }, n: { integerValue: '0' }, x: { integerValue: '0' } } } });
  const fields = {
    cash: { doubleValue: 6663.7 },
    positions: { mapValue: { fields: { AAPL: { mapValue: { fields: { qty: { integerValue: '10' }, avg: { doubleValue: 330 }, openedDay: { stringValue: '2026-10-01' } } } } } } },
    hist: { mapValue: { fields: { [day(3)]: e(9800), [day(2)]: e(9950), [day(1)]: e(9980) } } },
  };
  const r = await fetch(`${BASE}/practiceAccounts/${uid}?updateMask.fieldPaths=cash&updateMask.fieldPaths=positions&updateMask.fieldPaths=hist`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  expect(r.ok).toBe(true);
  const chart = page.getByRole('img', { name: /Account value over time/ });
  await expect(chart).toBeVisible();
  await expect(page.getByText('$10,000.00').first()).toBeVisible(); // 6,663.70 cash + 10 AAPL at 333.63
  // today = the newest day with 1-minute prices (the fixture's); no saved close before it, so vs $10,000
  await expect(page.getByText(/^\$0\.00 \(\+0\.00%\)$/)).toBeVisible();
  await page.getByRole('tab', { name: '1W' }).click();
  await expect(page.getByText('Past week', { exact: true })).toBeVisible();
  await expect(page.getByText(/^\+\$200\.00 \(\+2\.04%\)$/)).toBeVisible(); // vs 9,800 three days ago
  await page.getByText('Show as a table').click();
  await expect(page.getByRole('table', { name: /Account value ·/ })).toContainText('$9,800.00');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
});
