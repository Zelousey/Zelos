/**
 * The first core flow: Dashboard → Markets → Chart → Practice trade, against the
 * Firestore emulator seeded with real market docs (e2e/fixtures/markets.json).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import fixture from './fixtures/markets.json' with { type: 'json' };

const quotes = (fixture as { quotes: { quotes: Record<string, { c: number }> } }).quotes.quotes;
const price = (sym: string) => quotes[sym]!.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test('dashboard shows index tiles, movers and sectors from live data', async ({ page }) => {
  await page.goto('dashboard');
  const spy = page.getByRole('link', { name: /S&P 500 \(SPY\)/ });
  await expect(spy).toContainText(price('SPY'));
  await expect(page.getByRole('list', { name: 'Gainers' }).getByRole('link').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Losers' }).click();
  await expect(page.getByRole('list', { name: 'Losers' })).toBeVisible();
  await expect(page.getByText('Sectors today')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Market (open|closed)/ })).toBeVisible();
});

test('full flow: dashboard → markets → search → chart → practice trade', async ({ page }) => {
  await page.goto('dashboard');
  await page.getByRole('link', { name: 'All markets →' }).click();
  await expect(page).toHaveURL(/\/app\/markets$/);
  await page.getByRole('searchbox').fill('nvi');
  const rows = page.getByRole('list', { name: 'Markets' }).getByRole('link');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('NVDA');
  await expect(rows.first()).toContainText(price('NVDA'));
  await rows.first().click();
  await expect(page).toHaveURL(/\/app\/markets\/NVDA$/);
  await expect(page.getByRole('heading', { level: 1, name: 'NVDA' })).toBeVisible();
  await expect(page.getByRole('img', { name: /NVDA .* price chart/ })).toBeVisible();
  await page.getByRole('link', { name: /Practice trade/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/app\/practice\/trade\/NVDA$/);
});

test('chart: timeframes, ranges, styles and the data table', async ({ page }) => {
  await page.goto('markets/AAPL');
  const chart = page.getByRole('img', { name: /AAPL D price chart/ });
  await expect(chart).toBeVisible();
  await page.getByRole('tab', { name: 'W', exact: true }).click();
  await expect(page.getByRole('img', { name: /AAPL W price chart/ })).toBeVisible();
  await page.getByRole('tab', { name: '15m' }).click();
  await expect(page.getByRole('img', { name: /AAPL 15m price chart/ })).toBeVisible(); // AAPL has intraday bars in the fixture
  await page.getByRole('tab', { name: 'Candles' }).click();
  await page.getByRole('button', { name: 'Show data table' }).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(13); // header + 12 bars
  // the choice of timeframe is remembered
  await page.reload();
  await expect(page.getByRole('tab', { name: '15m' })).toHaveAttribute('aria-selected', 'true');
});

test('intraday without bars explains itself; unknown symbols are handled', async ({ page }) => {
  await page.goto('markets/MSFT');
  await page.getByRole('tab', { name: '1H' }).click();
  await expect(page.getByText(/Intraday bars build up during market hours/)).toBeVisible();
  await page.goto('markets/ZZZZ');
  await expect(page.getByText('No data for ZZZZ')).toBeVisible();
  await page.goto('markets/%3Cscript%3E');
  await expect(page.getByText('No data for ?')).toBeVisible();
});

test('Charts opens the last symbol viewed', async ({ page }) => {
  await page.goto('markets/QQQ');
  await expect(page.getByRole('heading', { level: 1, name: 'QQQ' })).toBeVisible();
  await page.goto('charts');
  await expect(page).toHaveURL(/\/app\/markets\/QQQ$/);
});

test('no accessibility violations on data screens', async ({ page }) => {
  for (const path of ['dashboard', 'markets', 'markets/AAPL']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeAttached();
    await page.waitForTimeout(800);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('phone: chart controls fit one row and the trade bar is above the tab bar', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) > 760, 'phone only');
  await page.goto('markets/AAPL');
  const bar = page.getByRole('link', { name: 'Practice trade · AAPL' });
  await expect(bar).toBeVisible();
  const tabbar = page.getByRole('navigation', { name: 'Main' }).filter({ has: page.getByRole('button', { name: 'More' }) });
  const [b, tb] = await Promise.all([bar.boundingBox(), tabbar.boundingBox()]);
  expect(b!.y + b!.height).toBeLessThanOrEqual(tb!.y + 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
