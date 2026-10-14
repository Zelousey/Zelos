/**
 * Watchlist editing (owner 2026-10-14): ☆ Watch on a stock page, then Edit on the Dashboard's
 * watchlist card to add and remove stocks; the list is users/{uid}.watchlist.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const watchlist = async (uid: string) => {
  const d = (await (await fetch(`${BASE}/users/${uid}`, { headers: { Authorization: 'Bearer owner' } })).json()) as { fields?: { watchlist?: { arrayValue?: { values?: { stringValue: string }[] } } } };
  return (d.fields?.watchlist?.arrayValue?.values ?? []).map((v) => v.stringValue);
};
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

test('watch a stock, then add and remove on the Dashboard', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('zelosWelcomeSkip', '1'));
  await page.goto('markets/AAPL');
  const uid = await signIn(page, `watch-${info.project.name}${Date.now()}@example.com`);
  await page.getByRole('button', { name: '☆ Watch' }).click();
  await expect(page.getByRole('button', { name: '★ Watching' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => watchlist(uid)).toEqual(['AAPL']);

  await page.goto('dashboard');
  await page.getByRole('button', { name: 'Edit' }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit your watchlist' });
  await sheet.getByLabel('Add a stock (symbol)').fill('zzzz');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet.getByRole('alert')).toHaveText('ZZZZ is not on the Zelos stock list.');
  await sheet.getByLabel('Add a stock (symbol)').fill('msft');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet.getByRole('list', { name: 'Watchlist' })).toContainText('MSFT');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await sheet.getByRole('button', { name: 'Remove AAPL from your watchlist' }).click();
  await expect.poll(() => watchlist(uid)).toEqual(['MSFT']);
});
