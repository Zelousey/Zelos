/**
 * Deleting your account from Settings (account_delete through the Functions emulator): a wrong
 * password deletes nothing; the right one removes your data and signs you out.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const exists = async (path: string) => (await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } })).status === 200;
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

test('delete your account from Settings', async ({ page }, info) => {
  await page.goto('settings');
  const uid = await signIn(page, `del-${info.project.name}${Date.now()}@example.com`);
  await fetch(`${BASE}/users/${uid}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { watchlist: { arrayValue: { values: [{ stringValue: 'AAPL' }] } } } }) });
  const btn = page.getByRole('button', { name: 'Delete my account' });
  await expect(btn).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByLabel('Your Zelos password').fill('wrong-one');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await btn.click();
  await expect(page.getByRole('status').filter({ hasText: "That password isn't right. Nothing was deleted." })).toBeVisible();
  expect(await exists(`users/${uid}`)).toBe(true);

  await page.getByLabel('Your Zelos password').fill('secret123');
  await btn.click();
  await expect(page).not.toHaveURL(/settings$/, { timeout: 30_000 });
  await expect.poll(() => exists(`users/${uid}`), { timeout: 15_000 }).toBe(false);
});
