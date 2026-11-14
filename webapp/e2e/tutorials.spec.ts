/**
 * Tutorials (Phase 8, F20 + F21): the first-trade walkthrough opens by itself before your first
 * trade, points at each control, never places an order, is remembered once done or skipped, and
 * replays from Help. Works with reduced motion. (Other tests start with it marked as skipped.)
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const account = (uid: string) => fetch(`${BASE}/practiceAccounts/${uid}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json() as Promise<{ fields?: Record<string, { mapValue?: { fields?: object } }> }>);
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const card = (page: Page) => page.getByRole('dialog').filter({ hasText: /Step \d of 4/ });

test.beforeEach(async ({ page }) => {
  // this file tests the walkthrough itself: start as someone who hasn't seen it (once per test, so "seen" can stick)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('tourReset')) {
      localStorage.removeItem('zelosTours');
      sessionStorage.setItem('tourReset', '1');
    }
  });
});

test('first trade: the walkthrough points at each control, places nothing, is remembered, and replays from Help', async ({ page }, info) => {
  await page.goto('dashboard');
  const uid = await signIn(page, `tour-${info.project.name}-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();

  await page.goto('practice/trade/AAPL');
  const c = card(page);
  await expect(c).toBeVisible();
  await expect(c).toContainText('Step 1 of 4');
  await expect(c.getByRole('heading', { name: 'Buy or sell' })).toBeVisible();
  await expect(c).toBeFocused();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await c.getByRole('button', { name: 'Next' }).click();
  await expect(c.getByRole('heading', { name: 'Order type' })).toBeVisible();
  await c.getByRole('button', { name: 'Back' }).click();
  await expect(c.getByRole('heading', { name: 'Buy or sell' })).toBeVisible();
  for (const h of ['Order type', 'How many shares', 'Review, then place it']) {
    await c.getByRole('button', { name: 'Next' }).click();
    await expect(c.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(c).toContainText('Nothing is bought until you tap Place order');
  if (process.env.SHOTS) {
    await page.waitForTimeout(800); // let the scroll and the highlight slide settle
    await page.screenshot({ path: `${process.env.SHOTS}/tour-${info.project.name}.png` });
  }
  await c.getByRole('button', { name: 'Got it' }).click();
  await expect(c).toHaveCount(0);
  // the walkthrough never trades: no order, no position
  const a = await account(uid);
  expect(Object.keys(a.fields?.orders?.mapValue?.fields ?? {})).toEqual([]);
  expect(Object.keys(a.fields?.positions?.mapValue?.fields ?? {})).toEqual([]);

  // remembered: it doesn't come back by itself
  await page.reload();
  await expect(page.getByLabel('Shares', { exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(card(page)).toHaveCount(0);

  // ...but replays from Help, and Esc skips
  await page.goto('help');
  const tours = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tutorials' }) });
  await expect(tours).toContainText('Seen');
  await tours.getByRole('link', { name: 'Replay: Your first trade' }).click();
  await expect(page).toHaveURL(/\/practice\/trade\/AAPL\?tour=first-trade$/);
  await expect(card(page)).toContainText('Step 1 of 4');
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  // and from the ticket itself
  await page.getByRole('button', { name: 'Show me how this works' }).click();
  await expect(card(page)).toContainText('Step 1 of 4');
});

test('reduced motion: the walkthrough works the same', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('dashboard');
  await signIn(page, `tourrm-${info.project.name}-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  await page.goto('practice/trade/MSFT');
  const c = card(page);
  await expect(c).toBeVisible();
  for (let i = 0; i < 3; i++) await c.getByRole('button', { name: 'Next' }).click();
  await expect(c).toContainText('Step 4 of 4');
  await c.getByRole('button', { name: 'Skip' }).click();
  await expect(c).toHaveCount(0);
});

test('help button: a short message comes out of it now and then and fades by itself; the button opens the page’s tour; never over Sign in', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.removeItem('zelosPageToursOff'));
  const tour = page.getByRole('dialog').filter({ hasText: /Step \d+ of \d+/ });
  const bubble = page.getByRole('status').filter({ hasText: 'I’m here to help!' });
  // signed out: nothing opens or talks by itself, and Sign in works (2026-11-13: a tour card covered it)
  await page.goto('dashboard');
  await page.waitForTimeout(2500);
  await expect(tour).toHaveCount(0);
  await expect(bubble).toHaveCount(0);
  await page.getByRole('button', { name: /^Sign in( to start)?$/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible();
  await page.keyboard.press('Escape');
  // a new player: the message comes out of the help button on a page they haven't toured, no tour
  // opens by itself, and the message goes away without anyone pressing anything
  await signIn(page, `ptour-${info.project.name}-${Date.now()}@example.com`);
  await page.goto('markets');
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText('Need information about this page?');
  await expect(tour).toHaveCount(0);
  await expect(bubble).toHaveCount(0, { timeout: 10_000 });
  // the help button opens this page's tour
  await page.getByRole('button', { name: 'Help with Market' }).click();
  await expect(tour.getByRole('heading', { name: 'The market at a glance' })).toBeVisible();
  await expect(tour).toBeFocused();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  for (let i = 0; i < 10 && (await tour.getByRole('button', { name: 'Got it' }).count()) === 0; i++) await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('button', { name: 'Got it' }).click();
  await expect(tour).toHaveCount(0);
  // just shown: no message on the next visit
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(bubble).toHaveCount(0);
  // days later the message comes back, and tapping it opens the tour
  await page.evaluate(() => {
    localStorage.setItem('zelosPageHelp', JSON.stringify({ 'page-market': 1 }));
    localStorage.setItem('zelosPageHelpAt', '1');
  });
  await page.reload();
  await bubble.click();
  await expect(tour.getByRole('heading', { name: 'The market at a glance' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);

  // a tap outside a tour card closes it and still reaches what was tapped
  await page.goto('learn');
  await page.getByRole('button', { name: 'Help with Trading 101' }).click();
  await expect(tour.getByRole('heading', { name: 'Trading 101' })).toBeVisible();
  await page.getByRole('link', { name: /^Book 1: Stock trading fundamentals/ }).click();
  await expect(page).toHaveURL(/\/learn\/basics$/);
  await expect(tour).toHaveCount(0);
  // Help lists every page's tour and replays it on its page
  await page.goto('help');
  await expect(page.getByRole('link', { name: /^Replay: / })).toHaveCount(17);
  await page.getByRole('link', { name: 'Replay: Coaching' }).click();
  await expect(page).toHaveURL(/\/app\/coach\?tour=page-coach$/);
  await expect(tour.getByRole('heading', { name: 'Coaching' })).toBeVisible();
});
