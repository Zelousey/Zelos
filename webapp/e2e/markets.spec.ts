/**
 * The first core flow: Dashboard → Markets → Chart → Buy, against the
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
  const rows = page.getByRole('list', { name: 'Market' }).getByRole('link');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('NVDA');
  await expect(rows.first()).toContainText(price('NVDA'));
  await rows.first().click();
  await expect(page).toHaveURL(/\/app\/markets\/NVDA$/);
  await expect(page.getByRole('heading', { level: 1, name: 'NVDA' })).toBeVisible();
  await expect(page.getByRole('img', { name: /NVDA .* price chart/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sell NVDA' }).filter({ visible: true }).first()).toHaveAttribute('href', '/app/practice/trade/NVDA?side=sell');
  await page.getByRole('link', { name: 'Buy NVDA' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/app\/practice\/trade\/NVDA\?side=buy$/);
  await expect(page.getByRole('link', { name: 'Open Practice' })).toBeVisible(); // signed out: asks to open the account
});

test('Market: world markets, sectors, mini charts and the stock list', async ({ page }) => {
  await page.goto('markets');
  // opens on the index chart; the globe is one tap away and the choice is remembered
  await expect(page.getByRole('heading', { name: 'US indexes' })).toBeVisible();
  await expect(page.getByRole('img', { name: /SPY/ }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Globe' }).click();
  await expect(page.getByRole('heading', { name: 'World markets' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Stock exchanges' }).getByRole('listitem')).toHaveCount(17);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'World markets' })).toBeVisible();
  await page.getByRole('tab', { name: 'Chart' }).click();
  await expect(page.getByRole('heading', { name: 'US indexes' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Sectors today' })).toBeVisible();
  // mini charts of the index ETFs, from daily history + the live quote
  const minis = page.getByRole('list', { name: 'Indexes & ETFs' });
  const spy = minis.getByRole('link', { name: /^SPY,/ });
  await expect(spy).toContainText(price('SPY'));
  await expect(spy).toHaveAccessibleName(/over the last month/);
  // movers outside the Zelos list have no chart, so they aren't shown
  await page.getByRole('tab', { name: 'Gainers' }).click();
  await expect(page.getByText('Movers show up after the first prices of the session.')).toBeVisible();
  await page.getByRole('tab', { name: 'Indexes & ETFs' }).click();
  await page.getByRole('list', { name: 'Indexes & ETFs' }).getByRole('link', { name: /^QQQ,/ }).click();
  await expect(page).toHaveURL(/\/app\/markets\/QQQ$/);
  await page.goto('markets');
  await page.getByRole('link', { name: 'Open charts' }).click();
  await expect(page).toHaveURL(/\/app\/markets\/QQQ$/); // the last chart you looked at
});

test('big chart: switch symbols from the search sheet and the mini-chart previews', async ({ page }) => {
  await page.goto('markets/AAPL');
  await page.getByRole('button', { name: 'Change symbol' }).click();
  const sheet = page.getByRole('dialog', { name: 'Chart another symbol' });
  await sheet.getByRole('searchbox').fill('micro');
  await sheet.getByRole('link', { name: /MSFT/ }).click();
  await expect(page).toHaveURL(/\/app\/markets\/MSFT$/);
  await expect(page.getByRole('heading', { level: 1, name: 'MSFT' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // previews: the current chart is marked, a recent one is one tap away
  const previews = page.getByRole('region', { name: 'Switch chart' });
  await expect(previews.getByRole('link', { name: /^MSFT,/ })).toHaveAttribute('aria-current', 'page');
  await previews.getByRole('link', { name: /^AAPL,/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AAPL' })).toBeVisible();
  // the chart is big: most of the screen height
  const box = await page.getByRole('img', { name: /AAPL .* price chart/ }).boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box!.height).toBeGreaterThanOrEqual(Math.min(420, vh * 0.35));
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
  // ...but candles are not: every chart opens as a line (owner 2026-10-09)
  await expect(page.getByRole('tab', { name: 'Line' })).toHaveAttribute('aria-selected', 'true');
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
  const bar = page.getByRole('link', { name: 'Buy AAPL' }).filter({ visible: true });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sell AAPL' }).filter({ visible: true })).toBeVisible();
  const tabbar = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  const [b, tb] = await Promise.all([bar.boundingBox(), tabbar.boundingBox()]);
  expect(b!.y + b!.height).toBeLessThanOrEqual(tb!.y + 1);
  // the timeframe tabs start the row and are never squeezed
  const tf = await page.getByRole('tab', { name: '15m' }).boundingBox();
  expect(tf!.x).toBeGreaterThanOrEqual(0);
  expect(tf!.width).toBeGreaterThan(24);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
