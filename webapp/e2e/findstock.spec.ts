/**
 * Find a stock (Phase 7, N6): from a "Find a stock" button, picking a stock asks how to trade it
 * (Solo or Battle) and carries the ticker; browsing Market normally still opens the chart.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string'
    ? { stringValue: x }
    : typeof x === 'boolean'
      ? { booleanValue: x }
      : typeof x === 'number'
        ? Number.isInteger(x)
          ? { integerValue: String(x) }
          : { doubleValue: x }
        : Array.isArray(x)
          ? { arrayValue: { values: x.map(v) } }
          : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity), null, { timeout: 2000 }).catch(() => undefined);

test('Find a stock asks Solo or Battle and carries the ticker; plain Market browsing does not ask', async ({ page }) => {
  await page.goto('markets?find=1');
  await expect(page.getByRole('heading', { level: 1, name: 'Find a stock' })).toBeVisible();
  await page.getByRole('searchbox').fill('nvi');
  await page.getByRole('list', { name: 'Market' }).getByRole('link', { name: /NVDA/ }).click();
  const sheet = page.getByRole('dialog', { name: 'How do you want to trade NVDA?' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Trade NVDA Solo' })).toHaveAttribute('href', '/app/practice/trade/NVDA');
  await expect(sheet.getByText('You have no battle running right now.')).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Start a battle' })).toHaveAttribute('href', '/app/battles');
  await expect(sheet.getByRole('link', { name: /Just look at the NVDA chart/ })).toHaveAttribute('href', '/app/markets/NVDA');
  await settled(page);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/find-${test.info().project.name}.png` });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await sheet.getByRole('link', { name: 'Trade NVDA Solo' }).click();
  await expect(page).toHaveURL(/\/practice\/trade\/NVDA$/);

  // no Find a stock: a stock opens its chart, no question
  await page.goto('markets');
  await page.getByRole('searchbox').fill('nvi');
  await page.getByRole('list', { name: 'Market' }).getByRole('link', { name: /NVDA/ }).click();
  await expect(page).toHaveURL(/\/markets\/NVDA$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Battle lists your running battles; the room opens with the stock in its ticket', async ({ page }, info) => {
  await page.goto('markets?find=1');
  const uid = await signIn(page, `find-${info.project.name}${Date.now()}@example.com`);
  const now = Date.now();
  const id = `fd${Array.from({ length: 10 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('')}`; // battle ids are 12 letters and digits
  await put(`tradeWars/${id}`, {
    name: 'Find fight', host: uid, hostName: 'Me', buyIn: 1000, days: 3, maxPlayers: 4, status: 'active',
    players: [uid, 'rivalUid0002'], names: { [uid]: 'Me', rivalUid0002: 'Rex' },
    rules: { deposits: false, withdrawals: false, shortSelling: false, assets: 'stocks' },
    startAt: now - 3600_000, endAt: now + 2 * 86400_000, createdAt: now - 7200_000,
  });
  await put(`tradeWars/${id}/accounts/${uid}`, { name: 'Me', start: 1000, cash: 1000, equity: 1000, pnl: 0, pnlPct: 0, trades: 0, wins: 0, losses: 0 });
  await put(`tradeWars/${id}/accounts/rivalUid0002`, { name: 'Rex', start: 1000, cash: 1000, equity: 1000, pnl: 0, pnlPct: 0, trades: 0, wins: 0, losses: 0 });
  await put(`tradeWars/${id}/books/${uid}`, { positions: {}, fills: [] });
  await page.getByRole('searchbox').fill('msft');
  await page.getByRole('list', { name: 'Market' }).getByRole('link', { name: /MSFT/ }).click();
  const sheet = page.getByRole('dialog', { name: 'How do you want to trade MSFT?' });
  const room = sheet.getByRole('link', { name: 'Find fight' });
  await expect(room).toHaveAttribute('href', `/app/battles/${id}?sym=MSFT`);
  await room.click();
  await expect(page.getByRole('combobox', { name: 'Stock' })).toHaveValue('MSFT'); // the battle's own ticket, on the stock you picked
});
