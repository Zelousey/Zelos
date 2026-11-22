/**
 * The server grades lesson quick checks for review (functions/learnloop.py), so it keeps each
 * lesson's right answer in functions/learn_checks.json. This fails if the two drift.
 * Regenerate after editing a lesson: UPDATE_CHECKS=1 npx vitest run src/features/learn/checks.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { ALL_LESSONS, lessonChecks, rightAnswer, shownOrder } from './chapters';

const FILE = resolve(__dirname, '../../../../functions/learn_checks.json');

it('functions/learn_checks.json has every quick check answer', () => {
  // "<lesson>" is the first quick check, "<lesson>:2" the second; an order question's answer is [0, 1, …]
  const want = Object.fromEntries(ALL_LESSONS.flatMap((l) => lessonChecks(l).map((c, i) => [i ? `${l.id}:${i + 1}` : l.id, rightAnswer(c)])));
  if (process.env.UPDATE_CHECKS) writeFileSync(FILE, JSON.stringify(want, null, 1) + '\n');
  expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(want);
});

it('order questions never start out already in order', () => {
  for (const n of [3, 4, 5, 6]) expect(shownOrder(n)).not.toEqual(Array.from({ length: n }, (_, i) => i));
});
