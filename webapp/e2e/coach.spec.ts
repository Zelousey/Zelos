/**
 * Coaching end to end in the browser against the real Python functions on the emulators:
 * a Level 3 coach makes a coach link, a new player accepts it (and sees what the coach will
 * see), the coach reacts to one of the student's trades and sets a custom task, the student
 * marks it done, the coach confirms, and the student ends the coaching. Skipped when
 * functions/venv is missing.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

test.skip(process.env.E2E_FUNCTIONS !== '1', 'needs the Functions emulator (functions/venv)');

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-zelos/databases/(default)/documents';
const put = (path: string, fields: Record<string, unknown>) =>
  fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
const player = async (browser: Browser, info: TestInfo) => (await browser.newContext(info.project.use)).newPage();
async function signIn(page: Page, email: string): Promise<string> {
  await page.waitForFunction(() => typeof (window as unknown as { __zelosTestSignIn?: unknown }).__zelosTestSignIn === 'function');
  return page.evaluate((e) => (window as unknown as { __zelosTestSignIn: (e: string, p: string) => Promise<{ user: { uid: string } }> }).__zelosTestSignIn(e, 'secret123').then((c) => c.user.uid), email);
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id);

test('coach a new player: link, accept, react to a trade, a custom task, end', async ({ browser }, info) => {
  const id = `${info.project.name}${Date.now()}`;

  // a coach below Level 3 sees the lock; at 200 XP the link is made
  const coach = await player(browser, info);
  await coach.goto('coach');
  const coachUid = await signIn(coach, `coach-${id}@example.com`);
  await put(`traders/${coachUid}`, { name: { stringValue: 'Ada' } });
  await expect(coach.getByText(/Coaching unlocks at Level 3/)).toBeVisible();
  await put(`users/${coachUid}`, { xp: { integerValue: '200' } });
  await coach.getByRole('link', { name: 'Invite a student' }).click();
  // the first function call can be a cold start
  await expect(coach.getByRole('heading', { name: 'Your invite is ready' })).toBeVisible({ timeout: 30_000 });
  const code = (await coach.getByLabel('Invite link').inputValue()).split('/').pop()!;

  // the student opens it, sees what the coach will see, accepts
  const student = await player(browser, info);
  await student.goto(`i/${code}`);
  await expect(student.getByRole('heading', { name: /Ada invited you\s*to be your coach/ })).toBeVisible();
  await expect(student.getByText(/Your coach will see your level/)).toBeVisible();
  const studentUid = await signIn(student, `student-${id}@example.com`);
  await put(`traders/${studentUid}`, { name: { stringValue: 'Bo' } });
  await put(`practiceAccounts/${studentUid}/history/trade0001`, {
    kind: { stringValue: 'trade' }, sym: { stringValue: 'TSLA' }, side: { stringValue: 'long' }, qty: { integerValue: '5' },
    entry: { doubleValue: 200 }, exit: { doubleValue: 190 }, pnl: { doubleValue: -50 }, pct: { doubleValue: -5 }, at: { integerValue: String(Date.now()) },
  });
  await student.getByRole('button', { name: 'Accept' }).click();
  await expect(student.getByRole('status').filter({ hasText: 'Coaching started!' })).toBeVisible();
  await student.getByRole('link', { name: 'Open coaching' }).click();
  await expect(student.getByRole('heading', { name: 'Ada is your coach' })).toBeVisible();

  // the coach sees the trade and reacts to it
  await coach.goto('coach');
  await expect(coach.getByText('1/5')).toBeVisible();
  await coach.getByRole('link', { name: /Bo/ }).first().click();
  await expect(coach.getByRole('heading', { name: 'You coach Bo' })).toBeVisible();
  await expect(coach.getByText('TSLA')).toBeVisible();
  await expect(coach.getByText(/5 sh · \$200\.00 → \$190\.00/)).toBeVisible();
  await expect(coach.getByText('2 · Silver')).toBeVisible(); // 50 XP from joining by invite
  await coach.getByRole('button', { name: /Bad move/ }).click();
  await coach.getByLabel('Add a note (optional)').fill('Set a stop-loss next time.');
  await coach.getByRole('button', { name: 'Send', exact: true }).first().click();
  await expect(student.getByText('Set a stop-loss next time.')).toBeVisible();

  // a custom task: the student ticks it, the coach confirms
  await coach.getByLabel('Task', { exact: true }).selectOption('custom');
  await coach.getByLabel('What should they do?').fill('Read the stop-loss guide');
  await coach.getByRole('button', { name: 'Add task' }).click();
  await expect(student.getByText('Read the stop-loss guide')).toBeVisible();
  expect(await axe(coach)).toEqual([]);
  await student.getByRole('button', { name: 'Mark done' }).click();
  await expect(coach.getByText('Waiting for the coach')).toBeVisible();
  await coach.getByRole('button', { name: 'Confirm' }).click();
  await expect(student.getByText('Done', { exact: true })).toBeVisible();
  expect(await axe(student)).toEqual([]);

  // the student can't react to their own trades; they end the coaching
  await expect(student.getByRole('button', { name: /Bad move/ })).toHaveCount(0);
  await student.getByRole('button', { name: 'End coaching' }).click();
  await student.getByRole('dialog').getByRole('button', { name: 'End coaching' }).click();
  await expect(student).toHaveURL(/\/coach$/);
  await expect(coach.getByText('This coaching has ended.').first()).toBeVisible();
  await student.context().close();
  await coach.context().close();
});
