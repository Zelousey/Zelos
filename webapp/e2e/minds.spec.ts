/**
 * Hall of Minds (owner 2026-10-22/23): the opening book animation, the red-card grid with its
 * tabs, a figure's story, accounts, who they learned from, lessons and explained quotes, and (with
 * the Functions emulator) reading a lesson for XP and turning on a figure's daily quotes with tokens.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
async function signIn(page: Page, who: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((email) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(email, 'secret123').then((c) => c.user.uid), `${who}@example.com`);
}
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

test('the opening book flips through a few great minds, once per visit, and can be skipped', async ({ page }) => {
  await page.goto('minds');
  const skip = page.getByRole('button', { name: 'Skip' });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(skip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hall of Minds', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0); // once per visit
});

test('the grid: one red card per great mind, with market legends on their own tab', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no opening animation
  await page.goto('minds');
  await expect(page.getByRole('heading', { name: 'Hall of Minds', level: 1 })).toBeVisible();
  const grid = page.getByRole('list', { name: 'Hall of Minds' });
  await expect(grid.getByRole('link')).toHaveCount(11);
  await expect(grid.getByRole('link', { name: /^Napoleon Bonaparte, War strategist/ })).toBeVisible();
  await expect(grid.getByRole('link', { name: / vs / })).toHaveCount(0); // no head-to-heads (owner 2026-10-23)
  await page.getByRole('tab', { name: 'Market legends' }).click();
  await expect(grid.getByRole('link')).toHaveCount(4);
  await expect(grid.getByRole('link', { name: /^Jesse Livermore, Trader/ })).toBeVisible();
  await axe(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a figure: lessons with a trading takeaway, real quotes explained in plain words', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds');
  await page.getByRole('link', { name: /^Napoleon Bonaparte/ }).click();
  await expect(page).toHaveURL(/\/app\/minds\/napoleon$/);
  await expect(page.getByRole('heading', { name: 'Napoleon Bonaparte', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lessons from Napoleon' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lessons from Napoleon' }).getByRole('heading', { level: 3 })).toHaveCount(4);
  await expect(page.getByText('Use it in trading').first()).toBeVisible();
  await expect(page.getByText(/Read over and over again the campaigns of Alexander/)).toBeVisible();
  await expect(page.getByText(/Military Maxims of Napoleon, Maxim 78/).first()).toBeVisible();
  await expect(page.getByText('In plain words').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to turn on' })).toBeVisible();
  // the deeper sections: their story, accounts with sources, and a words-only modern comparison
  await expect(page.getByRole('heading', { name: 'Their story' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How they carried themselves' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fighting next to his men' })).toBeVisible();
  await expect(page.getByText(/the little corporal/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Then & now: Napoleon and Elon Musk' })).toBeVisible();
  await expect(page.getByText(/aren.t connected to Zelos and don.t endorse it/)).toBeVisible();
  await axe(page);
  // who he learned from, linking to their pages
  await expect(page.getByRole('heading', { name: 'Who they learned from' })).toBeVisible();
  await page.getByRole('link', { name: 'Meet Alexander the Great →' }).click();
  await expect(page).toHaveURL(/\/app\/minds\/alexander$/);
  await expect(page.getByRole('heading', { name: 'Alexander the Great', level: 1 })).toBeVisible();
  // the old head-to-head pages go to the grid
  await page.goto('minds/vs/alexander-napoleon');
  await expect(page).toHaveURL(/\/app\/minds$/);
  // a daily-quote notification opens the figure on that quote
  await page.goto('minds/caesar?q=believe');
  await expect(page.getByText('Men willingly believe what they wish.', { exact: false })).toBeInViewport();
  await page.goto('minds/elon');
  await expect(page.getByText('That page isn’t in the Hall of Minds.')).toBeVisible();
});

// scroll lessons (owner 2026-10-23): slides pin, a task opens the next one
const into = async (page: Page, target: ReturnType<Page['locator']>) => {
  for (let i = 0; i < 16; i++) {
    const b = await target.boundingBox();
    if (b && b.y > 110 && b.y + b.height < page.viewportSize()!.height - 80) return;
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(250);
  }
};
// the scrubbed slide eases into place after a scroll: wait until it stops moving before grabbing
const settle = async (page: Page, target: ReturnType<Page['locator']>) => {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const y = Math.round((await target.boundingBox())?.y ?? -1);
    if (y === last) return;
    last = y;
    await page.waitForTimeout(150);
  }
};

test('a scroll lesson with reduced motion: every task works by tapping, and it reads well', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds/napoleon');
  await page.getByRole('link', { name: /Speed is a weapon/ }).click();
  await expect(page).toHaveURL(/\/app\/minds\/napoleon\/learn\/speed$/);
  await expect(page.getByText('Sign in to earn 2 XP a step')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hold to march' })).toBeVisible();
  await expect(page.getByText(/Military Maxims/)).toHaveCount(0); // the next slide waits for the task
  await axe(page);
  await page.getByRole('button', { name: 'Hold to march' }).focus();
  await page.keyboard.down('Space');
  await expect(page.getByText('Your army arrived while the wagons were still on the road.')).toBeVisible({ timeout: 5000 });
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Bring more cannons' }).click();
  await expect(page.getByText('Not quite. Think again.')).toBeVisible();
  await page.getByRole('button', { name: 'Move faster' }).click();
  await expect(page.getByText('Mass times speed: the same army, moving faster, hits harder.')).toBeVisible();
  await page.getByRole('button', { name: 'Send him over the Alps' }).click();
  await expect(page.getByText('Weeks later he won the Battle of Marengo.')).toBeVisible();
  await page.getByRole('button', { name: 'Put my line on the level' }).click();
  await page.getByRole('button', { name: 'Place the order you planned' }).click();
  await expect(page.getByRole('heading', { name: 'Speed is a weapon', level: 2 })).toBeVisible();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '5');
  await axe(page);
  await page.getByRole('link', { name: 'Back to Napoleon', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/minds\/napoleon$/);
});

test('Napoleon\'s other scroll lessons: books, the carved names, Austerlitz, Arcole; every task by tapping', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  // Study the greats: collect (with a wrong item), a tap in the painting
  await page.goto('minds/napoleon/learn/study');
  for (const book of ['Alexander', 'Hannibal', 'Caesar']) await page.getByRole('button', { name: book }).click();
  await expect(page.getByText('He kept going back to them all his life.')).toBeVisible();
  await page.getByRole('button', { name: 'Study the great commanders and copy what worked' }).click();
  await expect(page.getByText(/Maxim 78/)).toBeVisible();
  await page.getByRole('button', { name: 'Bonaparte' }).click();
  await expect(page.getByText('Not that one. Look along the bottom of the rocks.')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Hannibal', exact: true }).click();
  await expect(page.getByText(/Hannibal crossed in 218 BC/)).toBeVisible();
  await page.getByRole('button', { name: "A stranger's hot tip" }).click();
  await expect(page.getByText("Not that one. A tip isn't a strategy.")).toBeVisible();
  await page.getByRole('button', { name: 'Trading 101' }).click();
  await page.getByRole('button', { name: 'The Strategy library' }).click();
  await page.getByRole('button', { name: 'Learn a proven strategy, then adapt it' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // Bring everything to one point: find him, the target zones, pick 3
  await page.goto('minds/napoleon/learn/concentrate');
  await page.getByRole('button', { name: 'Napoleon', exact: true }).click();
  await expect(page.getByText(/General Rapp rides in/)).toBeVisible();
  await page.getByRole('button', { name: 'South' }).click();
  await expect(page.getByText(/That's where they sent their troops/)).toBeVisible();
  await page.getByRole('button', { name: /Pratzen Heights/ }).click();
  await expect(page.getByText(/split the enemy army in two/)).toBeVisible();
  await page.getByRole('button', { name: 'All his strength hit where they were weakest' }).click();
  const check = page.getByRole('button', { name: /^Check/ });
  await expect(check).toBeDisabled();
  for (const o of ['A breakout you planned, with a clear stop', 'A random tip from a group chat', 'A pullback to support on your watchlist']) await page.getByRole('button', { name: o }).click();
  await check.click();
  await expect(page.getByText(/Not all of those are right/)).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'A random tip from a group chat' }).click();
  await page.getByRole('button', { name: 'A trend you understand, with rising volume' }).click();
  await check.click();
  await expect(page.getByText(/That's your one point/)).toBeVisible();
  await page.getByRole('button', { name: 'Close the weakest and focus on the 1 to 3 you understand' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  // The mind wins three quarters: the flag, hold to rally (keyboard), pick 3
  await page.goto('minds/napoleon/learn/mind');
  await page.getByRole('button', { name: 'The flag' }).click();
  await expect(page.getByText(/led the charge onto the bridge himself/)).toBeVisible();
  await page.getByRole('button', { name: 'Hold to rally the troops' }).focus();
  await page.keyboard.down('Space');
  await expect(page.getByText('Their fear turns into fight.')).toBeVisible({ timeout: 5000 });
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Character and how people feel' }).click();
  for (const o of ['Up all night', 'Angry after a loss', 'Bored and want some action']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: 'Take a break and come back sharp' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await axe(page);
});

test.describe('signed in', () => {
  test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');
  test('read a lesson for XP, then turn on daily quotes for 15 tokens', async ({ page }, info) => {
    await page.goto('minds/tesla');
    const uid = await signIn(page, `minds-${info.project.name}-${Date.now()}`);
    const lesson = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Build it in your head first' }) });
    await lesson.getByRole('button', { name: 'Done reading · +10 XP' }).click();
    await expect(page.getByText('+10 XP', { exact: true })).toBeVisible();
    await expect(lesson.getByText('Read ✓')).toBeVisible();
    await expect(page.getByText('1 of 4 lessons read')).toBeVisible();
    await fetch(`${BASE}/wallets/${uid}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { balance: { integerValue: '20' } } }) });
    await page.getByRole('button', { name: 'Turn on · 15 tokens' }).click();
    await expect(page.getByText('Daily quotes from Nikola are on for 30 days')).toBeVisible();
    await expect(page.getByText(/^On until /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add 30 days · 15 tokens' })).toBeVisible();
  });

  test('a scroll lesson, animated: hold, answer, drag Napoleon over the Alps, drag the buy line; 2 XP a step', async ({ page }, info) => {
    await page.goto('minds/napoleon');
    const uid = await signIn(page, `scroll-${info.project.name}-${Date.now()}`);
    await page.getByRole('link', { name: /Speed is a weapon/ }).click();
    const hold = page.getByRole('button', { name: 'Hold to march' });
    await into(page, hold);
    const h = (await hold.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await expect(page.getByText('+2 XP · 1 of 5 steps')).toBeVisible({ timeout: 6000 });
    await page.mouse.up();
    const fast = page.getByRole('button', { name: 'Move faster' });
    await into(page, fast);
    await fast.click();
    await expect(page.getByText('+4 XP · 2 of 5 steps')).toBeVisible();
    const napoleon = page.getByRole('img', { name: 'Napoleon (drag him to Italy)' });
    await into(page, napoleon);
    await settle(page, napoleon);
    const n = (await napoleon.boundingBox())!;
    const italy = (await page.getByText('Italy', { exact: true }).last().boundingBox())!;
    await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2);
    await page.mouse.down();
    await page.mouse.move(italy.x + italy.width / 2, italy.y + 20, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText('Weeks later he won the Battle of Marengo.')).toBeVisible();
    await expect(page.getByText('+6 XP · 3 of 5 steps')).toBeVisible();
    const buy = page.getByText('BUY', { exact: true });
    await into(page, buy);
    await settle(page, buy);
    const b = (await buy.boundingBox())!;
    const support = (await page.getByText('support', { exact: true }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 30, support.y - 8, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText('Now when the price comes down, your order is already waiting.')).toBeVisible();
    const order = page.getByRole('button', { name: 'Place the order you planned' });
    await into(page, order);
    await order.click();
    await expect(page.getByText('You earned 10 XP.')).toBeVisible();
    await expect.poll(async () => (await fetch(`${BASE}/users/${uid}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json())).fields?.mindsDone?.arrayValue?.values?.map((v: { stringValue: string }) => v.stringValue)).toContain('napoleon:speed');
    // again: the steps don't pay twice
    await page.goto('minds/napoleon/learn/speed');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Hold to march' }).focus();
    await page.keyboard.down('Space');
    await expect(page.getByText(/1 of 5 steps/)).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('Space');
    await expect(page.getByText('+0 XP · 1 of 5 steps')).toBeVisible();
  });
});
