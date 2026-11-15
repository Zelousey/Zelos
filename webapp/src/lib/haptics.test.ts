import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, HAPTICS_KEY, hapticsOn, setHaptics } from './haptics';

describe('haptics', () => {
  afterEach(() => localStorage.removeItem(HAPTICS_KEY));
  it('buzzes on phones that can, and not when switched off', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    expect(hapticsOn()).toBe(true); // on unless switched off
    haptic('warn');
    expect(vibrate).toHaveBeenCalledWith([18, 30, 18]);
    setHaptics(false);
    haptic();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
