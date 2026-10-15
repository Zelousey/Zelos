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

  await tools.getByRole('button', { name: 'Fibonacci' }).click();
  await expect(tools.getByRole('button', { name: 'Fibonacci' })).toHaveAttribute('aria-pressed', 'true');

  await tools.getByRole('button', { name: /Alert/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tap the price you want to watch' })).toBeVisible();
  const chart = page.getByRole('img', { name: /^AAPL .* price chart$/ });
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
  const box = (await page.getByRole('img', { name: /^AAPL .* price chart$/ }).boundingBox())!;
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
