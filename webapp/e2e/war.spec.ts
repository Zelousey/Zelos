/**
 * The War zone (Trade War realm, docs/WAR_DESIGN.md §20, §24): hidden until all of War is built,
 * so it's "Page not found" for everyone but admins; an admin gets the one-time "prices are
 * simulated" explainer, a $100,000 War balance, the SIMULATED marking on the screen and the
 * chart, and can buy at the War zone price. W2: a Chaos event shows its banner and Hot stocks, and
 * quiet hours can be changed but never past 10 hours. W3: a private War goes from draft to open
 * lobby to started.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
type F = Record<string, unknown>;
const v = (x: unknown): F =>
  typeof x === 'boolean'
    ? { booleanValue: x }
    : typeof x === 'string'
      ? { stringValue: x }
      : typeof x === 'number'
        ? Number.isInteger(x)
          ? { integerValue: String(x) }
          : { doubleValue: x }
        : Array.isArray(x)
          ? { arrayValue: { values: x.map(v) } }
          : {
              mapValue: {
                fields: Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, v(y)])),
              },
            };
const put = (path: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])),
    }),
  });
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate(
    (e) =>
      (
        window as unknown as {
          __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }>;
        }
      )
        .__zelosTestSignIn(e, 'secret123')
        .then((c) => c.user.uid),
    email,
  );
}
// every other War zone company at $100, so a battle on any territory has prices
const OTHERS = [
  'QUBTR',
  'SYNAP',
  'VAULT',
  'LEDGR',
  'ORBCP',
  'HELIX',
  'CURAM',
  'PULSV',
  'SOLRN',
  'PETRA',
  'BRWLY',
  'STRDE',
  'CARTO',
  'SIGNL',
  'ECHON',
  'STRMR',
  'FORGE',
  'AEROV',
  'RAILX',
  'HAVEN',
  'BRIKX',
  'TOWRS',
  'ALLOY',
  'POLYM',
  'QUARZ',
  'GRIDX',
  'AQUAV',
  'WATSN',
];
async function seedMarket() {
  const now = Date.now();
  const M = 60000;
  await put('warMarket/quotes', {
    updatedAt: now,
    prices: { NIMBC: { p: 190.5, ref: 182 }, VOLTX: { p: 85.25, ref: 88 }, ...Object.fromEntries(OTHERS.map((x) => [x, { p: 100, ref: 100 }])) },
  });
  const start = now - (now % (5 * M)) - 60 * 5 * M;
  // the same live Chaos event for every test (they run side by side)
  await put('warMarket/chaos', {
    phase: 'live',
    day: 'x',
    scope: 'energy',
    scopeName: 'Energy',
    startsAt: now - 10 * M,
    endsAt: now + 50 * M,
    syms: ['PETRA', 'SOLRN', 'VOLTX'],
  });
  await put('warMarket/bars_NIMBC', {
    bars: Array.from({ length: 60 }, (_, i) => ({
      t: start + i * 5 * M,
      o: 182 + i * 0.1,
      h: 183 + i * 0.1,
      l: 181 + i * 0.1,
      c: 182.5 + i * 0.1,
    })),
  });
}

test('the War zone is hidden from everyone but admins', async ({ page }, info) => {
  await page.goto('dashboard');
  await signIn(page, `nowar-${info.project.name}-${Date.now()}@example.com`);
  await page.goto('war');
  await expect(page.getByText('Page not found')).toBeVisible();
  await expect(page.getByRole('link', { name: 'War zone' })).toHaveCount(0); // in no menu
});

test('an admin previews the War zone: simulated marking, $100,000 War balance, buy at the War zone price', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('warReset')) {
      localStorage.removeItem('zelosWarExplained'); // a first visit (once, so "seen" can stick)
      sessionStorage.setItem('warReset', '1');
    }
  });
  await page.goto('dashboard');
  const uid = await signIn(page, `war-${info.project.name}-${Date.now()}@example.com`);
  await put(`admins/${uid}`, { addedAt: 1 });
  await seedMarket();
  await page.goto('war');
  const explain = page.getByRole('dialog', {
    name: 'Prices here are simulated',
  });
  await expect(explain).toBeVisible();
  await expect(explain).toContainText('isn’t real market data');
  await explain.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'War zone', level: 1 })).toBeVisible();
  await expect(page.getByText('SIMULATED WAR ZONE').first()).toBeVisible();
  await expect(page.getByText('$100,000.00').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tech' })).toContainText('Nimbus Cloud');
  await expect(page.getByRole('status').filter({ hasText: 'Chaos now: Energy' })).toContainText('swinging hard');
  await expect(page.getByRole('region', { name: 'Energy' }).getByRole('button', { name: /Voltex Energy/ })).toContainText('Hot');
  await expect(page.getByRole('region', { name: 'Tech' }).getByText('Hot')).toHaveCount(0);
  await expect(page.getByText('live', { exact: false }).filter({ hasText: /\blive\b/i })).toHaveCount(0); // nothing in the War zone says "live"
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  if (process.env.SHOTS)
    await page.screenshot({
      path: `${process.env.SHOTS}/war-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByLabel('Shares').fill('10');
  await page.getByRole('button', { name: 'Buy 10 NIMBC' }).click();
  await expect(page.getByText('Bought 10 NIMBC at $190.50')).toBeVisible({
    timeout: 30_000,
  }); // a cold start
  await expect(page.getByText('10 shares · avg $190.50')).toBeVisible();
  await expect(page.getByText('Cash $98,095.00 · started with $100,000')).toBeVisible();
  // the explainer shows once
  await page.reload();
  await expect(page.getByRole('heading', { name: 'War zone', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Prices here are simulated' })).toHaveCount(0);
});

test('quiet hours: 10 pm-8 am to start, can be changed, never longer than 10 hours', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('zelosWarExplained', '1'));
  await page.goto('dashboard');
  const uid = await signIn(page, `warq-${info.project.name}-${Date.now()}@example.com`);
  await put(`admins/${uid}`, { addedAt: 1 });
  await seedMarket();
  await page.goto('war');
  await expect(page.getByText('10:00 PM – 8:00 AM (your time)')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Change quiet hours' }).click();
  const sheet = page.getByRole('dialog', { name: 'Quiet hours' });
  await sheet.getByLabel('From').selectOption({ label: '9:00 PM' });
  await expect(sheet.getByRole('alert')).toHaveText('Quiet hours can be at most 10 hours.');
  await expect(sheet.getByRole('button', { name: 'Save quiet hours' })).toBeDisabled();
  await sheet.getByLabel('From').selectOption({ label: '11:00 PM' });
  await sheet.getByLabel('Until').selectOption({ label: '7:00 AM' });
  await expect(sheet).toContainText('8h 00m of quiet hours');
  expect((await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  await sheet.getByRole('button', { name: 'Save quiet hours' }).click();
  await expect(page.getByText('Quiet hours saved')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('11:00 PM – 7:00 AM (your time)')).toBeVisible();
});

const patch = (path: string, data: Record<string, unknown>) =>
  fetch(
    `${BASE}/${path}?${Object.keys(data)
      .map((k) => `updateMask.fieldPaths=${k}`)
      .join('&')}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, v(x)])),
      }),
    },
  );

test('a private War: set it up, open the lobby, invite by @username, start when everyone is ready', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('zelosWarExplained', '1'));
  await page.goto('dashboard');
  const uid = await signIn(page, `warl-${info.project.name}-${Date.now()}@example.com`);
  await put(`admins/${uid}`, { addedAt: 1 });
  const pal = `pal${info.project.name}${Date.now()}`.slice(0, 20).toLowerCase();
  await put(`admins/${pal}Uid0`, { addedAt: 1 });
  await put(`usernames/${pal}`, { uid: `${pal}Uid0` });
  await seedMarket();
  await page.goto('war');
  await expect(page.getByText('No private Wars yet. Start one and invite friends.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Start a private War' }).click();
  const sheet = page.getByRole('dialog', { name: 'Start a private War' });
  await sheet.getByLabel('War name').fill('Friday sector clash');
  await sheet.getByText('5 days').click();
  await sheet.getByRole('button', { name: 'Create the War' }).click();
  await expect(page.getByRole('heading', { name: 'Friday sector clash', level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Setting up')).toBeVisible();
  await expect(page.getByText('SIMULATED WAR ZONE').first()).toBeVisible();
  await page.getByRole('button', { name: 'Open the lobby' }).click();
  await expect(page.getByText('Lobby open')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'The lobby closes in 6 hours' })).toBeVisible();
  await page.getByLabel('Invite a friend by username').fill('@' + pal);
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(page.getByText(`Invite sent to @${pal}`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('1 invite(s) waiting for an answer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start the War' })).toBeDisabled();
  // the friend joins and gets ready (as the server would write it)
  const id = page.url().split('/war/')[1]!;
  await patch(`wars/${id}`, {
    players: [uid, `${pal}Uid0`],
    invited: [],
    names: { [uid]: 'Me', [`${pal}Uid0`]: 'Pal' },
    ready: { [uid]: true, [`${pal}Uid0`]: true },
    stage: 'ready',
  });
  await expect(page.getByText('Ready to start')).toBeVisible();
  await expect(page.getByText('Not ready')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  if (process.env.SHOTS)
    await page.screenshot({
      path: `${process.env.SHOTS}/war-lobby-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole('button', { name: 'Start the War' }).click();
  await expect(page.getByText('In progress')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: /Started .* ends in 5 days/ })).toBeVisible();
  await expect(page.getByText('6 territories')).toBeVisible();
  // W4a: an hour of secret claiming
  await expect(page.getByRole('heading', { name: 'Place your soldiers in secret' })).toBeVisible();
  const inputs = page.getByRole('spinbutton');
  await expect(inputs).toHaveCount(6);
  await expect(page.getByText('0 of 100 soldiers placed', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lock in' })).toBeDisabled();
  await inputs.nth(0).fill('50');
  await inputs.nth(1).fill('45');
  await page.getByRole('checkbox').nth(1).check();
  await expect(page.getByText('95 of 95 soldiers placed · Camouflage on 1 (−5)')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/war-claim-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Lock in' }).click();
  await page.getByRole('dialog', { name: 'Lock in your placement?' }).getByRole('button', { name: 'Lock in' }).click();
  await expect(page.getByRole('heading', { name: 'You’re locked in' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Your soldiers: 50')).toBeVisible();
  await expect(page.getByText('Camouflaged', { exact: false })).toBeVisible();
  // the friend locks in too and the server reveals the map (written here as the server would)
  const terr: string[] = await fetch(`${BASE}/wars/${id}`, { headers: { Authorization: 'Bearer owner' } })
    .then((r) => r.json())
    .then((d: { fields: { territories: { arrayValue: { values: { stringValue: string }[] } } } }) => d.fields.territories.arrayValue.values.map((x) => x.stringValue));
  const pid = `${pal}Uid0`;
  const map = Object.fromEntries(
    terr.map((x, i) => [x, i === 0 ? { state: 'contested', contenders: [uid, pid] } : i === 1 ? { state: 'owned', owner: uid } : i === 2 ? { state: 'owned', owner: pid } : { state: 'neutral' }]),
  );
  await patch(`wars/${id}`, { phase: 'holding', map });
  await expect(page.getByRole('heading', { name: 'The map' })).toBeVisible();
  await expect(page.getByText('Contested: You vs Pal')).toBeVisible();
  await expect(page.getByText('Held by Pal')).toBeVisible();
  await expect(page.getByText('Yours', { exact: true })).toBeVisible();
  await expect(page.getByText('Neutral', { exact: true })).toHaveCount(3);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/war-map-${info.project.name}.png`, fullPage: true });
  // W4b: the contested territory is a battle; you have Command and pick Bear, and it starts
  await patch(`wars/${id}`, {
    battles: { [terr[0]!]: { territory: terr[0]!, kind: 'duel', players: [uid, pid], command: uid, stage: 'picking', createdAt: Date.now(), pickBy: Date.now() + 600_000, sides: {}, picks: {} } },
    due: Date.now() + 600_000,
  });
  await expect(page.getByRole('heading', { name: 'Contested battles' })).toBeVisible();
  await expect(page.getByText(/You have Command: pick Bull/)).toBeVisible();
  await page.getByRole('button', { name: 'Bear (price down)' }).click();
  await expect(page.getByText('Under way')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/started at \$[\d,.]+, now \$[\d,.]+ \(simulated\)/)).toBeVisible();
  await expect(page.getByText(/Ends in 1 hour/)).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/war-battle-${info.project.name}.png`, fullPage: true });
  await page
    .getByRole('link', { name: /War zone/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Private Wars' }).or(page.getByLabel('Private Wars')).first()).toContainText('Friday sector clash');
});
