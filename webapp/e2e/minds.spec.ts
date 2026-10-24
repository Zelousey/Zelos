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

test("Caesar's scroll lessons: the Rubicon, the fake deserter, small causes, the Commentaries; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await page.getByRole('button', { name }).focus();
    await page.keyboard.down('Space');
    await expect(page.getByText(done)).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('Space');
  };
  // Cross the Rubicon: a question, hold to decide, cross the river, pick 3
  await page.goto('minds/caesar');
  await page.getByRole('link', { name: /Cross the Rubicon/ }).click();
  await expect(page).toHaveURL(/\/app\/minds\/caesar\/learn\/rubicon$/);
  await page.getByRole('button', { name: 'Civil war with Rome' }).click();
  await hold('Hold to make up your mind', 'His mind is made up.');
  await expect(page.getByRole('img', { name: 'Caesar (drag him across the Rubicon)' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Cross the Rubicon' }).click();
  await expect(page.getByText(/Within 60 days he held all of Italy/)).toBeVisible();
  for (const o of ["Where you'll get in", "Where your stop goes (where you're wrong)", 'How many shares']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: 'Let the stop do its job' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // People believe what they want to: hold, a question, facts only (a wish bounces back), pick 2
  await page.goto('minds/caesar/learn/believe');
  await hold('Hold to wait in the camp', 'Every day the Gauls grew bolder.');
  await page.getByRole('button', { name: 'It was what they wished were true' }).click();
  await page.getByRole('button', { name: 'We hope they\'ll run' }).click();
  await expect(page.getByText("That's a story you want to believe, not a fact.")).toBeVisible();
  for (const o of ["The Romans haven't left their camp", 'Their camp is on a hill']) await page.getByRole('button', { name: o }).click();
  await expect(page.getByText('Facts, not wishes. The Gauls skipped this step.')).toBeVisible();
  for (const o of ['It closes below your stop', 'Earnings miss and it falls on heavy volume']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: 'Ask what would prove you wrong, and check it' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await axe(page);
  // Small causes, big changes: hold, the wrong wall, overnight surprises, where the $10,000 goes
  await page.goto('minds/caesar/learn/small');
  await hold('Hold to lead the attack', "It starts well. Pompey's men fall back.");
  await page.getByRole('button', { name: 'One wing followed the wrong wall' }).click();
  for (const o of ['A surprise earnings miss', 'The CEO suddenly quits', 'A lawsuit or a product recall']) await page.getByRole('button', { name: o }).click();
  await expect(page.getByText(/Any of these can move a stock 10%/)).toBeVisible();
  await page.getByRole('button', { name: 'All of it in one stock' }).click();
  await expect(page.getByText('A 10% surprise would cost you $1,000 at once.')).toBeVisible();
  await page.getByRole('button', { name: 'Smaller trades, each with a stop' }).click();
  await page.getByRole('button', { name: /About \$1,000/ }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  // Write it down: a question, pick 3, find Caesar in the painting, the journal
  await page.goto('minds/caesar/learn/record');
  await page.getByRole('button', { name: /As “Caesar”/ }).click();
  for (const o of ['The Belgae', 'The Aquitani', /The Celts/]) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: 'Vercingetorix' }).click();
  await expect(page.getByText(/Look for the man sitting calmly in red/)).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Caesar', exact: true }).click();
  await expect(page.getByText(/That's him, calm and seated/)).toBeVisible();
  for (const o of ['Why you got in', 'Where your stop was', 'How it ended', 'How you felt']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /Write down why you got in/ }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test("Alexander's scroll lessons: Aristotle and Bucephalus, Thebes, the Gordian knot, the Granicus; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await page.getByRole('button', { name }).focus();
    await page.keyboard.down('Space');
    await expect(page.getByText(done)).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('Space');
  };
  // Learn from the best: a question, turn the horse, the study list, pick 3
  await page.goto('minds/alexander');
  await page.getByRole('link', { name: /Learn from the best before you lead/ }).click();
  await expect(page).toHaveURL(/\/app\/minds\/alexander\/learn\/study$/);
  await page.getByRole('button', { name: 'Aristotle' }).click();
  await page.getByRole('button', { name: 'Away from the sun' }).click();
  await expect(page.getByText('Then its shadow is right in front of it.')).toBeVisible();
  await page.getByRole('button', { name: 'Toward the sun' }).click();
  await expect(page.getByText(/the horse calmed down/)).toBeVisible();
  await page.getByRole('button', { name: /sure thing/ }).click();
  await expect(page.getByText("A tip isn't study.")).toBeVisible();
  for (const o of ['How the setup works', 'Old charts where it worked, and where it failed', 'Where the stop goes']) await page.getByRole('button', { name: o }).click();
  await axe(page);
  for (const o of ['Read how it works', 'Look at it on old charts', 'Try it with practice money']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: 'Study it on old charts, then try it with practice money' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // Move before the other side is ready: march, a question, the plan, where the order comes from
  await page.goto('minds/alexander/learn/speed');
  await hold('Hold to march south', 'About two weeks later, his army was outside Thebes.');
  await page.getByRole('button', { name: "The other side wasn't ready yet" }).click();
  for (const o of ['Your entry', 'Your stop', 'Your target']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: 'The plan you wrote last night' }).click();
  await page.getByRole('button', { name: 'Stop, make a plan, and only act on the plan' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  // Cut the knot: a question, find the sword, hold to cut, the stop, pick 2
  await page.goto('minds/alexander/learn/knot');
  await page.getByRole('button', { name: 'To rule Asia' }).click();
  await page.getByRole('button', { name: 'The priest' }).click();
  await expect(page.getByText(/Look at what Alexander is holding up/)).toBeVisible();
  await page.getByRole('button', { name: 'The sword' }).click();
  await hold('Hold to cut the knot', 'Cut. Problem solved.');
  await page.getByRole('button', { name: 'Move the stop lower' }).click();
  await expect(page.getByText("That's tying a new knot.")).toBeVisible();
  await page.getByRole('button', { name: 'Sell. The stop did its job' }).click();
  for (const o of ["It'll come back, it always does", "I'll just move my stop a little"]) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await axe(page);
  // Lead from the front: cross the Granicus, find him in the mosaic, a question, pick 2
  await page.goto('minds/alexander/learn/front');
  await expect(page.getByRole('img', { name: 'Alexander (drag him across the Granicus)' })).toBeVisible();
  await page.getByRole('button', { name: 'Lead the charge across' }).click();
  await expect(page.getByText(/his friend Cleitus cut down an attacker/)).toBeVisible();
  await page.getByRole('button', { name: 'Darius' }).click();
  await expect(page.getByText(/Look left for the rider with no helmet/)).toBeVisible();
  await page.getByRole('button', { name: 'Alexander', exact: true }).click();
  await page.getByRole('button', { name: 'He took the same risks they did' }).click();
  for (const o of ['Take your own idea in your practice account', 'Share your losses, not just your wins']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: /Own it/ }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test("Aristotle's scroll lessons: habits, the golden middle, one swallow, aimed anger; every task by tapping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
  const hold = async (name: string, done: string) => {
    await page.getByRole('button', { name }).focus();
    await page.keyboard.down('Space');
    await expect(page.getByText(done)).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('Space');
  };
  // You become what you practice: find him in the School of Athens, a question, hold, the checklist
  await page.goto('minds/aristotle');
  await page.getByRole('link', { name: /You become what you practice/ }).click();
  await expect(page).toHaveURL(/\/app\/minds\/aristotle\/learn\/habits$/);
  await page.getByRole('button', { name: 'Plato' }).click();
  await expect(page.getByText(/That's Plato, pointing up to the sky/)).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Aristotle', exact: true }).click();
  await expect(page.getByText("That's him, holding his Ethics.")).toBeVisible();
  await page.getByRole('button', { name: 'By building' }).click();
  await hold('Hold to repeat it', 'Skill is the sum of what you repeat.');
  await page.getByRole('button', { name: 'Skip it when I feel lucky' }).click();
  await expect(page.getByText("A habit doesn't take days off.")).toBeVisible();
  for (const o of ['Is there a clear setup?', 'Where is my stop?', 'Is the size right?']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: 'Yes, every trade, even the boring ones' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
  // The golden middle: courage in the middle, generosity, pick 2, risk per trade
  await page.goto('minds/aristotle/learn/mean');
  await page.getByRole('button', { name: 'Reckless (too much)' }).click();
  await expect(page.getByText("That's too much.")).toBeVisible();
  await page.getByRole('button', { name: 'The middle' }).click();
  await page.getByRole('button', { name: 'Being stingy and wasting money' }).click();
  for (const o of ['Risk the same small amount on every trade', 'Trade a few good setups a week']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: 'About $100 (1%)' }).click();
  await page.getByRole('button', { name: 'No, keep the same modest size' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  // One good day is not a season: a question, real proof, log 20 trades, the first loss
  await page.goto('minds/aristotle/learn/one-swallow');
  await page.getByRole('button', { name: "One good sign doesn't prove the season has changed" }).click();
  await page.getByRole('button', { name: 'One huge win last week' }).click();
  await expect(page.getByText("That's one swallow.")).toBeVisible();
  for (const o of ['20+ trades, all tracked', 'Wins and losses both written down']) await page.getByRole('button', { name: o }).click();
  await hold('Hold to log 20 trades', 'Now you have enough to judge it.');
  await page.getByRole('button', { name: 'Keep following it, and judge it after 20 trades' }).click();
  await page.getByRole('button', { name: '20 trades with a small, steady edge' }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await axe(page);
  // Feel it, but aim it: cool down, the four rights, warning signs, the next step
  await page.goto('minds/aristotle/learn/anger');
  await hold('Hold to cool down', 'Breathe. Now you can think.');
  for (const o of ['The right person', 'The right amount', 'The right time', 'The right reason']) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  for (const o of ['Doubling your size after a loss', 'Trading a stock you never planned', /get it back/]) await page.getByRole('button', { name: o }).click();
  await page.getByRole('button', { name: 'Jump into another trade now' }).click();
  await expect(page.getByText("That's anger choosing.")).toBeVisible();
  await page.getByRole('button', { name: 'Close the app, come back tomorrow' }).click();
  await page.getByRole('button', { name: "When you're calm and it fits your plan" }).click();
  await expect(page.getByText('Lesson complete')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '5');
});

test('a hold made with the keyboard keeps going when the pointer passes over the button', async ({ page }) => {
  // CI on main 2026-10-24: tapping the sword glides the page, the resting mouse slid over the hold
  // button and off it, and that pointer-leave ended a Space-key hold
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('minds/alexander/learn/knot');
  await page.getByRole('button', { name: 'To rule Asia' }).click();
  await page.getByRole('button', { name: 'The sword' }).click();
  const hold = page.getByRole('button', { name: 'Hold to cut the knot' });
  await hold.focus();
  await page.keyboard.down('Space');
  const b = (await hold.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width / 2, b.y - 40);
  await expect(page.getByText('Cut. Problem solved.')).toBeVisible({ timeout: 5000 });
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
