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
