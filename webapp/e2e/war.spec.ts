/**
 * The War zone (Trade War realm, docs/WAR_DESIGN.md §20, §24): hidden until all of War is built,
 * so it's "Page not found" for everyone but admins; an admin gets the one-time "prices are
 * simulated" explainer, a $100,000 War balance, the SIMULATED marking on the screen and the
 * chart, and can buy at the War zone price.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
async function seedMarket() {
  const now = Date.now();
  const M = 60000;
  await put('warMarket/quotes', { updatedAt: now, prices: { NIMBC: { p: 190.5, ref: 182 }, VOLTX: { p: 85.25, ref: 88 } } });
  const start = now - (now % (5 * M)) - 60 * 5 * M;
  await put('warMarket/bars_NIMBC', { bars: Array.from({ length: 60 }, (_, i) => ({ t: start + i * 5 * M, o: 182 + i * 0.1, h: 183 + i * 0.1, l: 181 + i * 0.1, c: 182.5 + i * 0.1 })) });
}

test('the War zone is hidden from everyone but admins', async ({ page }, info) => {
  await page.goto('dashboard');
  await signIn(page, `nowar-${info.project.name}-${Date.now()}@example.com`);
  await page.goto('war');
  await expect(page.getByText('Page not found')).toBeVisible();
  await expect(page.getByRole('link', { name: 'War zone' })).toHaveCount(0); // in no menu
});

test('an admin previews the War zone: simulated marking, $100,000 War balance, buy at the War zone price', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('warReset')) {
      localStorage.removeItem('zelosWarExplained'); // a first visit (once, so "seen" can stick)
      sessionStorage.setItem('warReset', '1');
    }
  });
  await page.goto('dashboard');
  const uid = await signIn(page, `war-${info.project.name}-${Date.now()}@example.com`);
  await put(`admins/${uid}`, { addedAt: 1 });
  await seedMarket();
  await page.goto('war');
  const explain = page.getByRole('dialog', { name: 'Prices here are simulated' });
  await expect(explain).toBeVisible();
  await expect(explain).toContainText('isn’t real market data');
  await explain.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'War zone', level: 1 })).toBeVisible();
  await expect(page.getByText('SIMULATED WAR ZONE').first()).toBeVisible();
  await expect(page.getByText('$100,000.00').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tech' })).toContainText('Nimbus Cloud');
  await expect(page.getByText('live', { exact: false }).filter({ hasText: /\blive\b/i })).toHaveCount(0); // nothing in the War zone says "live"
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/war-${info.project.name}.png`, fullPage: true });
  await page.getByLabel('Shares').fill('10');
  await page.getByRole('button', { name: 'Buy 10 NIMBC' }).click();
  await expect(page.getByText('Bought 10 NIMBC at $190.50')).toBeVisible({ timeout: 30_000 }); // a cold start
  await expect(page.getByText('10 shares · avg $190.50')).toBeVisible();
  await expect(page.getByText('Cash $98,095.00 · started with $100,000')).toBeVisible();
  // the explainer shows once
  await page.reload();
  await expect(page.getByRole('heading', { name: 'War zone', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Prices here are simulated' })).toHaveCount(0);
});
