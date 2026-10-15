/**
 * Safety in the app (App Store guideline 1.2): agree to the community rules once, report a
 * chat message (real report_content on the emulators), block the author (their messages are
 * hidden) and unblock them from Settings. The server-side word filter has its own test
 * (tests/rules/functions.e2e.mjs).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? { integerValue: String(x) } : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])) } };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])) }) });
const get = (path: string) => fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}

test('agree to the community rules once', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.removeItem('zelosTerms'));
  await page.goto('markets');
  const uid = await signIn(page, `terms-${info.project.name}${Date.now()}@example.com`);
  const gate = page.getByRole('dialog', { name: 'Before you start' });
  await expect(gate).toBeVisible();
  await expect(gate.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://agentictrading.info/terms.html');
  expect((await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await gate.getByRole('button', { name: 'I agree' }).click();
  await expect(gate).toBeHidden();
  await expect.poll(async () => Number((await get(`users/${uid}`)).fields?.termsAt?.integerValue ?? 0)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Market', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Before you start' })).toBeHidden();
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

  test('report a chat message, block its author, unblock in Settings', async ({ page }, info) => {
    const tag = `${info.project.name}${Date.now()}`;
    await page.goto('social');
    const me = await signIn(page, `safe-${tag}@example.com`);
    const troll = `Troll${tag}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 30);
    const sq = `Safe${tag}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
    await put(`traders/${troll}`, { name: 'Trolly' });
    await put(`squads/${sq}`, { name: 'Safety Squad', owner: me, members: [me, troll], names: { [me]: 'Me', [troll]: 'Trolly' }, createdAt: Date.now(), config: { reactions: true, photos: false, viewTrades: false } });
    await put(`squads/${sq}/messages/m1`, { author: troll, name: 'Trolly', text: 'buy my course', createdAt: Date.now(), r: {} });
    await page.goto(`social/${sq}`);
    const chat = page.getByRole('log', { name: 'Squad chat' });
    await expect(chat.getByText('buy my course')).toBeVisible();

    await chat.getByRole('button', { name: 'More options for Trolly' }).click();
    await page.getByRole('dialog', { name: 'Trolly' }).getByRole('button', { name: 'Report' }).click();
    const report = page.getByRole('dialog', { name: 'Report' });
    await report.getByText('Spam or scam').click();
    await report.getByLabel('Anything to add? (optional)').fill('selling stuff');
    await report.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('Thanks. We got your report about Trolly.')).toBeVisible();
    const reports = await get('reports');
    const mine = (reports.documents ?? []).map((d: { fields: F }) => d.fields).find((f: F) => (f.reporter as { stringValue: string }).stringValue === me);
    expect(mine).toBeTruthy();

    await chat.getByRole('button', { name: 'More options for Trolly' }).click();
    await page.getByRole('dialog', { name: 'Trolly' }).getByRole('button', { name: 'Block Trolly' }).click();
    await page.getByRole('dialog', { name: 'Block Trolly?' }).getByRole('button', { name: 'Block', exact: true }).click();
    await expect(chat.getByText('Message from someone you blocked.')).toBeVisible();
    await expect(chat.getByText('buy my course')).toHaveCount(0);

    await page.goto('settings');
    const list = page.getByRole('region', { name: 'Blocked traders' });
    await expect(list.getByText('Trolly')).toBeVisible();
    await list.getByRole('button', { name: 'Unblock' }).click();
    await expect(list.getByText('You haven’t blocked anyone.')).toBeVisible();
  });
});
