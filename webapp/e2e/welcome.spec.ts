/**
 * First open and first sign-in: the launch animation, the welcome screens (name, @username
 * saved by the server, experience, the $10,000 account, a first trade) and the First steps
 * checklist on the Dashboard. The welcome flow needs the Functions emulator.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });
test.use({ storageState: { cookies: [], origins: [] } }); // first open: splash and welcome on

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const put = (path: string, fields: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id);

test('the launch animation plays on open, then gets out of the way', async ({ page }) => {
  await page.goto('dashboard');
  const splash = page.locator('#zsplash');
  await expect(splash).toBeVisible();
  await expect(splash.getByText('ZELOS')).toBeVisible();
  await expect(splash).toHaveCount(0, { timeout: 5_000 }); // about a second, then removed
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
});

test('tap skips the launch animation', async ({ page }) => {
  await page.goto('markets');
  await page.locator('#zsplash').click();
  await expect(page.locator('#zsplash')).toHaveCount(0, { timeout: 1_000 });
});

test.describe('first sign-in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

  test('welcome: name and @username, experience, $10,000 account, first trade; then First steps', async ({ page }, info) => {
    const id = `${info.project.name}${Date.now()}`.toLowerCase();
    const uname = `w_${id.slice(-14)}`;
    // someone already has this one
    await put(`usernames/taken_${id.slice(-10)}`, { uid: { stringValue: 'someoneelse' } });

    await page.goto('dashboard');
    await signIn(page, `welcome-${id}@example.com`);
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Welcome to Zelos Trade War' })).toBeVisible();
    await page.getByLabel('Your name').fill('Ada');
    const user = page.getByLabel('Your @username');
    await user.fill(`taken_${id.slice(-10)}`);
    await expect(page.getByText(/is taken/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.fill(uname);
    await expect(page.getByText(`@${uname} is available`)).toBeVisible();
    await page.getByText('New to trading').click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Profile saved · +25 XP')).toBeVisible();

    await expect(page.getByRole('heading', { name: '$10,000 to practice with' })).toBeVisible();
    await page.getByRole('button', { name: 'Open my $10,000 account' }).click();
    await expect(page.getByRole('heading', { name: 'Make your first trade' })).toBeVisible();
    await expect(page.getByText(/Start small/)).toBeVisible(); // simpler words for new traders
    await expect(page.getByRole('link', { name: 'About coaching' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('link', { name: 'I’ll do it later' }).click();

    // Dashboard: the checklist knows what's done; no redirect any more
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Welcome, Ada')).toBeVisible();
    const steps = page.getByRole('region', { name: 'First steps' }).or(page.locator('section').filter({ has: page.getByRole('heading', { name: 'First steps' }) }));
    await expect(steps.getByText('2 of 4 done')).toBeVisible();
    await expect(steps.getByRole('link', { name: /Make your first trade/ })).toHaveAttribute('href', /\/markets$/);
    await expect(steps.getByText('Find a coach')).toBeVisible();
    await steps.getByRole('button', { name: 'Hide' }).click();
    await expect(page.getByRole('heading', { name: 'First steps' })).toHaveCount(0);
  });

  test('skip for now: back to the Dashboard, and the welcome stays away', async ({ page }, info) => {
    await page.goto('dashboard');
    await signIn(page, `skip-${info.project.name}${Date.now()}@example.com`);
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: /Pick your name and @username/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'First steps' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
