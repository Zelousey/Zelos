/**
 * Help & feedback (Phase 8, F22 + F23): easy to find (menu, Settings), quick answers, the
 * first-steps checklist even after Hide, and feedback saved on the server that only the team reads.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const putAdmin = (uid: string) =>
  fetch(`${BASE}/admins/${uid}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { since: { integerValue: '1' } } }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity), null, { timeout: 2000 }).catch(() => undefined);
const axe = async (page: Page) => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

test('Help is easy to find and answers the basics; feedback asks guests to sign in', async ({ page }) => {
  await page.goto('settings');
  await page.getByRole('main').getByRole('link', { name: 'Help & feedback' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Help & feedback' })).toBeVisible();
  await page.getByText('Is any of this real money?').click();
  await expect(page.getByText(/Every account in Zelos uses virtual money/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Solo →' })).toHaveAttribute('href', '/app/trade-war/solo');
  await expect(page.getByText('Sign in to send feedback.')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  // also in the menu
  await page.goto('dashboard');
  const menuBtn = page.getByRole('button', { name: 'Open menu' });
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Help & feedback' })).toBeVisible();
  } else {
    await expect(page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Help & feedback' })).toBeVisible();
  }
});

test('signed in: first steps stay findable after Hide; feedback goes to the team, who tick it off', async ({ page }, info) => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
  await page.goto('dashboard');
  const uid = await signIn(page, `help-${info.project.name}${Date.now()}@example.com`);
  const steps = page.locator('section').filter({ has: page.getByRole('heading', { name: 'First steps' }) });
  await expect(steps).toBeVisible();
  await steps.getByRole('button', { name: 'Hide' }).click();
  await expect(steps).toHaveCount(0);

  await page.goto('help');
  const inHelp = page.locator('section').filter({ has: page.getByRole('heading', { name: 'First steps' }) });
  await expect(inHelp).toBeVisible(); // still here after Hide (F22)
  await inHelp.getByRole('button', { name: 'Show on my Dashboard' }).click();
  await page.goto('dashboard');
  await expect(steps).toBeVisible();

  await page.goto('help');
  await expect(page.getByRole('link', { name: /Feedback inbox/ })).toHaveCount(0); // players don't see the team inbox
  await page.getByRole('radio', { name: 'A problem' }).check();
  const text = `The chart froze once (${info.project.name} ${Date.now()}).`;
  await page.getByLabel('Your message').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Thank you!' })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await putAdmin(uid);
  await page.reload();
  await page.getByRole('link', { name: /Feedback inbox \(team\)/ }).click();
  await expect(page).toHaveURL(/\/help\/feedback$/);
  const msg = page.locator('li').filter({ hasText: text });
  await expect(msg).toContainText('A problem');
  await msg.getByRole('button', { name: 'Mark done' }).click();
  await expect(msg.getByRole('button', { name: 'Reopen' })).toBeVisible();
});
