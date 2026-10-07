/**
 * Smoke tests of the production build in a real browser, at phone and desktop sizes.
 * They check the shell's layout rules, navigation without page reloads, deep links,
 * persisted settings, accessibility (axe) and that nothing logs an error.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/firestore|firebase|net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('opens on the dashboard and has no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeAttached();
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('deep links load directly', async ({ page }) => {
  await page.goto('settings');
  await expect(page.getByRole('heading', { name: 'Theme' })).toBeVisible();
});

test('theme choice applies immediately and survives a reload', async ({ page }) => {
  await page.goto('settings');
  await page.getByRole('tab', { name: 'White' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'white');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'white');
});

for (const theme of ['black', 'blue', 'white']) {
  test(`no accessibility violations (${theme} theme)`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('zelosTheme', t), theme);
    for (const path of ['dashboard', 'settings', 'crypto']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeAttached();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
}

test.describe('phone', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 760, 'phone layout only');

  test('tab bar instead of sidebar; More sheet; navigation keeps the page', async ({ page }) => {
    await page.goto('dashboard');
    const tabbar = page.getByRole('navigation', { name: 'Main' }).filter({ has: page.getByRole('button', { name: 'More' }) });
    await expect(tabbar).toBeVisible();
    await expect(page.locator('aside')).toBeHidden();

    // a marker on window survives client-side navigation but not a reload
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    await tabbar.getByRole('link', { name: 'Markets' }).click();
    await expect(page).toHaveURL(/\/app\/markets$/);
    await tabbar.getByRole('button', { name: 'More' }).click();
    const sheet = page.getByRole('dialog', { name: 'More' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: 'Trade War' }).click();
    await expect(page).toHaveURL(/\/app\/trade-war$/);
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

    // touch targets in the tab bar are at least 44px tall
    const h = await tabbar.getByRole('link', { name: 'Markets' }).evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
    await noHorizontalScroll(page);
  });
});

test.describe('desktop', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) <= 760, 'desktop layout only');

  test('sidebar with every module; collapse is remembered', async ({ page }) => {
    await page.goto('dashboard');
    const side = page.locator('aside').getByRole('navigation', { name: 'Main' });
    await expect(side).toBeVisible();
    for (const name of ['Markets', 'Practice', 'Real Trading', 'Trade War', 'Options', 'Arcade', 'Settings']) await expect(side.getByRole('link', { name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More' })).toBeHidden();

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(side.getByText('Markets')).toBeHidden();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  });

  test('a classic module hands off to the classic page', async ({ page }) => {
    await page.goto('trade-war');
    await expect(page.getByRole('link', { name: /Open Trade War/ })).toHaveAttribute('href', '/practice/war.html');
  });
});
