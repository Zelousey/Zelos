/**
 * Profit calendar (owner 2026-11-19): each day of the month shows what the practice account made or
 * lost (from the daily closing values the server keeps), and tapping a day shows its trades.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
test.describe.configure({ timeout: 90_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const patch = (path: string, data: Record<string, unknown>, mask?: string[]) =>
  fetch(`${BASE}/${path}${mask ? '?' + mask.map((m) => `updateMask.fieldPaths=${m}`).join('&') : ''}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }),
  });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

/** Weekdays of this month before today (New York), oldest first. */
function weekdaysSoFar(): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const [y, m] = today.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.toISOString().slice(0, 10) < today; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

test('the month at a glance; tap a day for its trades', async ({ page }, info) => {
  await page.goto('dashboard');
  const uid = await signIn(page, `cal-${info.project.name}-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Start with $10,000' }).click();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();
  // a few weeks of closing values (test data): up, down, up...
  const days = weekdaysSoFar();
  const moves = [0, 600, -400, 250, 0, 180, -120, 90, 310, -260, 140, 75, -50, 220, 160, -90, 40];
  let e = 10_000;
  const hist: Record<string, { n: number; x: number; e: number }> = {};
  days.forEach((d, i) => {
    e += moves[i % moves.length]!;
    hist[`d${d.replace(/-/g, '')}`] = { n: 0, x: 0, e };
  });
  expect((await patch(`practiceAccounts/${uid}`, { hist }, ['hist'])).ok).toBe(true);
  const day = days[1]!; // +$600
  await patch(`practiceAccounts/${uid}/history/t1`, { kind: 'trade', sym: 'NVDA', qty: 20, entry: 180.5, exit: 210.5, pnl: 600, closeDay: day, at: Date.parse(`${day}T19:00:00Z`) });

  await expect(page.getByRole('link', { name: 'Profit calendar' })).toBeVisible();
  await page.getByRole('link', { name: 'Profit calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Profit calendar', level: 1 })).toBeVisible();
  await expect(page.getByRole('grid', { name: /Profit calendar for/ })).toBeVisible();
  const cell = page.getByRole('gridcell', { name: new RegExp(`: \\+\\$600\\.00, 1 trade closed`) });
  await expect(cell).toBeVisible();
  await expect(page.getByText('Green days')).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/calendar-${info.project.name}.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await cell.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('NVDA')).toBeVisible();
  await expect(sheet.getByText('20 at $180.50 → $210.50')).toBeVisible();
  await page.waitForTimeout(400); // the sheet finishes sliding in
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/calendar-day-${info.project.name}.png` });
});
