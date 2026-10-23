/**
 * Hall of Minds (owner 2026-10-22/23): the opening book animation, the red-card grid with its
 * tabs, a figure's story, accounts, who they learned from, lessons and explained quotes, and (with
 * the Functions emulator) reading a lesson for XP and turning on a figure's daily quotes with tokens.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
async function signIn(page: Page, who: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((email) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(email, 'secret123').then((c) => c.user.uid), `${who}@example.com`);
}
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

test('the opening book flips through a few great minds, once per visit, and can be skipped', async ({ page }) => {
  await page.goto('minds');
  const skip = page.getByRole('button', { name: 'Skip' });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(skip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hall of Minds', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0); // once per visit
});

test('the grid: one red card per great mind, with market legends on their own tab', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no opening animation
  await page.goto('minds');
  await expect(page.getByRole('heading', { name: 'Hall of Minds', level: 1 })).toBeVisible();
  const grid = page.getByRole('list', { name: 'Hall of Minds' });
  await expect(grid.getByRole('link')).toHaveCount(11);
  await expect(grid.getByRole('link', { name: /^Napoleon Bonaparte, War strategist/ })).toBeVisible();
  await expect(grid.getByRole('link', { name: / vs / })).toHaveCount(0); // no head-to-heads (owner 2026-10-23)
  await page.getByRole('tab', { name: 'Market legends' }).click();
  await expect(grid.getByRole('link')).toHaveCount(4);
  await expect(grid.getByRole('link', { name: /^Jesse Livermore, Trader/ })).toBeVisible();
  await axe(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a figure: lessons with a trading takeaway, real quotes explained in plain words', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds');
  await page.getByRole('link', { name: /^Napoleon Bonaparte/ }).click();
  await expect(page).toHaveURL(/\/app\/minds\/napoleon$/);
  await expect(page.getByRole('heading', { name: 'Napoleon Bonaparte', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lessons from Napoleon' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lessons from Napoleon' }).getByRole('heading', { level: 3 })).toHaveCount(4);
  await expect(page.getByText('Use it in trading').first()).toBeVisible();
  await expect(page.getByText(/Read over and over again the campaigns of Alexander/)).toBeVisible();
  await expect(page.getByText(/Military Maxims of Napoleon, Maxim 78/).first()).toBeVisible();
  await expect(page.getByText('In plain words').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to turn on' })).toBeVisible();
  // the deeper sections: their story, accounts with sources, and a words-only modern comparison
  await expect(page.getByRole('heading', { name: 'Their story' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How they carried themselves' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fighting next to his men' })).toBeVisible();
  await expect(page.getByText(/the little corporal/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Then & now: Napoleon and Elon Musk' })).toBeVisible();
  await expect(page.getByText(/aren.t connected to Zelos and don.t endorse it/)).toBeVisible();
  await axe(page);
  // who he learned from, linking to their pages
  await expect(page.getByRole('heading', { name: 'Who they learned from' })).toBeVisible();
  await page.getByRole('link', { name: 'Meet Alexander the Great →' }).click();
  await expect(page).toHaveURL(/\/app\/minds\/alexander$/);
  await expect(page.getByRole('heading', { name: 'Alexander the Great', level: 1 })).toBeVisible();
  // the old head-to-head pages go to the grid
  await page.goto('minds/vs/alexander-napoleon');
  await expect(page).toHaveURL(/\/app\/minds$/);
  // a daily-quote notification opens the figure on that quote
  await page.goto('minds/caesar?q=believe');
  await expect(page.getByText('Men willingly believe what they wish.', { exact: false })).toBeInViewport();
  await page.goto('minds/elon');
  await expect(page.getByText('That page isn’t in the Hall of Minds.')).toBeVisible();
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
  test('read a lesson for XP, then turn on daily quotes for 15 tokens', async ({ page }, info) => {
    await page.goto('minds/tesla');
    const uid = await signIn(page, `minds-${info.project.name}-${Date.now()}`);
    const lesson = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Build it in your head first' }) });
    await lesson.getByRole('button', { name: 'Done reading · +10 XP' }).click();
    await expect(page.getByText('+10 XP', { exact: true })).toBeVisible();
    await expect(lesson.getByText('Read ✓')).toBeVisible();
    await expect(page.getByText('1 of 4 lessons read')).toBeVisible();
    await fetch(`${BASE}/wallets/${uid}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { balance: { integerValue: '20' } } }) });
    await page.getByRole('button', { name: 'Turn on · 15 tokens' }).click();
    await expect(page.getByText('Daily quotes from Nikola are on for 30 days')).toBeVisible();
    await expect(page.getByText(/^On until /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add 30 days · 15 tokens' })).toBeVisible();
  });
});
