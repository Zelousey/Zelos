/**
 * Phone fixes from the Phase 1 audit (docs/PHASE1_AUDIT.md):
 * M-2/M-3 rows that scroll sideways fade where more is hidden; M-5 small buttons and
 * links have a finger-sized (44 px) touch area on touch screens, without looking bigger.
 */
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'phone', 'touch screens only'));

/** The touch area of every visible button and link: its box, grown by its ::after hit area. */
function smallTargets(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main a, main button, header a, header button'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('p, li > p, [data-prose]') && getComputedStyle(el).display === 'inline' && !el.classList.contains('hit')) continue; // a link inside a sentence
      const a = getComputedStyle(el, '::after');
      const h = a.content !== 'none' && a.position === 'absolute' ? Math.max(r.height, parseFloat(a.height)) : r.height;
      const w = a.content !== 'none' && a.position === 'absolute' ? Math.max(r.width, parseFloat(a.width)) : r.width;
      if (h < 43.5 || w < 43.5) out.push(`${Math.round(w)}x${Math.round(h)} ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`);
    }
    return out;
  });
}

test('chart controls on a 320 px phone fade at the edge until you swipe to the end', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('markets/AAPL');
  const row = page.getByRole('tablist', { name: 'Timeframe' }).locator('..');
  await expect(row).toHaveAttribute('data-fade', 'end');
  if (process.env.SHOTS) {
    await expect(page.getByRole('img', { name: /AAPL .* price chart/ })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.SHOTS}/controls-320.png`, clip: { x: 0, y: 0, width: 320, height: 520 } });
  }
  await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(row).toHaveAttribute('data-fade', 'start');
  await row.evaluate((el) => el.scrollTo({ left: 40 }));
  await expect(row).toHaveAttribute('data-fade', 'both');
});

test('news categories hint that more are hidden; a row that fits shows no fade', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('news');
  await expect(page.getByRole('group', { name: /filter/i })).toHaveAttribute('data-fade', 'end');
  await page.goto('dashboard');
  await expect(page.getByRole('tablist').first()).not.toHaveAttribute('data-fade', /.+/);
});

for (const path of ['dashboard', 'markets', 'markets/AAPL', 'news', 'training', 'strategies', 'missions', 'leaderboard', 'alerts', 'social', 'learn', 'minds', 'settings']) {
  test(`touch areas on ${path} are finger-sized`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(1500); // lazy cards settle
    expect(await smallTargets(page)).toEqual([]);
  });
}

test('touch areas are finger-sized when signed in too', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('dashboard');
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  await page.evaluate(() => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<unknown> }).__zelosTestSignIn(`tap${Date.now()}@example.com`, 'secret123'));
  for (const path of ['dashboard', 'missions', 'profile', 'trade-war', 'battles', 'tokens']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await smallTargets(page), path).toEqual([]);
  }
});
