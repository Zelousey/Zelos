import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { needsSlot, SLOT_COST, SLOT_FREE } from './slots';

describe('battle slots', () => {
  it('match the server (functions/main.py)', () => {
    const py = readFileSync(resolve(__dirname, '../../../../functions/main.py'), 'utf8');
    expect(py).toContain(`TW_FREE_SLOTS = ${SLOT_FREE}\n`);
    expect(py).toMatch(new RegExp(`"slot": ${SLOT_COST},`));
  });
  it('only the server’s slot refusal asks to pay', () => {
    expect(needsSlot({ details: { reason: 'battle-slot', cost: 15 } })).toBe(true);
    expect(needsSlot({ message: 'This Trade War is full.' })).toBe(false);
    expect(needsSlot({ details: { reason: 'other' } })).toBe(false);
    expect(needsSlot(null)).toBe(false);
  });
});
