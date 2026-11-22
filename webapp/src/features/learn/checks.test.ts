/**
 * The server grades lesson quick checks for review (functions/learnloop.py), so it keeps each
 * lesson's right answer in functions/learn_checks.json. This fails if the two drift.
 * Regenerate after editing a lesson: UPDATE_CHECKS=1 npx vitest run src/features/learn/checks.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { ALL_LESSONS } from './chapters';

const FILE = resolve(__dirname, '../../../../functions/learn_checks.json');

it('functions/learn_checks.json has every quick check answer', () => {
  const want = Object.fromEntries(ALL_LESSONS.map((l) => [l.id, l.check.right]));
  if (process.env.UPDATE_CHECKS) writeFileSync(FILE, JSON.stringify(want, null, 1) + '\n');
  expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(want);
});
