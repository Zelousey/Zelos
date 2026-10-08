import { describe, expect, it } from 'vitest';
import { parseUserDoc } from '../../data/userDoc';
import { firstSteps, suggestUsername, USERNAME_RE } from './welcome';

const none = { profile: false, trade: false, invited: false };

describe('welcome', () => {
  it('suggests a valid @username from a name', () => {
    expect(suggestUsername('Ada Lovelace')).toBe('ada_lovelace');
    expect(suggestUsername('Zoë  O’Brien')).toBe('zoe_o_brien');
    expect(suggestUsername('Al')).toBe('trader_al');
    expect(suggestUsername('')).toBe('trader');
    expect(suggestUsername('A very long display name indeed', '42')).toMatch(/42$/);
    for (const n of ['Ada Lovelace', '李', '!!!', 'x'.repeat(40)]) expect(USERNAME_RE.test(suggestUsername(n))).toBe(true);
  });
  it('first steps: same steps as the website, a coach step only for new traders', () => {
    const s = firstSteps({ onboard: none, hasUsername: false, hasAccount: false, experience: null, hasCoach: false });
    expect(s.map((x) => [x.id, x.done, x.xp])).toEqual([['profile', false, 25], ['account', false, 0], ['trade', false, 25], ['invite', false, 50]]);
    const n = firstSteps({ onboard: { profile: true, trade: true, invited: false }, hasUsername: false, hasAccount: true, experience: 'new', hasCoach: false });
    expect(n.filter((x) => x.done).map((x) => x.id)).toEqual(['profile', 'account', 'trade']);
    expect(n.at(-1)).toMatchObject({ id: 'coach', optional: true });
    // a website user who already has an @username has done the profile step
    expect(firstSteps({ onboard: none, hasUsername: true, hasAccount: false, experience: 'pro', hasCoach: false }).at(0)?.done).toBe(true);
  });
  it('reads the onboarding flags and experience defensively', () => {
    expect(parseUserDoc({ onboard: { profile: true, trade: 'yes' }, experience: 'pro' })).toMatchObject({ onboard: { profile: true, trade: false, invited: false }, experience: 'pro' });
    expect(parseUserDoc({ onboard: 'x', experience: 'guru' })).toMatchObject({ onboard: none, experience: null });
  });
});
