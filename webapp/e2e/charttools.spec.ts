/**
 * Chart tools on the stock page (owner 2026-10-10): indicators, Fibonacci, and price alerts
 * placed on the chart, listed, removed, and fired from the live quote while the app is open;
 * signed in, they're saved on the account (users.twAlerts) for the server to check.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('chart tools: indicators, Fibonacci, place / remove / fire price alerts', async ({ page }) => {
  // an alert that the fixture quote (AAPL $333.63) has already crossed fires once on load
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('zelosTwAlerts', JSON.stringify([{ id: 'seed1', sym: 'AAPL', price: 300, dir: 'above', status: 'active', createdAt: 1, updatedAt: 1 }]));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('markets/AAPL');
  await expect(page.getByText('Price alert: AAPL ≥ 300.00 (now 333.63)')).toBeVisible();

  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  await tools.getByRole('button', { name: 'Indicators' }).click();
  const sheet = page.getByRole('dialog', { name: 'Indicators' });
  await sheet.getByLabel('MACD (12, 26, 9)').check();
  await expect(sheet.getByLabel('MACD (12, 26, 9)')).toBeChecked();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zelosPracticeInd') || '{}').macd)).toBe(true);

  // Fibonacci is a menu on the stock page (step 4): the automatic retracement is its first item
  await tools.getByRole('button', { name: 'Fibonacci' }).click();
  await page.getByRole('menu', { name: 'Fibonacci' }).getByRole('menuitemcheckbox', { name: /Auto retracement/ }).click();
  await tools.getByRole('button', { name: 'Fibonacci' }).click();
  await expect(page.getByRole('menu', { name: 'Fibonacci' }).getByRole('menuitemcheckbox', { name: /Auto retracement/ })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');

  await tools.getByRole('button', { name: /Alert/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tap the price you want to watch' })).toBeVisible();
  const chart = page.getByRole('img', { name: /^AAPL .* price chart$/ });
  await chart.scrollIntoViewIfNeeded(); // the chart is taller now (owner 2026-11-10): bring it on screen before tapping it
  const box = (await chart.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
  const list = page.getByRole('list', { name: 'Price alerts for AAPL' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(/Alert when AAPL is at or (above|below) \d/);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await list.getByRole('button', { name: /Remove the/ }).click();
  await expect(list).toHaveCount(0);
});

test('signed in: price alerts are saved on the account, where the server checks them', async ({ page }, info) => {
  const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
  const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
  await page.goto('markets/AAPL');
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  const uid = await page.evaluate(
    (e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid),
    `charts-${info.project.name}${Date.now()}@example.com`,
  );
  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  await expect(page.getByRole('button', { name: /Watch|Watching/ })).toBeVisible(); // signed-in layout has settled
  await tools.getByRole('button', { name: /Alert/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tap the price you want to watch' })).toBeVisible();
  const chart = page.getByRole('img', { name: /^AAPL .* price chart$/ });
  await chart.scrollIntoViewIfNeeded(); // the chart is taller now (owner 2026-11-10): bring it on screen before tapping it
  const box = (await chart.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
  const list = page.getByRole('list', { name: 'Price alerts for AAPL' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Signed in, you’ll get a notification when one is crossed, even with Zelos closed')).toBeVisible();
  await expect.poll(async () => (await get(`users/${uid}`)).fields?.twAlertsActive?.integerValue).toBe('1');
  const saved = (await get(`users/${uid}`)).fields.twAlerts.arrayValue.values[0].mapValue.fields;
  expect(saved.sym.stringValue).toBe('AAPL');

  // the server fires it while the app is away (status triggered, newer updatedAt): coming back shows it gone
  const id = saved.id.stringValue;
  await fetch(`${BASE}/users/${uid}?updateMask.fieldPaths=twAlerts&updateMask.fieldPaths=twAlertsActive`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        twAlertsActive: { integerValue: '0' },
        twAlerts: { arrayValue: { values: [{ mapValue: { fields: { ...saved, id: { stringValue: id }, status: { stringValue: 'triggered' }, updatedAt: { integerValue: String(Date.now() + 60000) } } } }] } },
      },
    }),
  });
  await page.reload();
  await expect(tools.getByRole('button', { name: /Alert/ })).toBeVisible();
  await expect(list).toHaveCount(0);
});

// owner 2026-11-10: pinching and dragging the chart on a phone
test('phone: pinch zooms the chart, one finger drags it sideways, a double tap resets', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) > 760, 'phone only');
  await page.goto('markets/AAPL');
  const canvas = page.getByRole('img', { name: /^AAPL .* price chart$/ });
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !!(document.querySelector('canvas') as unknown as { __ztc?: { s?: unknown } })?.__ztc?.s);
  const range = () => page.evaluate(() => { const c = (document.querySelector('canvas') as unknown as { __ztc: { from: number; to: number } }).__ztc; return { from: c.from, to: c.to }; });
  const b = (await canvas.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = b.y + b.height * 0.45, cx = b.x + b.width * 0.5;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, yy], id) => ({ x, y: yy, id })) });
  // a long press doesn't select the chart or the tabs (iOS Copy / Look Up bar)
  expect(await canvas.evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
  expect(await page.getByRole('tab', { name: '15m' }).evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
  const before = await range();
  const span0 = before.to - before.from;
  // pinch out: fingers move apart, fewer bars on screen
  await touch('touchStart', [[cx - 30, y], [cx + 30, y]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 30 - i * 15, y], [cx + 30 + i * 15, y]]);
  await touch('touchEnd', []);
  const zoomed = await range();
  expect(zoomed.to - zoomed.from).toBeLessThan(span0 * 0.6);
  // the page did not scroll sideways or zoom
  expect(await page.evaluate(() => (window.visualViewport?.scale ?? 1))).toBe(1);
  // one finger, slightly diagonal, drags the chart to earlier bars
  const sy = await page.evaluate(() => window.scrollY);
  await touch('touchStart', [[cx - 60, y]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 60 + i * 20, y + i * 4]]);
  await touch('touchEnd', []);
  const dragged = await range();
  expect(dragged.to).toBeLessThan(zoomed.to);
  expect(await page.evaluate(() => window.scrollY)).toBe(sy);
  // a double tap goes back to the chosen range
  for (let k = 0; k < 2; k++) { await touch('touchStart', [[cx, y]]); await touch('touchEnd', []); }
  await expect.poll(async () => { const r = await range(); return r.to - r.from; }).toBe(span0);
});

// owner's chart plan step 3 (2026-11-12): the Draw menu and the Measure tool on the stock page
test('draw a trend line (saved for this stock), measure a move, undo', async ({ page }) => {
  await page.goto('markets/AAPL');
  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  await tools.getByRole('button', { name: 'Draw' }).click();
  const menu = page.getByRole('menu', { name: 'Draw' });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(11); // 8 drawing tools + 3 forecast tools (step 6)
  await menu.getByRole('radio', { name: 'Green' }).click();
  await menu.getByRole('menuitemradio', { name: 'Trend line' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Trend line' })).toBeVisible();
  const layer = page.getByTestId('draw-layer');
  await layer.scrollIntoViewIfNeeded();
  const b = (await layer.boundingBox())!;
  const drag = async (x0: number, y0: number, x1: number, y1: number) => {
    await page.mouse.move(b.x + b.width * x0, b.y + b.height * y0);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * x1, b.y + b.height * y1, { steps: 6 });
    await page.mouse.up();
  };
  await drag(0.2, 0.35, 0.6, 0.2);
  await expect(page.getByTestId('draw-layer')).toHaveCount(0); // one drawing per pick, then the chart pans again
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('zelosAppDrawings:AAPL') || '[]') as { k: string; c: string }[]);
  expect((await saved()).map((x) => [x.k, x.c])).toEqual([['line', 'green']]);
  // measure: drag across the chart; it shows until hidden and is never saved
  await tools.getByRole('button', { name: 'Measure' }).click();
  await drag(0.25, 0.32, 0.55, 0.22);
  await expect(page.getByRole('status').filter({ hasText: 'Measured' })).toBeVisible();
  expect((await saved()).length).toBe(1);
  // drawings come back with the stock
  await page.reload();
  await tools.getByRole('button', { name: 'Draw' }).click();
  await expect(menu.getByRole('menuitem', { name: 'Clear all drawings (1)' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Undo last drawing' }).click();
  expect(await saved()).toEqual([]);
});

// owner's chart plan step 6 (2026-11-12): anchored VWAP, bars pattern and ghost feed
test('forecast drawings: anchored VWAP, bars pattern and ghost feed are saved for the stock', async ({ page }) => {
  await page.goto('markets/AAPL');
  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  const menu = page.getByRole('menu', { name: 'Draw' });
  const box = async () => {
    const layer = page.getByTestId('draw-layer');
    await layer.scrollIntoViewIfNeeded();
    return (await layer.boundingBox())!;
  };
  const pick = async (name: string) => {
    await tools.getByRole('button', { name: 'Draw' }).click();
    await menu.getByRole('menuitemradio', { name }).click();
  };
  await pick('Anchored VWAP');
  let b = await box();
  await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.25);
  await pick('Bars pattern');
  b = await box();
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.25, { steps: 5 });
  await page.mouse.up();
  await pick('Ghost feed');
  await expect(page.getByRole('status').filter({ hasText: 'Ghost feed' })).toBeVisible();
  b = await box();
  await page.mouse.click(b.x + b.width * 0.9, b.y + b.height * 0.2); // the room kept right of the last bar
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zelosAppDrawings:AAPL') || '[]') as { k: string; pts: { f?: number }[] }[]);
  expect(saved.map((x) => x.k)).toEqual(['avwap', 'pattern', 'ghost']);
  expect(saved[2]!.pts[0]!.f).toBeGreaterThan(0); // the ghost feed points past the last bar
  expect(saved[0]!.pts[0]!.f).toBeUndefined();
});

// owner 2026-11-12 (step 6, "comparing the stock against its sector"): Compare puts the sector average or an index on the chart
test('compare a stock with its sector average or an index', async ({ page }) => {
  // the test data has minute prices for AAPL only: give two other Tech stocks and SPY the same ones
  const DOCS = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents/markets';
  const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  const src = await (await fetch(`${DOCS}/intraday_AAPL`, { headers: H })).json();
  const copies = ['NVDA', 'AMD', 'SPY'];
  for (const s of copies) expect((await fetch(`${DOCS}/intraday_${s}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: src.fields }) })).ok).toBe(true);
  await page.goto('markets/AAPL');
  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  await tools.getByRole('button', { name: 'Compare' }).click();
  const menu = page.getByRole('menu', { name: 'Compare' });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(4); // off, Tech average, SPY, QQQ
  await menu.getByRole('menuitemradio', { name: /Its sector: Tech average/ }).click();
  const cmp = () => page.evaluate(() => (document.querySelector('canvas') as unknown as { __ztc: { compare: { label: string; r: (number | null)[] } | null } }).__ztc.compare);
  await expect.poll(async () => (await cmp())?.label).toBe('Tech avg');
  expect((await cmp())!.r.some((x) => x != null)).toBe(true);
  await tools.getByRole('button', { name: 'Compare' }).click();
  await menu.getByRole('menuitemradio', { name: 'S&P 500 (SPY)' }).click();
  await expect.poll(async () => (await cmp())?.label).toBe('SPY');
  await tools.getByRole('button', { name: 'Compare' }).click();
  await menu.getByRole('menuitemradio', { name: 'No comparison' }).click();
  await expect.poll(cmp).toBeNull();
  for (const s of copies) await fetch(`${DOCS}/intraday_${s}`, { method: 'DELETE', headers: H }); // other tests expect no minute prices for these
});

// owner's chart plan step 4 (2026-11-12): the Fibonacci menu's Fibonacci and Gann tools, including three-point ones
test('Fibonacci and Gann tools: a two-point retracement, a three-point extension, a one-tap Gann square', async ({ page }) => {
  await page.goto('markets/AAPL');
  const tools = page.getByRole('toolbar', { name: 'Chart tools' });
  const menu = page.getByRole('menu', { name: 'Fibonacci' });
  await tools.getByRole('button', { name: 'Fibonacci' }).click();
  await expect(menu.getByRole('menuitemradio')).toHaveCount(15); // 11 Fibonacci + 4 Gann
  const box = async () => {
    const l = page.getByTestId('draw-layer');
    await l.scrollIntoViewIfNeeded();
    return (await l.boundingBox())!;
  };
  await menu.getByRole('menuitemradio', { name: 'Fib retracement' }).click();
  let b = await box();
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.32);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.18, { steps: 5 });
  await page.mouse.up();
  // three points: drag the first two, then tap the third
  await tools.getByRole('button', { name: 'Fibonacci' }).click();
  await menu.getByRole('menuitemradio', { name: 'Trend-based fib extension' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'then tap the third' })).toBeVisible();
  b = await box();
  await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.32);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('draw-layer')).toHaveCount(1); // still waiting for the third point
  await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.28);
  await tools.getByRole('button', { name: 'Fibonacci' }).click();
  await menu.getByRole('menuitemradio', { name: 'Gann square (fixed)' }).click();
  b = await box();
  await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.3);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zelosAppDrawings:AAPL') || '[]') as { k: string; pts: unknown[] }[]);
  expect(saved.map((x) => [x.k, x.pts.length])).toEqual([['fibret', 2], ['fibext', 3], ['gannfixed', 1]]);
});
