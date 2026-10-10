/**
 * Tokens and levels (owner 2026-10-09): the token chip in the top bar with the website's Z coin,
 * coins flying in when tokens arrive, the wallet sheet; and the level-up celebration with the
 * framed badge that changes with your level.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const put = (path: string, fields: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
const getBalance = async (uid: string) => {
  const r = await fetch(`${BASE}/wallets/${uid}`, { headers: { Authorization: 'Bearer owner' } });
  if (!r.ok) return null;
  const f = ((await r.json()) as { fields?: { balance?: { integerValue?: string } } }).fields;
  return f?.balance?.integerValue != null ? Number(f.balance.integerValue) : null;
};
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

test('the token chip sits in the top bar and counts up when tokens arrive', async ({ page }, info) => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'the wallet is made by the server (Functions emulator)');
  await page.goto('dashboard');
  const uid = await signIn(page, `tok-${info.project.name}${Date.now()}@example.com`);
  const chip = page.getByRole('banner').getByRole('button', { name: /Your tokens: \d+/ });
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => getBalance(uid), { timeout: 30_000 }).not.toBeNull();
  const before = (await getBalance(uid))!;
  await expect(chip).toHaveAccessibleName(`Your tokens: ${before}. Open wallet`, { timeout: 20_000 });
  await put(`wallets/${uid}`, { balance: { integerValue: String(before + 25) } });
  await expect(chip).toContainText(String(before + 25), { timeout: 15_000 }); // after the coins land
  await chip.click();
  await expect(page.getByRole('dialog', { name: 'Get tokens' })).toBeVisible();
});

test('reaching a new level celebrates once with the new framed badge', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('lvlSet')) {
      localStorage.setItem('zelosLevelCelebrated', '2');
      sessionStorage.setItem('lvlSet', '1');
    }
  });
  await page.goto('missions');
  const uid = await signIn(page, `lvl-${info.project.name}${Date.now()}@example.com`);
  await put(`users/${uid}`, { xp: { integerValue: '450' } });
  const dlg = page.getByRole('dialog', { name: 'Level up: Platinum' });
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  await expect(dlg).toContainText('Level 4 · Platinum');
  await expect(dlg).not.toContainText('New badge frame'); // 3 and 4 share the gold frame
  await expect(dlg.locator('[data-tier="2"]')).toBeVisible();
  await dlg.getByRole('button', { name: 'Nice!' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('[data-tier="2"]').first()).toBeVisible(); // the level card's badge
  await page.reload();
  await expect(page.getByText('Level 4 · Strategist')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Level up/ })).toHaveCount(0); // once per level
});
