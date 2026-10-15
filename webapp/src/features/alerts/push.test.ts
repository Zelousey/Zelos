import { describe, expect, it } from 'vitest';
import { pushState, type Env } from './push';

const base: Env = { supported: true, ios: false, standalone: false, permission: 'default', token: '' };

describe('pushState', () => {
  it('asks to turn on until permission is granted and a token is saved', () => {
    expect(pushState(base)).toBe('off');
    expect(pushState({ ...base, permission: 'granted' })).toBe('off');
    expect(pushState({ ...base, permission: 'granted', token: 'abc' })).toBe('on');
  });
  it('says blocked when the browser refused', () => {
    expect(pushState({ ...base, permission: 'denied' })).toBe('blocked');
  });
  it('sends iPhone users to the Home Screen first', () => {
    expect(pushState({ ...base, ios: true })).toBe('ios-home');
    expect(pushState({ ...base, ios: true, standalone: true, permission: 'granted', token: 'abc' })).toBe('on');
  });
  it('says unsupported without service workers or the Notification API', () => {
    expect(pushState({ ...base, supported: false })).toBe('unsupported');
    expect(pushState({ ...base, permission: null })).toBe('unsupported');
  });
});
