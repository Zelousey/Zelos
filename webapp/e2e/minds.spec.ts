/**
 * Hall of Minds (owner 2026-10-22/23): the opening book animation, the red-card grid with its
 * tabs, a figure's story, accounts, who they learned from, lessons and explained quotes, and (with
 * the Functions emulator) reading a lesson for XP and turning on a figure's daily quotes with tokens.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
async function signIn(page: Page, who: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((email) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(email, 'secret123').then((c) => c.user.uid), `${who}@example.com`);
}
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((x) => x.id)).toEqual([]);

test('the opening book flips through every great mind each time you come in, and can be skipped', async ({ page }) => {
  await page.goto('minds');
  const book = page.getByTestId('book-intro');
  await expect(book).toBeVisible();
  // every page turns (owner 2026-10-24: it used to look stuck on the first quote)
  await expect(book.locator('[data-page]')).toHaveCount(11);
  await expect(book.locator('[data-page="10"]')).toHaveClass(/flipped/, { timeout: 6000 });
  await expect(book).toHaveCount(0, { timeout: 6000 }); // then fades into the grid
  // back to the grid from a figure: no book again
  await page.getByRole('link', { name: /^Napoleon Bonaparte/ }).click();
  await expect(page.getByRole('heading', { name: 'Napoleon Bonaparte', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Hall of Minds', level: 1 })).toBeVisible();
  await expect(book).toHaveCount(0);
  // coming in again plays it again, and Skip closes it
  await page.reload();
  const skip = page.getByRole('button', { name: 'Skip' });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(book).toHaveCount(0);
  // a link straight to a figure opens without it
  await page.goto('minds/caesar');
  await expect(page.getByRole('heading', { name: 'Julius Caesar', level: 1 })).toBeVisible();
  await expect(book).toHaveCount(0);
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
// swipe-page lessons (owner 2026-10-24): only the current page is on screen, so tap Next until the
// target shows (a task page's Next stays off until its task is done)
const reach = async (page: Page, target: Locator) => {
  for (let i = 0; i < 24; i++) {
    if (await target.waitFor({ state: 'visible', timeout: 250 }).then(() => true, () => false)) break;
    // look without waiting: a task finishing while we wait would turn Next on and skip its page
    const next = page.getByRole('button', { name: /^Next/ });
    if ((await next.count()) === 0 || !(await next.isEnabled())) break;
    await next.click();
  }
  return target;
};
// a lesson is now many short pages: give the walk-through tests room
test.describe.configure({ timeout: 120_000 });
const tap = async (page: Page, target: Locator) => (await reach(page, target)).click();
const see = async (page: Page, target: Locator) => expect(await reach(page, target)).toBeVisible();

test('a scroll lesson with reduced motion: every task works by tapping, and it reads well', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds/napoleon');
  await tap(page, page.getByRole('link', { name: /Speed is a weapon/ }));
  await expect(page).toHaveURL(/\/app\/minds\/napoleon\/learn\/speed$/);
  await see(page, page.getByText('Sign in to earn 2 XP a step'));
  await see(page, page.getByRole('button', { name: 'Hold to march' }));
  await expect(page.getByText(/Military Maxims/)).toHaveCount(0); // the next slide waits for the task
  await axe(page);
  await (await reach(page, page.getByRole('button', { name: 'Hold to march' }))).focus();
  await page.keyboard.down('Space');
  await see(page, page.getByText('Your army arrived while the wagons were still on the road.'));
  await page.keyboard.up('Space');
  await tap(page, page.getByRole('button', { name: 'Bring more cannons' }));
  await see(page, page.getByText('Not quite. Think again.'));
  await tap(page, page.getByRole('button', { name: 'Move faster' }));
  await see(page, page.getByText('Mass times speed: the same army, moving faster, hits harder.'));
  await tap(page, page.getByRole('button', { name: 'Send him over the Alps' }));
  await see(page, page.getByText('Weeks later he won the Battle of Marengo.'));
  await tap(page, page.getByRole('button', { name: 'Put my line on the level' }));
  await tap(page, page.getByRole('button', { name: 'Place the order you planned' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(page.getByRole('heading', { name: 'Speed is a weapon', level: 2 })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '5');
  await axe(page);
  await tap(page, page.getByRole('link', { name: 'Back to Napoleon', exact: true }));
  await expect(page).toHaveURL(/\/app\/minds\/napoleon$/);
});

test('Napoleon\'s other scroll lessons: books, the carved names, Austerlitz, Arcole; every task by tapping', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  // Study the greats: collect (with a wrong item), a tap in the painting
  await page.goto('minds/napoleon/learn/study');
  for (const book of ['Alexander', 'Hannibal', 'Caesar']) await tap(page, page.getByRole('button', { name: book }));
  await see(page, page.getByText('He kept going back to them all his life.'));
  await see(page, page.getByText(/Maxim 78/));
  await tap(page, page.getByRole('button', { name: 'Study the great commanders and copy what worked' }));
  await tap(page, page.getByRole('button', { name: 'Bonaparte' }));
  await see(page, page.getByText('Not that one. Look along the bottom of the rocks.'));
  await axe(page);
  await tap(page, page.getByRole('button', { name: 'Hannibal', exact: true }));
  await see(page, page.getByText(/Hannibal crossed in 218 BC/));
  await tap(page, page.getByRole('button', { name: "A stranger's hot tip" }));
  await see(page, page.getByText("Not that one. A tip isn't a strategy."));
  await tap(page, page.getByRole('button', { name: 'Trading 101' }));
  await tap(page, page.getByRole('button', { name: 'The Strategy library' }));
  await tap(page, page.getByRole('button', { name: 'Learn a proven strategy, then adapt it' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // Bring everything to one point: find him, the target zones, pick 3
  await page.goto('minds/napoleon/learn/concentrate');
  await tap(page, page.getByRole('button', { name: 'Napoleon', exact: true }));
  await see(page, page.getByText(/General Rapp rides in/));
  await tap(page, page.getByRole('button', { name: 'South' }));
  await see(page, page.getByText(/That's where they sent their troops/));
  await tap(page, page.getByRole('button', { name: /Pratzen Heights/ }));
  await see(page, page.getByText(/split the enemy army in two/));
  await tap(page, page.getByRole('button', { name: 'All his strength hit where they were weakest' }));
  const check = page.getByRole('button', { name: /^Check/ });
  await expect(await reach(page, check)).toBeDisabled();
  for (const o of ['A breakout you planned, with a clear stop', 'A random tip from a group chat', 'A pullback to support on your watchlist']) await tap(page, page.getByRole('button', { name: o }));
  await check.click();
  await see(page, page.getByText(/Not all of those are right/));
  await axe(page);
  await tap(page, page.getByRole('button', { name: 'A random tip from a group chat' }));
  await tap(page, page.getByRole('button', { name: 'A trend you understand, with rising volume' }));
  await check.click();
  await see(page, page.getByText(/That's your one point/));
  await tap(page, page.getByRole('button', { name: 'Close the weakest and focus on the 1 to 3 you understand' }));
  await see(page, page.getByText('Lesson complete'));
  // The mind wins three quarters: the flag, hold to rally (keyboard), pick 3
  await page.goto('minds/napoleon/learn/mind');
  await tap(page, page.getByRole('button', { name: 'The flag' }));
  await see(page, page.getByText(/led the charge onto the bridge himself/));
  await (await reach(page, page.getByRole('button', { name: 'Hold to rally the troops' }))).focus();
  await page.keyboard.down('Space');
  await see(page, page.getByText('Their fear turns into fight.'));
  await page.keyboard.up('Space');
  await tap(page, page.getByRole('button', { name: 'Character and how people feel' }));
  for (const o of ['Up all night', 'Angry after a loss', 'Bored and want some action']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'Take a break and come back sharp' }));
  await see(page, page.getByText('Lesson complete'));
  await axe(page);
});

test("Caesar's scroll lessons: the Rubicon, the fake deserter, small causes, the Commentaries; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await (await reach(page, page.getByRole('button', { name }))).focus();
    await page.keyboard.down('Space');
    await see(page, page.getByText(done));
    await page.keyboard.up('Space');
  };
  // Cross the Rubicon: a question, hold to decide, cross the river, pick 3
  await page.goto('minds/caesar');
  await tap(page, page.getByRole('link', { name: /Cross the Rubicon/ }));
  await expect(page).toHaveURL(/\/app\/minds\/caesar\/learn\/rubicon$/);
  await tap(page, page.getByRole('button', { name: 'Civil war with Rome' }));
  await hold('Hold to make up your mind', 'His mind is made up.');
  await see(page, page.getByRole('img', { name: 'Caesar (drag him across the Rubicon)' }));
  await axe(page);
  await tap(page, page.getByRole('button', { name: 'Cross the Rubicon' }));
  await see(page, page.getByText(/Within 60 days he held all of Italy/));
  for (const o of ["Where you'll get in", "Where your stop goes (where you're wrong)", 'How many shares']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'Let the stop do its job' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // People believe what they want to: hold, a question, facts only (a wish bounces back), pick 2
  await page.goto('minds/caesar/learn/believe');
  await hold('Hold to wait in the camp', 'Every day the Gauls grew bolder.');
  await tap(page, page.getByRole('button', { name: 'It was what they wished were true' }));
  await tap(page, page.getByRole('button', { name: 'We hope they\'ll run' }));
  await see(page, page.getByText("That's a story you want to believe, not a fact."));
  for (const o of ["The Romans haven't left their camp", 'Their camp is on a hill']) await tap(page, page.getByRole('button', { name: o }));
  await see(page, page.getByText('Facts, not wishes. The Gauls skipped this step.'));
  for (const o of ['It closes below your stop', 'Earnings miss and it falls on heavy volume']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'Ask what would prove you wrong, and check it' }));
  await see(page, page.getByText('Lesson complete'));
  await axe(page);
  // Small causes, big changes: hold, the wrong wall, overnight surprises, where the $10,000 goes
  await page.goto('minds/caesar/learn/small');
  await hold('Hold to lead the attack', "It starts well. Pompey's men fall back.");
  await tap(page, page.getByRole('button', { name: 'One wing followed the wrong wall' }));
  for (const o of ['A surprise earnings miss', 'The CEO suddenly quits', 'A lawsuit or a product recall']) await tap(page, page.getByRole('button', { name: o }));
  await see(page, page.getByText(/Any of these can move a stock 10%/));
  await tap(page, page.getByRole('button', { name: 'All of it in one stock' }));
  await see(page, page.getByText('A 10% surprise would cost you $1,000 at once.'));
  await tap(page, page.getByRole('button', { name: 'Smaller trades, each with a stop' }));
  await tap(page, page.getByRole('button', { name: /About \$1,000/ }));
  await see(page, page.getByText('Lesson complete'));
  // Write it down: a question, pick 3, find Caesar in the painting, the journal
  await page.goto('minds/caesar/learn/record');
  await tap(page, page.getByRole('button', { name: /As “Caesar”/ }));
  for (const o of ['The Belgae', 'The Aquitani', /The Celts/]) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'Vercingetorix' }));
  await see(page, page.getByText(/Look for the man sitting calmly in red/));
  await axe(page);
  await tap(page, page.getByRole('button', { name: 'Caesar', exact: true }));
  await see(page, page.getByText(/That's him, calm and seated/));
  for (const o of ['Why you got in', 'Where your stop was', 'How it ended', 'How you felt']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /Write down why you got in/ }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test("Alexander's scroll lessons: Aristotle and Bucephalus, Thebes, the Gordian knot, the Granicus; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await (await reach(page, page.getByRole('button', { name }))).focus();
    await page.keyboard.down('Space');
    await see(page, page.getByText(done));
    await page.keyboard.up('Space');
  };
  // Learn from the best: a question, turn the horse, the study list, pick 3
  await page.goto('minds/alexander');
  await tap(page, page.getByRole('link', { name: /Learn from the best before you lead/ }));
  await expect(page).toHaveURL(/\/app\/minds\/alexander\/learn\/study$/);
  await tap(page, page.getByRole('button', { name: 'Aristotle' }));
  await tap(page, page.getByRole('button', { name: 'Away from the sun' }));
  await see(page, page.getByText('Then its shadow is right in front of it.'));
  await tap(page, page.getByRole('button', { name: 'Toward the sun' }));
  await see(page, page.getByText(/the horse calmed down/));
  await tap(page, page.getByRole('button', { name: /sure thing/ }));
  await see(page, page.getByText("A tip isn't study."));
  for (const o of ['How the setup works', 'Old charts where it worked, and where it failed', 'Where the stop goes']) await tap(page, page.getByRole('button', { name: o }));
  await axe(page);
  for (const o of ['Read how it works', 'Look at it on old charts', 'Try it with practice money']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'Study it on old charts, then try it with practice money' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // Move before the other side is ready: march, a question, the plan, where the order comes from
  await page.goto('minds/alexander/learn/speed');
  await hold('Hold to march south', 'About two weeks later, his army was outside Thebes.');
  await tap(page, page.getByRole('button', { name: "The other side wasn't ready yet" }));
  for (const o of ['Your entry', 'Your stop', 'Your target']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: 'The plan you wrote last night' }));
  await tap(page, page.getByRole('button', { name: 'Stop, make a plan, and only act on the plan' }));
  await see(page, page.getByText('Lesson complete'));
  // Cut the knot: a question, find the sword, hold to cut, the stop, pick 2
  await page.goto('minds/alexander/learn/knot');
  await tap(page, page.getByRole('button', { name: 'To rule Asia' }));
  await tap(page, page.getByRole('button', { name: 'The priest' }));
  await see(page, page.getByText(/Look at what Alexander is holding up/));
  await tap(page, page.getByRole('button', { name: 'The sword' }));
  await hold('Hold to cut the knot', 'Cut. Problem solved.');
  await tap(page, page.getByRole('button', { name: 'Move the stop lower' }));
  await see(page, page.getByText("That's tying a new knot."));
  await tap(page, page.getByRole('button', { name: 'Sell. The stop did its job' }));
  for (const o of ["It'll come back, it always does", "I'll just move my stop a little"]) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await see(page, page.getByText('Lesson complete'));
  await axe(page);
  // Lead from the front: cross the Granicus, find him in the mosaic, a question, pick 2
  await page.goto('minds/alexander/learn/front');
  await see(page, page.getByRole('img', { name: 'Alexander (drag him across the Granicus)' }));
  await tap(page, page.getByRole('button', { name: 'Lead the charge across' }));
  await see(page, page.getByText(/his friend Cleitus cut down an attacker/));
  await tap(page, page.getByRole('button', { name: 'Darius' }));
  await see(page, page.getByText(/Look left for the rider with no helmet/));
  await tap(page, page.getByRole('button', { name: 'Alexander', exact: true }));
  await tap(page, page.getByRole('button', { name: 'He took the same risks they did' }));
  for (const o of ['Take your own idea in your practice account', 'Share your losses, not just your wins']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: /Own it/ }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test("Aristotle's scroll lessons: habits, the golden middle, one swallow, aimed anger; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await (await reach(page, page.getByRole('button', { name }))).focus();
    await page.keyboard.down('Space');
    await see(page, page.getByText(done));
    await page.keyboard.up('Space');
  };
  // You become what you practice: find him in the School of Athens, a question, hold, the checklist
  await page.goto('minds/aristotle');
  await tap(page, page.getByRole('link', { name: /You become what you practice/ }));
  await expect(page).toHaveURL(/\/app\/minds\/aristotle\/learn\/habits$/);
  await tap(page, page.getByRole('button', { name: 'Plato' }));
  await see(page, page.getByText(/That's Plato, pointing up to the sky/));
  await axe(page);
  await tap(page, page.getByRole('button', { name: 'Aristotle', exact: true }));
  await see(page, page.getByText("That's him, holding his Ethics."));
  await tap(page, page.getByRole('button', { name: 'By building' }));
  await hold('Hold to repeat it', 'Skill is the sum of what you repeat.');
  await tap(page, page.getByRole('button', { name: 'Skip it when I feel lucky' }));
  await see(page, page.getByText("A habit doesn't take days off."));
  for (const o of ['Is there a clear setup?', 'Where is my stop?', 'Is the size right?']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: 'Yes, every trade, even the boring ones' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // The golden middle: courage in the middle, generosity, pick 2, risk per trade
  await page.goto('minds/aristotle/learn/mean');
  await tap(page, page.getByRole('button', { name: 'Reckless (too much)' }));
  await see(page, page.getByText("That's too much."));
  await tap(page, page.getByRole('button', { name: 'The middle' }));
  await tap(page, page.getByRole('button', { name: 'Being stingy and wasting money' }));
  for (const o of ['Risk the same small amount on every trade', 'Trade a few good setups a week']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'About $100 (1%)' }));
  await tap(page, page.getByRole('button', { name: 'No, keep the same modest size' }));
  await see(page, page.getByText('Lesson complete'));
  // One good day is not a season: a question, real proof, log 20 trades, the first loss
  await page.goto('minds/aristotle/learn/one-swallow');
  await tap(page, page.getByRole('button', { name: "One good sign doesn't prove the season has changed" }));
  await tap(page, page.getByRole('button', { name: 'One huge win last week' }));
  await see(page, page.getByText("That's one swallow."));
  for (const o of ['20+ trades, all tracked', 'Wins and losses both written down']) await tap(page, page.getByRole('button', { name: o }));
  await hold('Hold to log 20 trades', 'Now you have enough to judge it.');
  await tap(page, page.getByRole('button', { name: 'Keep following it, and judge it after 20 trades' }));
  await tap(page, page.getByRole('button', { name: '20 trades with a small, steady edge' }));
  await see(page, page.getByText('Lesson complete'));
  await axe(page);
  // Feel it, but aim it: cool down, the four rights, warning signs, the next step
  await page.goto('minds/aristotle/learn/anger');
  await hold('Hold to cool down', 'Breathe. Now you can think.');
  for (const o of ['The right person', 'The right amount', 'The right time', 'The right reason']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  for (const o of ['Doubling your size after a loss', 'Trading a stock you never planned', /get it back/]) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: 'Jump into another trade now' }));
  await see(page, page.getByText("That's anger choosing."));
  await tap(page, page.getByRole('button', { name: 'Close the app, come back tomorrow' }));
  await tap(page, page.getByRole('button', { name: "When you're calm and it fits your plan" }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test('answers say Correct! or Not quite, questions sit inside their box, tap spots sit on the painting', async ({ page }) => {
  // owner 2026-10-24: a two-line question ran into the box border, and the found-it box sat on the credit
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds/napoleon/learn/study');
  for (const book of ['Alexander', 'Hannibal', 'Caesar']) await tap(page, page.getByRole('button', { name: book }));
  await tap(page, page.getByRole('button', { name: 'Forget the past and invent everything new' }));
  await see(page, page.getByText('Not quite. Think again.'));
  await tap(page, page.getByRole('button', { name: 'Study the great commanders and copy what worked' }));
  await see(page, page.getByText(/^Correct! Learn from the best/));
  const box = (await page.locator('[data-task] [role="group"]').boundingBox())!;
  const q = (await page.getByText('What did he tell his officers to do?').boundingBox())!;
  expect(q.y).toBeGreaterThan(box.y);
  await tap(page, page.getByRole('button', { name: 'Bonaparte' }));
  await see(page, page.getByText(/^Not quite\. Not that one/));
  await tap(page, page.getByRole('button', { name: 'Hannibal', exact: true }));
  const img = (await page.locator('[data-task] figure img').boundingBox())!;
  const spot = (await page.getByRole('button', { name: 'Hannibal', exact: true }).boundingBox())!;
  expect(spot.y + spot.height).toBeLessThanOrEqual(img.y + img.height + 1);
  expect(spot.y).toBeGreaterThanOrEqual(img.y - 1);
});

test("Franklin's scroll lessons: money makes money, time is money, the virtues chart, haste makes waste; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await (await reach(page, page.getByRole('button', { name }))).focus();
    await page.keyboard.down('Space');
    await see(page, page.getByText(done));
    await page.keyboard.up('Space');
  };
  // Money makes money: a question, hold to grow, which grows more, keep it growing, the 50% loss
  await page.goto('minds/franklin');
  await tap(page, page.getByRole('link', { name: /Money makes money/ }));
  await expect(page).toHaveURL(/\/app\/minds\/franklin\/learn\/compound$/);
  await tap(page, page.getByRole('button', { name: 'Produce more of' }));
  await hold('Hold to let it grow', 'At 1% a month, $1,000 becomes about $3,300 in 10 years.');
  await tap(page, page.getByRole('button', { name: 'A lucky double, then giving it back' }));
  await see(page, page.getByText(/back near where you started/));
  await tap(page, page.getByRole('button', { name: '1% a month, kept and grown' }));
  await tap(page, page.getByRole('button', { name: 'One big bet to get rich fast' }));
  await see(page, page.getByText('A big loss stops the growing.'));
  for (const o of ['Small, steady gains', 'Small losses, cut quickly', 'Keeping your gains in the account']) await tap(page, page.getByRole('button', { name: o }));
  await axe(page);
  await tap(page, page.getByRole('button', { name: '100%' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // Time is money: two questions, where the time goes, a trading day, an alert
  await page.goto('minds/franklin/learn/time');
  await tap(page, page.getByRole('button', { name: 'An hour wasted is money you could have earned' }));
  await tap(page, page.getByRole('button', { name: 'What good shall I do this day?' }));
  await tap(page, page.getByRole('button', { name: 'Planning before, reviewing after' }));
  for (const o of ['Plan before the open', 'Set alerts at your levels', 'Review after the close']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: 'Set an alert and get on with your day' }));
  await see(page, page.getByText('Lesson complete'));
  // Track yourself: pick 3 virtues, 13 weeks, the scorecard, a slip
  await page.goto('minds/franklin/learn/virtues');
  for (const o of ['Order', 'Frugality', 'Silence']) await tap(page, page.getByRole('button', { name: o, exact: true }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: '13', exact: true }));
  await tap(page, page.getByRole('button', { name: 'Did I make money today?' }));
  await see(page, page.getByText('A lucky day can break the plan. Score the plan.'));
  for (const o of ['Did I follow my plan?', 'Did I respect my stops?', 'Did I size each trade right?']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: 'Mark it, and work on that one habit next week' }));
  await tap(page, page.getByRole('button', { name: /Not yet: the habit is slipping/ }));
  await see(page, page.getByText('Lesson complete'));
  await axe(page);
  // Haste makes waste: Poor Richard, pick 2, wait for the pullback, hold, a missed breakout
  await page.goto('minds/franklin/learn/haste');
  await tap(page, page.getByRole('button', { name: 'A character Franklin made up' }));
  for (const o of ['Haste makes waste', 'Look before you leap']) await tap(page, page.getByRole('button', { name: o }));
  await tap(page, page.getByRole('button', { name: /^Check/ }));
  await tap(page, page.getByRole('button', { name: 'Wait for the pullback' }));
  await see(page, page.getByText(/your order is waiting/));
  await hold('Hold to wait for the next setup', "There's always another setup.");
  await tap(page, page.getByRole('button', { name: 'Wait for the next setup' }));
  await see(page, page.getByText('Lesson complete'));
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test('a hold made with the keyboard keeps going when the pointer passes over the button', async ({ page }) => {
  // CI on main 2026-10-24: tapping the sword glides the page, the resting mouse slid over the hold
  // button and off it, and that pointer-leave ended a Space-key hold
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds/alexander/learn/knot');
  await tap(page, page.getByRole('button', { name: 'To rule Asia' }));
  await tap(page, page.getByRole('button', { name: 'The sword' }));
  const hold = page.getByRole('button', { name: 'Hold to cut the knot' });
  await (await reach(page, hold)).focus();
  await page.keyboard.down('Space');
  const b = (await hold.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width / 2, b.y - 40);
  await see(page, page.getByText('Cut. Problem solved.'));
  await page.keyboard.up('Space');
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

  test('a swipe lesson, animated: hold, answer, drag Napoleon over the Alps, drag the buy line; 2 XP a step', async ({ page }, info) => {
    await page.goto('minds/napoleon');
    const uid = await signIn(page, `scroll-${info.project.name}-${Date.now()}`);
    await page.getByRole('link', { name: /Speed is a weapon/ }).click();
    // one wheel turn moves exactly one page (owner 2026-10-24: no long scrolling)
    await expect(page.getByRole('heading', { name: 'Speed is a weapon', level: 1 })).toBeVisible();
    const deck = (await page.getByRole('region', { name: 'Speed is a weapon' }).boundingBox())!;
    await page.mouse.move(deck.x + deck.width / 2, deck.y + deck.height / 2);
    await page.mouse.wheel(0, 300);
    await expect(page.getByText(/^Spring 1796/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Speed is a weapon', level: 1 })).toHaveCount(0);
    const hold = await reach(page, page.getByRole('button', { name: 'Hold to march' }));
    await expect(page.getByRole('button', { name: /^Do the task to go on/ })).toBeDisabled(); // a task gates the next page
    await page.waitForTimeout(600); // the page slides in
    const h = (await hold.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await expect(page.getByText('+2 XP · 1 of 5 steps')).toBeVisible({ timeout: 6000 });
    await page.mouse.up();
    await tap(page, page.getByRole('button', { name: 'Move faster' }));
    await expect(page.getByText('+4 XP · 2 of 5 steps')).toBeVisible();
    const napoleon = await reach(page, page.getByRole('img', { name: 'Napoleon (drag him to Italy)' }));
    await page.waitForTimeout(600);
    const n = (await napoleon.boundingBox())!;
    const italy = (await page.getByText('Italy', { exact: true }).last().boundingBox())!;
    await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2);
    await page.mouse.down();
    await page.mouse.move(italy.x + italy.width / 2, italy.y + 20, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText(/Weeks later he won the Battle of Marengo/)).toBeVisible();
    await expect(page.getByText('+6 XP · 3 of 5 steps')).toBeVisible();
    const buy = await reach(page, page.getByText('BUY', { exact: true }));
    await page.waitForTimeout(600);
    const b = (await buy.boundingBox())!;
    const support = (await page.getByText('support', { exact: true }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 30, support.y - 8, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText(/Now when the price comes down, your order is already waiting/)).toBeVisible();
    await tap(page, page.getByRole('button', { name: 'Place the order you planned' }));
    await see(page, page.getByText('You earned 10 XP.'));
    await expect.poll(async () => (await fetch(`${BASE}/users/${uid}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json())).fields?.mindsDone?.arrayValue?.values?.map((v: { stringValue: string }) => v.stringValue)).toContain('napoleon:speed');
    // again: the steps don't pay twice
    await page.goto('minds/napoleon/learn/speed');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await (await reach(page, page.getByRole('button', { name: 'Hold to march' }))).focus();
    await page.keyboard.down('Space');
    await expect(page.getByText(/1 of 5 steps/)).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('Space');
    await expect(page.getByText('+0 XP · 1 of 5 steps')).toBeVisible();
  });
});
