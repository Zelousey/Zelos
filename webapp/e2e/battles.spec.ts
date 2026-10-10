/**
 * Trade War battles in the app (owner 2026-10-10): a real match through the tw_* functions
 * (create → join → start → surrender → results), then the live room's parts (storm, Last Man
 * Standing, whale / shield / wanted tags, Bounty Board, positions with stops) and the draft on
 * matches seeded straight into the emulator. Trades themselves need an open market; the server's
 * rules for them are covered by scripts/tradewar_test.py.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });
test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  x === null
    ? { nullValue: null }
    : typeof x === 'string'
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
const player = async (browser: Browser, info: TestInfo) => (await browser.newContext(info.project.use)).newPage();
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
const rid = () => Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');

test('a real battle in the app: create, join, start, surrender, results', async ({ browser }, info) => {
  const id = `${info.project.name}${Date.now()}`;
  const host = await player(browser, info);
  await host.goto('battles');
  const hostUid = await signIn(host, `bhost-${id}@example.com`);
  await put(`traders/${hostUid}`, { name: 'Hana' });
  await expect(host.getByText('No battles yet')).toBeVisible();
  await host.getByRole('link', { name: 'Start a battle' }).first().click();
  await host.getByLabel('Battle name').fill('Friday fight');
  await host.getByRole('button', { name: 'Create battle and get the link' }).click();
  await host.getByRole('link', { name: 'Open the battle room' }).click({ timeout: 30_000 }); // a cold start
  await expect(host.getByRole('heading', { name: 'Friday fight', level: 1 })).toBeVisible();
  const warId = host.url().split('/').pop()!;
  await expect(host.getByText('Players (1/4)')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Start the battle' })).toBeDisabled();
  expect(await axe(host)).toEqual([]);

  const rival = await player(browser, info);
  await rival.goto(`battles/${warId}`);
  await signIn(rival, `brival-${id}@example.com`);
  await rival.getByRole('button', { name: /^Join/ }).click();
  await expect(rival.getByText("You're in.")).toBeVisible();
  await expect(host.getByText('Players (2/4)')).toBeVisible();
  await host.getByRole('button', { name: 'Start the battle' }).click();
  await expect(host.getByText('Your battle account')).toBeVisible();
  await expect(rival.getByText('Your battle account')).toBeVisible();
  // the fixture market is closed: the ticket says so and Buy waits
  await expect(rival.getByText(/The market is closed/)).toBeVisible();
  await expect(rival.getByRole('button', { name: 'Buy', exact: true })).toBeDisabled();
  await expect(rival.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  expect(await axe(rival)).toEqual([]);

  await rival.getByRole('button', { name: 'Surrender' }).click();
  await rival.getByRole('dialog').getByRole('button', { name: 'Surrender' }).click();
  await expect(host.getByText('Hana won!')).toBeVisible({ timeout: 30_000 });
  await expect(host.getByRole('heading', { name: 'Final standings' })).toBeVisible();
  await host.goto('battles');
  await expect(host.getByRole('link', { name: /Friday fight/ })).toContainText('Ended');
  await host.context().close();
  await rival.context().close();
});

test('the live room: storm, Last Man Standing, tags, bounties, stops; and the draft', async ({ page }, info) => {
  await page.goto('battles');
  const uid = await signIn(page, `broom-${info.project.name}${Date.now()}@example.com`);
  const now = Date.now();
  const live = rid();
  await put(`tradeWars/${live}`, {
    name: 'Storm night', host: 'rivalUid0001', hostName: 'Rex', buyIn: 1000, days: 3, maxPlayers: 4, status: 'active',
    players: [uid, 'rivalUid0001', 'outUid000001'], names: { [uid]: 'Me', rivalUid0001: 'Rex', outUid000001: 'Ozzy' },
    rules: { deposits: false, withdrawals: false, shortSelling: false, assets: 'stocks' },
    lms: { floorPct: 10, cutHours: 24 }, alive: [uid, 'rivalUid0001'], nextCutAt: now + 3600_000,
    outs: [{ uid: 'outUid000001', name: 'Ozzy', reason: 'floor', at: now - 1000, pnlPct: -10.5, place: 3 }],
    modes: { whale: { capPct: 50, shields: 1 }, storms: 'often', bounties: true, stops: true },
    whales: ['rivalUid0001'], shields: { [uid]: 1 },
    storm: { kind: 'halt', start: now - 60_000, end: now + 600_000, sym: 'TSLA' },
    bounties: [{ id: 'bnty01', by: 'rivalUid0001', byName: 'Rex', target: uid, targetName: 'Me', amount: 50, pct: 5, at: now, end: now + 6 * 3600_000, status: 'open' }],
    startAt: now - 3600_000, endAt: now + 2 * 86400_000, createdAt: now - 7200_000,
  });
  await put(`tradeWars/${live}/accounts/${uid}`, { name: 'Me', start: 1000, cash: 667.37, equity: 1000, pnl: 12, pnlPct: 1.2, trades: 1, wins: 0, losses: 0 });
  await put(`tradeWars/${live}/accounts/rivalUid0001`, { name: 'Rex', start: 1000, cash: 1000, equity: 1030, pnl: 30, pnlPct: 3, trades: 2, wins: 1, losses: 0 });
  await put(`tradeWars/${live}/accounts/outUid000001`, { name: 'Ozzy', start: 1000, cash: 895, equity: 895, pnl: -105, pnlPct: -10.5, trades: 3, out: true, outReason: 'floor', place: 3 });
  await put(`tradeWars/${live}/books/${uid}`, { positions: { AAPL: { qty: 1, avg: 330, sl: 300 } }, fills: [] });
  await put(`tradeWars/${live}/events/e1`, { kind: 'big', text: 'Rex made a big move', at: now - 5000 });

  await page.goto(`battles/${live}`);
  await expect(page.getByRole('status').filter({ hasText: 'TSLA is halted' })).toBeVisible();
  await expect(page.getByText('2 of 3 still standing')).toBeVisible();
  const board = page.getByRole('list').filter({ hasText: 'Rex' }).first();
  await expect(board).toContainText('Whale');
  await expect(page.getByText('Shield ×1')).toBeVisible();
  await expect(page.getByText('Wanted')).toBeVisible();
  await expect(page.getByText('Rex put $50.00 on Me')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use a shield' })).toBeVisible();
  await expect(page.getByText('Rex made a big move')).toBeVisible();
  await expect(page.getByText('Fell below the P&L floor').first()).toBeVisible();
  await expect(page.getByText(/stop 300.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Stop-loss and take-profit for AAPL' }).click();
  await expect(page.getByLabel('Stop-loss').last()).toHaveValue('300');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(await axe(page)).toEqual([]);

  // a draft on the clock for me
  const dr = rid();
  await put(`tradeWars/${dr}`, {
    name: 'Draft day', host: uid, hostName: 'Me', buyIn: 500, days: 1, maxPlayers: 2, status: 'draft', players: [uid, 'rivalUid0001'], names: { [uid]: 'Me', rivalUid0001: 'Rex' },
    rules: {}, modes: { draft: { picks: 2 } },
    draft: { order: [uid, 'rivalUid0001'], per: 2, picks: { [uid]: [], rivalUid0001: [] }, taken: [], turn: 0, total: 4, deadline: now + 40_000 },
    createdAt: now,
  });
  await put(`tradeWars/${dr}/accounts/${uid}`, { name: 'Me', start: 500, cash: 500, equity: 500 });
  await page.goto(`battles/${dr}`);
  await expect(page.getByText('Your pick!')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft AAPL (Apple)' })).toBeEnabled();
  expect(await axe(page)).toEqual([]);
});
