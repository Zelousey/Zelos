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
let iosLabel: HTMLLabelElement | null = null;
const isIOS = () => typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

/** Whether this device can do it at all (Settings only shows the switch where it can). */
export const hapticsSupported = (): boolean => typeof navigator !== 'undefined' && (typeof navigator.vibrate === 'function' || isIOS());

export function haptic(kind: keyof typeof PATTERN = 'tap'): void {
  if (!hapticsOn() || typeof navigator === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN[kind] as number | number[]);
      return;
    }
    if (!isIOS()) return;
    if (!iosLabel) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'zelos-haptic';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      iosLabel = document.createElement('label');
      iosLabel.htmlFor = input.id;
      iosLabel.setAttribute('aria-hidden', 'true');
      for (const el of [input, iosLabel]) el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.append(input, iosLabel);
    }
    iosLabel.click();
  } catch {
    /* no buzz is fine */
  }
}
