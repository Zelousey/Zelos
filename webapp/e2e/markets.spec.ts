/**
 * The first core flow: Dashboard → Markets → Chart → Buy, against the
 * Firestore emulator seeded with real market docs (e2e/fixtures/markets.json).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import fixture from './fixtures/markets.json' with { type: 'json' };

const quotes = (fixture as { quotes: { quotes: Record<string, { c: number }> } }).quotes.quotes;
const price = (sym: string) => quotes[sym]!.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test('dashboard Market page shows index tiles, movers and sectors from live data', async ({ page }) => {
  await page.goto('dashboard?p=market');
  const spy = page.getByRole('link', { name: /S&P 500 \(SPY\)/ });
  await expect(spy).toContainText(price('SPY'));
  await expect(page.getByRole('list', { name: 'Gainers' }).getByRole('link').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Losers' }).click();
  await expect(page.getByRole('list', { name: 'Losers' })).toBeVisible();
  await expect(page.getByText('Sectors today')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Market (open|closed)/ })).toBeVisible();
});

test('full flow: dashboard → markets → search → chart → practice trade', async ({ page }) => {
  await page.goto('dashboard?p=market');
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
  // a day-trading stock opens on intraday bars (the fixture has none for NVDA): the timeframe row stays, so you can switch
  await expect(page.getByRole('radio', { name: 'Day Trading', checked: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '15m' })).toHaveAttribute('aria-selected', 'true');
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
  // the chart page remembers the symbol once it has loaded, so wait for it before leaving
  // (the address changes first; leaving straight away failed on main CI after #115)
  await expect(page.getByRole('heading', { name: 'QQQ', level: 1 })).toBeVisible();
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
  // a long-term symbol: daily and weekly charts (owner 2026-11-10; DIA has daily history in the fixture)
  await page.goto('markets/DIA');
  await expect(page.getByRole('radio', { name: 'Long Term', checked: true })).toBeVisible();
  await expect(page.getByText('DIA is a Long Term symbol, so the chart is in Long Term mode.')).toBeVisible();
  await expect(page.getByRole('img', { name: /DIA D price chart/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: '15m' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'W', exact: true }).click();
  await expect(page.getByRole('img', { name: /DIA W price chart/ })).toBeVisible();
  // a day-trading stock: intraday charts
  await page.goto('markets/AAPL');
  await expect(page.getByRole('radio', { name: 'Day Trading', checked: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /AAPL 15m price chart/ })).toBeVisible(); // AAPL has intraday bars in the fixture
  await expect(page.getByRole('tab', { name: 'W', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '5m' }).click();
  await expect(page.getByRole('img', { name: /AAPL 5m price chart/ })).toBeVisible();
  // candles are the default everywhere (owner 2026-10-27); line is one tap away
  await expect(page.getByRole('tab', { name: 'Candles' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Line' }).click();
  await page.getByRole('button', { name: 'Show data table' }).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(13); // header + 12 bars
  // the choice of timeframe is remembered (per mode)
  await page.reload();
  await expect(page.getByRole('tab', { name: '5m' })).toHaveAttribute('aria-selected', 'true');
  // ...but the line style is not: every chart opens as candles (owner 2026-10-27)
  await expect(page.getByRole('tab', { name: 'Candles' })).toHaveAttribute('aria-selected', 'true');
});

test('Day Trading / Long Term: Market changes its chart, Full Chart keeps the mode and explains a symbol change', async ({ page }) => {
  await page.goto('markets');
  await expect(page.getByRole('radio', { name: 'Day Trading', checked: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /SPY 15m price chart/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Long Term' }).click();
  // the first switch explains the two modes; SPY is a day-trading fund, so the chart moves to DIA
  await expect(page.getByText(/Both chart modes track actual stock prices/).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /DIA D price chart/ })).toBeVisible();
  await page.getByRole('link', { name: /Full chart/ }).click();
  await expect(page).toHaveURL(/\/app\/markets\/DIA$/);
  await expect(page.getByRole('radio', { name: 'Long Term', checked: true })).toBeVisible();
  // switching here to a mode DIA isn't in picks a compatible symbol and says so
  await page.getByRole('radio', { name: 'Day Trading' }).click();
  await expect(page).toHaveURL(/\/app\/markets\/SPY$/);
  const pop = page.getByRole('dialog', { name: 'Switched to SPY' });
  await expect(pop).toContainText('DIA is only available in Long Term');
  await pop.getByRole('button', { name: 'Change symbol' }).click();
  const sheet = page.getByRole('dialog', { name: 'Chart another symbol' });
  await expect(sheet).toContainText('Day Trading vs Long Term');
  await page.keyboard.press('Escape');
  await page.goto('markets');
  await expect(page.getByRole('radio', { name: 'Day Trading', checked: true })).toBeVisible();
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

test('a stock with no fresh price shows its last good one, marked delayed', async ({ page }) => {
  await page.goto('markets/UBER');
  await expect(page.getByRole('heading', { name: 'UBER' })).toBeVisible();
  await expect(page.getByText('Price feed delayed')).toBeVisible();
  await expect(page.getByLabel(`Price ${price('UBER')}`)).toBeVisible();
  await page.goto('markets/AAPL');
  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible();
  await expect(page.getByText('Price feed delayed')).toHaveCount(0);
});

test('all stocks come in two sections: day trading (every minute) and long-term (every 15 minutes)', async ({ page }) => {
  await page.goto('markets');
  // the last tab under the chart (owner 2026-11-08: one row of tabs, no separate "All stocks" box)
  const glance = page.getByRole('region', { name: 'Charts at a glance' });
  await glance.getByRole('tab', { name: 'All stocks' }).click();
  const list = page.getByRole('list', { name: 'All stocks' });
  await expect(page.getByRole('radio', { name: 'Day Trading', checked: true })).toBeVisible();
  await expect(page.getByText('Prices every minute. For trades you open and close the same day.')).toBeVisible();
  await expect(list.getByRole('link')).toHaveCount(8);
  await expect(list).toContainText('SPY');
  await expect(list).not.toContainText('TSLA');
  await page.getByRole('radio', { name: 'Long Term' }).click();
  await expect(page.getByText('Prices every 15 minutes. For trades you hold for days, weeks or longer.')).toBeVisible();
  await expect(list).toContainText('TSLA');
  await expect(list).not.toContainText('NVDA');
  // a search that matches the other section says where it is
  await glance.getByRole('searchbox').fill('nvi');
  await expect(page.getByText('It is in Day Trading.')).toBeVisible();
  await page.getByRole('button', { name: 'Day Trading' }).click();
  await expect(list.getByRole('link')).toHaveCount(1);
  await expect(list).toContainText('NVDA');
  // the choice is remembered
  await glance.getByRole('searchbox').fill('');
  await page.getByRole('radio', { name: 'Long Term' }).click();
  await page.reload();
  await glance.getByRole('tab', { name: 'All stocks' }).click();
  await expect(page.getByRole('radio', { name: 'Long Term', checked: true })).toBeVisible();
  // removed stocks aren't listed
  await expect(list).not.toContainText('Broadcom');
});

test('stock page: your position with its P&L, a Forecast plan that Buy carries, the tools on top', async ({ page }, info) => {
  const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
  await page.goto('markets/AAPL');
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  const uid = await page.evaluate(
    (e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid),
    `pos-${info.project.name}${Date.now()}@example.com`,
  );
  await fetch(`${BASE}/practiceAccounts/${uid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { v: { integerValue: 3 }, cash: { doubleValue: 9000 }, positions: { mapValue: { fields: { AAPL: { mapValue: { fields: { qty: { integerValue: 5 }, avg: { doubleValue: 300 }, openedDay: { stringValue: '2026-10-01' } } } } } } } } }),
  });
  // owner 2026-11-10: you already own it, so the page says so: a small rectangle per holding,
  // profit in green, tap it to open the trade
  const pos = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Your position · Solo' }) });
  const chip = pos.getByRole('link', { name: /5 shares/ });
  await expect(chip).toContainText('+$168.15'); // (333.63 - 300) × 5
  await expect(chip).toHaveAttribute('href', '/app/practice/trade/AAPL?side=sell');
  // the tools sit above the chart; Forecast puts a target and a stop on it, and Buy takes them along
  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  const [tb, cb] = await Promise.all([tools.boundingBox(), page.getByRole('img', { name: /^AAPL .* price chart$/ }).boundingBox()]);
  expect(tb!.y).toBeLessThan(cb!.y);
  await tools.getByRole('button', { name: 'Forecast' }).click();
  await expect(tools.getByRole('button', { name: 'Forecast' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: /Target[\s\S]*Stop/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy AAPL' }).filter({ visible: true }).first()).toHaveAttribute('href', /\/practice\/trade\/AAPL\?side=buy&sl=\d+\.\d\d&tp=\d+\.\d\d$/);
  await expect(tools.getByRole('link', { name: 'Trade options' })).toHaveAttribute('href', '/app/options/AAPL');
  // Chart settings sits up top with Switch and Watch and opens the chart part of Settings
  await page.getByRole('link', { name: 'Chart settings' }).click();
  await expect(page).toHaveURL(/\/app\/settings#chart$/);
  await expect(page.getByRole('radio', { name: /color-blind safe/ })).toBeInViewport();
});
