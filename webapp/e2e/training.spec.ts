/**
 * Training Ground (was Arcade): the drills, the skill filter, today's Daily Challenge, live
 * drill leaderboards from the Realtime Database, /arcade → /training, and a drill shown inside
 * the app without the website's menu (the real games/*.html files, served from the repo).
 */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const RTDB = 'http://127.0.0.1:9000';
const NS = 'ns=demo-zelos-default-rtdb';
const put = (path: string, data: unknown) => fetch(`${RTDB}/${path}.json?${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const ROOT = resolve(process.cwd(), '..'); // tests run from webapp/
const dailyId = () => `daily-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}`; // same as training.ts

test.beforeAll(async () => {
  await put('scores/stop-drill', { a1: { name: 'StopQueen', score: 940, ts: Date.now() - 60_000, uid: 'x1' }, a2: { name: 'TightTim', score: 610, ts: Date.now() - 120_000, uid: 'x2' } });
  await put(`scores/${dailyId()}`, { d1: { name: 'DailyDan', score: 420, ts: Date.now(), uid: 'x3' } });
});

test('drills, skills, daily challenge and leaderboards', async ({ page }) => {
  await page.goto('arcade');
  await expect(page).toHaveURL(/\/training$/); // the old name still works
  await expect(page.getByRole('heading', { name: 'Training Ground', level: 1 })).toBeAttached();
  await expect(page.getByText('Five real charts. Same five for everyone. One try.')).toBeVisible();
  await expect(page.getByText('Top today: DailyDan · 420')).toBeVisible();
  for (const name of ['Chart Replay', 'Grade the Setup', 'Where’s the Stop?', 'Setup Spotter']) await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  await expect(page.getByText('Top score: StopQueen · 940')).toBeVisible();
  await page.getByRole('button', { name: 'Place stops' }).click();
  await expect(page.getByRole('heading', { name: 'Setup Spotter', level: 2 })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Where’s the Stop?', level: 2 })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

  await page.getByRole('tab', { name: 'Leaderboards' }).click();
  await page.getByRole('tab', { name: 'Where’s the Stop?' }).click();
  const rows = page.getByRole('listitem');
  await expect(rows.first()).toContainText('StopQueen');
  await expect(rows.nth(1)).toContainText('TightTim');
});

test('a drill runs inside the app without the website menu, and its links come back', async ({ page }) => {
  // the preview server only serves the app: hand the frame the real drill files from the repo
  await page.route(/127\.0\.0\.1:4173\/(games\/[a-z-]+\.(html|js|css)|zelos-[a-z-]+\.(js|css)|[a-z-]+\.css)(\?.*)?$/, (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
    try {
      return route.fulfill({ status: 200, contentType: type, body: readFileSync(resolve(ROOT, path)) });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  });
  await page.route(/gstatic\.com|googletagmanager|firebasejs/, (route) => route.abort());
  await page.goto('training/stop-drill');
  await expect(page.getByRole('heading', { name: 'Where’s the Stop?', level: 1 })).toBeVisible();
  const frame = page.frameLocator('iframe[title="Where’s the Stop? drill"]');
  await expect(frame.locator('html')).toHaveClass(/zg-embed/);
  await expect(frame.locator('.site-nav')).toBeHidden();
  await expect(frame.locator('.site-footer')).toBeHidden();
  await expect(page.getByText('StopQueen')).toBeVisible(); // its top scores below
  // a "Back to Training Ground" link clicked inside the drill returns to the app
  await frame.locator('body').evaluate((b) => {
    const a = document.createElement('a');
    a.href = '../arcade.html';
    a.textContent = 'Back';
    a.id = 'backTest';
    a.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;background:#fff;color:#000;padding:8px';
    b.appendChild(a);
  });
  await frame.locator('#backTest').click();
  await expect(page).toHaveURL(/\/training$/);
});

test('drill hints: 3 tokens show where to look, and the round scores half', async ({ page }) => {
  await page.route(/127\.0\.0\.1:4173\/(games\/[a-z-]+\.(html|js|css)|zelos-[a-z-]+\.(js|css)|[a-z-]+\.css)(\?.*)?$/, (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
    try {
      return route.fulfill({ status: 200, contentType: type, body: readFileSync(resolve(ROOT, path)) });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  });
  await page.route(/gstatic\.com|googletagmanager|firebasejs/, (route) => route.abort());
  // sample charts instead of the live database (zelos-mdata.js steps aside when ZelosData exists)
  await page.addInitScript(() => {
    const series = (seed: number) => {
      let p = 50 + seed, x = seed;
      const rows: [string, number, number, number, number, number][] = [];
      for (let i = 0; i < 240; i++) {
        x = (x * 9301 + 49297) % 233280;
        const r = x / 233280 - 0.45;
        const o = p, c = Math.max(5, p * (1 + r * 0.03));
        const d = new Date(Date.UTC(2024, 0, 2) + i * 864e5).toISOString().slice(0, 10);
        rows.push([d, o, Math.max(o, c) * 1.01, Math.min(o, c) * 0.99, c, 1e6 + (x % 5e5)]);
        p = c;
      }
      return rows;
    };
    (window as unknown as { ZelosData: unknown }).ZelosData = { history: () => Promise.resolve({ source: 'test', symbols: { AAA: series(1), BBB: series(7), CCC: series(13) } }) };
  });
  await page.goto('/games/stop-drill.html');
  const hintBtn = page.getByRole('button', { name: 'Hint · 3 tokens' });
  await expect(hintBtn).toBeVisible();
  await expect(page.getByText('The round scores half points.')).toBeVisible();
  // not enough tokens: the server's message shows and the button comes back
  await page.evaluate(() => { (window as unknown as { ZelosTokens: { hint: () => Promise<unknown> } }).ZelosTokens.hint = () => Promise.reject(new Error('You need 3 tokens and have 1.')); });
  await hintBtn.click();
  await expect(page.getByText('You need 3 tokens and have 1.')).toBeVisible();
  await expect(hintBtn).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { ZelosTokens: { hint: () => Promise<unknown> } }).ZelosTokens.hint = () => Promise.resolve({ balance: 7 }); });
  await hintBtn.click();
  await expect(page.getByText('the gold line is the lowest low of the last 10 days')).toBeVisible();
  await expect(hintBtn).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#zgRound').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  const box = (await page.locator('#zgRound canvas').boundingBox())!;
  // tap low on the price pane (pointerdown is what the chart listens for, on phones too)
  await page.locator('#zgRound canvas').dispatchEvent('pointerdown', { clientX: box.x + box.width * 0.6, clientY: box.y + box.height * 0.72, pointerId: 1, isPrimary: true });
  await page.getByRole('button', { name: 'Lock in stop' }).click();
  await expect(page.locator('.zg-verdict')).toContainText('Hint used: half points.');
  // the Daily Challenge has no hints, so its board stays even
  await page.goto('/games/daily-challenge.html');
  await expect(page.locator('#zgRound canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Hint/ })).toHaveCount(0);
});
