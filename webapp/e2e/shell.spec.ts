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
    for (const path of ['dashboard', 'settings', 'crypto', 'news', 'trade-war']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeAttached();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
}

test.describe('phone', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 760, 'phone layout only');

  test('five-tab bar; ☰ menu top-right; navigation keeps the page', async ({ page }) => {
    await page.goto('dashboard');
    const tabbar = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
    await expect(tabbar).toBeVisible();
    await expect(page.locator('aside')).toBeHidden();
    await expect(tabbar.getByRole('link')).toHaveText(['Dashboard', 'Market', 'Trade War', 'Alerts', /^News/]);
    await expect(tabbar.getByRole('link', { name: /^News\s*, new posts$/ })).toBeVisible();

    // top bar: Profile, Notifications, then the menu, in that order on the right
    const [p, b, m] = await Promise.all([
      page.getByRole('button', { name: 'Profile' }).boundingBox(),
      page.getByRole('button', { name: /Open notifications/ }).boundingBox(),
      page.getByRole('button', { name: 'Open menu' }).boundingBox(),
    ]);
    expect(p!.x).toBeLessThan(b!.x);
    expect(b!.x).toBeLessThan(m!.x);

    // a marker on window survives client-side navigation but not a reload
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    await tabbar.getByRole('link', { name: 'Market' }).click();
    await expect(page).toHaveURL(/\/app\/markets$/);
    await tabbar.getByRole('link', { name: 'Trade War' }).click();
    await expect(page).toHaveURL(/\/app\/trade-war$/);
    await expect(page.getByRole('heading', { name: /Your practice account/ })).toBeVisible();

    await page.getByRole('button', { name: 'Open menu' }).click();
    const sheet = page.getByRole('dialog', { name: 'Menu' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

    // Practice belongs to Trade War: that tab stays selected
    await page.goto('practice');
    await expect(tabbar.getByRole('link', { name: 'Trade War' })).toHaveClass(/active/);

    // touch targets in the tab bar are at least 44px tall
    const h = await tabbar.getByRole('link', { name: 'Market' }).evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
    await noHorizontalScroll(page);
  });

  test('News: unseen dot until visited; featured post and filters', async ({ page }) => {
    await page.goto('dashboard');
    const tabbar = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
    await expect(tabbar.locator('[data-new-dot]')).toBeVisible();
    await tabbar.getByRole('link', { name: /^News/ }).click();
    await expect(page.getByText('Featured')).toBeVisible();
    await expect(tabbar.locator('[data-new-dot]')).toHaveCount(0);
    await expect(tabbar.getByRole('link', { name: 'News', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Trade War', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Practice accounts now run on Zelos servers/ })).toBeVisible();
    await expect(page.getByText('Featured')).toBeHidden();
    await noHorizontalScroll(page);
  });
});

test.describe('desktop', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) <= 760, 'desktop layout only');

  test('sidebar with every module; collapse is remembered', async ({ page }) => {
    await page.goto('dashboard');
    const side = page.locator('aside').getByRole('navigation', { name: 'Main' });
    await expect(side).toBeVisible();
    for (const name of ['Market', 'Trade War', 'Alerts', 'Practice', 'Options', 'Arcade', 'Settings']) await expect(side.getByRole('link', { name, exact: true })).toBeVisible();
    await expect(side.getByRole('link', { name: /^News/ })).toBeVisible();
    await expect(side.getByRole('link', { name: /Real Trading|Charts/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(side.getByText('Market', { exact: true })).toBeHidden();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    // a short window: the collapse button stays above Dashboard (the sidebar scrolls, it doesn't squeeze)
    await page.setViewportSize({ width: 1280, height: 420 });
    const toggle = await page.getByRole('button', { name: 'Expand sidebar' }).boundingBox();
    const home = await side.getByRole('link', { name: 'Dashboard', exact: true }).boundingBox();
    expect(toggle!.y + toggle!.height).toBeLessThanOrEqual(home!.y);
  });

  test('a classic module hands off to the classic page', async ({ page }) => {
    await page.goto('arcade');
    await expect(page.getByRole('link', { name: /Open Arcade/ })).toHaveAttribute('href', '/arcade.html');
  });
});
