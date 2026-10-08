/**
 * Zelos News in the browser: sections, official market news with the watchlist filter, and
 * the team-only Post News screen (against the real news_save function on the emulators).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, who: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate(async (email) => {
    const cred = (await (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(email, 'secret123'));
    return cred.user.uid;
  }, `${who}@example.com`);
}

async function seed(path: string, fields: Record<string, unknown>) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  expect(r.ok).toBe(true);
}

test('sections: Zelos, Trade War, Market News (official sources) and Market Movers', async ({ page }) => {
  await page.goto('news');
  for (const name of ['All', 'Zelos Updates', 'Trade War', 'Market News', 'Market Movers']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  // "All" mixes posts with the latest official items
  await expect(page.getByRole('heading', { name: 'AAPL: new 8-K filing' })).toBeVisible();

  await page.getByRole('button', { name: 'Market News', exact: true }).click();
  await expect(page.getByText(/From official sources/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Federal Reserve issues FOMC statement' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the filing' }).first()).toHaveAttribute('href', /^https:\/\/www\.sec\.gov\//);
  await expect(page.getByRole('link', { name: 'AAPL', exact: true })).toHaveAttribute('href', '/app/markets/AAPL');
  // signed out: no watchlist toggle
  await expect(page.getByRole('button', { name: 'Your watchlist' })).toHaveCount(0);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

  test('watchlist filter shows only your stocks', async ({ page }, info) => {
    await page.goto('news');
    const uid = await signIn(page, `reader-${info.project.name}-${Date.now()}`);
    await seed(`users/${uid}`, { xp: { integerValue: '0' }, watchlist: { arrayValue: { values: [{ stringValue: 'TSLA' }] } } });
    await page.getByRole('button', { name: 'Market News', exact: true }).click();
    await page.getByRole('button', { name: 'Your watchlist' }).click();
    await expect(page.getByRole('heading', { name: 'TSLA: new 8-K filing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AAPL: new 8-K filing' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /FOMC/ })).toHaveCount(0);
    // regular accounts never see Post news
    await expect(page.getByRole('link', { name: 'Post news' })).toHaveCount(0);
  });

  test('the team posts a Market Movers quote and it shows in News', async ({ page }, info) => {
    await page.goto('news');
    const uid = await signIn(page, `team-${info.project.name}-${Date.now()}`);
    await seed(`admins/${uid}`, { since: { integerValue: '1' } });
    await page.goto('news');
    await page.getByRole('link', { name: 'Post news' }).click();
    await expect(page).toHaveURL(/\/app\/news\/post$/);
    await page.getByLabel('Section').selectOption('voices');
    await page.getByLabel('Posted on', { exact: true }).selectOption('x');
    await page.getByLabel('Link to the post').fill('https://x.com/federalreserve/status/123');
    await page.getByLabel('Who posted it').fill(`Federal Reserve ${info.project.name}`);
    await page.getByLabel('What they said').fill('The Committee decided to maintain the target range.');
    await page.getByLabel('Why it matters (one line)').fill('Rates unchanged');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published.')).toBeVisible();

    await page.getByRole('link', { name: 'Back to News' }).click();
    await page.getByRole('button', { name: 'Market Movers', exact: true }).click();
    const card = page.getByRole('article', { name: `Federal Reserve ${info.project.name}` });
    await expect(card).toContainText('The Committee decided to maintain the target range.');
    await expect(card.getByRole('link', { name: 'View on X' })).toHaveAttribute('href', 'https://x.com/federalreserve/status/123');

    // a bad link is refused by the server with a clear message
    await page.goto('news/post');
    await page.getByLabel('Section').selectOption('voices');
    await page.getByLabel('Link to the post').fill('https://evil.example/status/1');
    await page.getByLabel('Who posted it').fill('Someone');
    await page.getByLabel('What they said').fill('Something');
    await page.getByLabel('Why it matters (one line)').fill('x');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText(/x\.com link/)).toBeVisible();
  });
});
