/**
 * A small buzz on a few key actions (owner 2026-11-15): Buy and Sell, cancelling an order, opening
 * the phone pull-down. Never on every button. Off in Settings → On your phone (this device only).
 *
 * Android: the Vibration API. iPhone: Safari has no Vibration API; on iOS 18+ toggling a hidden
 * switch control gives the system's light tap, so that's used instead. Other browsers: nothing.
 * Only call it from inside a tap/click handler (browsers ignore it otherwise).
 */
import { readString, writeString } from './storage';

export const HAPTICS_KEY = 'zelosHaptics';
export const hapticsOn = (): boolean => readString(HAPTICS_KEY) !== 'off';
export const setHaptics = (on: boolean): void => writeString(HAPTICS_KEY, on ? 'on' : 'off');

const PATTERN = { tap: 8, success: [10, 40, 14], warn: [18, 30, 18] } as const;
const isIOS = () => typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Whether this device can do it at all (Settings only shows the switch where it can). */
export const hapticsSupported = (): boolean => typeof navigator !== 'undefined' && (typeof navigator.vibrate === 'function' || isIOS());

/**
 * iPhone (iOS 18+): Safari gives the system's light tap when a switch control is toggled. The
 * known-good way to trigger it from a script (owner 2026-11-15: the first version didn't buzz):
 * a fresh hidden <label> wrapping an <input type="checkbox" switch>, clicked once inside the tap
 * handler, then removed. Needs iOS 18+ and Settings → Sounds & Haptics → System Haptics on.
 */
function iosTap(): void {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  document.head.removeChild(label);
}

export function haptic(kind: keyof typeof PATTERN = 'tap'): void {
  if (!hapticsOn() || typeof navigator === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN[kind] as number | number[]);
      return;
    }
    if (!isIOS()) return;
    iosTap();
    // a firmer buzz on iPhone: a second tap right after (inside the same tap, so it still counts)
    if (kind !== 'tap') iosTap();
  } catch {
    /* no buzz is fine */
  }
}
