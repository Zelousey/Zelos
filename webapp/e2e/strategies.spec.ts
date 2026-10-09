/**
 * Strategies: easy to find (Trade War hub, Dashboard), what each one looks for, the latest
 * alert, and a 7-day pass bought with tokens (real tokens_wallet / tokens_spend functions on
 * the emulators).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const put = (path: string, fields: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

test.beforeAll(async () => {
  // a locked live alert (teaser) and a test doc that must not show
  await put('alerts/breakout-rider-2026-10-08', { strategy: { stringValue: 'breakout-rider' }, createdAt: { timestampValue: new Date().toISOString() }, status: { stringValue: 'qualified' }, setupLabel: { stringValue: 'Flat-base breakout' }, score: { integerValue: '82' }, scoreMax: { integerValue: '100' }, locked: { booleanValue: true } });
  await put('alerts/test-swing-xyz', { strategy: { stringValue: 'swing-trader' }, createdAt: { timestampValue: new Date().toISOString() }, status: { stringValue: 'test-deploy' }, ticker: { stringValue: 'TEST123' } });
});

test('find strategies from Trade War and the Dashboard; see what each looks for', async ({ page }) => {
  await page.goto('trade-war');
  const promo = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Strategies', exact: true }) });
  await expect(promo.getByRole('link', { name: /Breakout Rider/ })).toBeVisible();
  await page.goto('dashboard');
  await page.getByRole('link', { name: 'All strategies →' }).click();
  await expect(page.getByRole('heading', { name: 'Strategies', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Swing Trader', exact: true })).toBeVisible();
  await expect(page.getByText('Flat-base breakout')).toBeVisible(); // the live alert teaser, ticker hidden
  await expect(page.getByText('TEST123')).toHaveCount(0); // test docs never show
  await expect(page.getByRole('button', { name: 'Sign in to get a pass' })).toHaveCount(3);
  await expect(page.getByText(/not investment advice/)).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.getByRole('link', { name: 'Breakout Rider', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Breakout Rider', level: 1 })).toBeVisible();
  await expect(page.getByText('A clean move through resistance')).toBeVisible();
  await expect(page.getByText('One-candle spikes that fade')).toBeVisible();
  await expect(page.getByRole('link', { name: /Flat-base breakout/ })).toHaveAttribute('href', /alert\.html\?id=breakout-rider-2026-10-08$/);
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

  test('buy a 7-day pass with tokens', async ({ page }, info) => {
    await page.goto('strategies');
    const uid = await signIn(page, `strat-${info.project.name}${Date.now()}@example.com`);
    await put(`wallets/${uid}`, { balance: { integerValue: '100' }, passes: { mapValue: { fields: {} } }, unlocked: { arrayValue: {} }, welcomed: { booleanValue: true } });
    await expect(page.getByRole('button', { name: /Your tokens: 100/ })).toBeVisible();
    const card = page.locator('section').filter({ has: page.getByRole('link', { name: 'Swing Trader', exact: true }) });
    await card.getByRole('button', { name: '7-day pass · 40 tokens' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/You’ll have 60 tokens left/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Pay 40 tokens' }).click();
    await expect(page.getByText('Swing Trader pass active for 7 days')).toBeVisible();
    await expect(card.getByText(/^Pass until/)).toBeVisible();
    await expect(card.getByRole('link', { name: /Open alerts/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Your tokens: 60/ })).toBeVisible();
    // the tokens sheet
    await page.getByRole('button', { name: /Your tokens: 60/ }).click();
    await expect(page.getByRole('dialog', { name: 'Get tokens' }).getByText(/coming soon|\$3/)).toBeVisible();
  });
});
