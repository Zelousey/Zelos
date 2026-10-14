/**
 * Push notifications on this phone or computer: the app's version of the website's
 * zelos-push.js, using the same service worker (/firebase-messaging-sw.js at the site
 * root), the same server callables (push_register / push_unregister / push_test) and the
 * same localStorage keys, so turning them on in either place counts for both.
 *
 * Which notifications you get is the switches on the Notifications tab
 * (users/{uid}.notificationPrefs); this only connects the device.
 */
import { callFunction, firebaseApp } from '../../lib/firebase';
import { VAPID_KEY } from '../../lib/firebaseConfig';

const KEY = 'zpToken';
const UKEY = 'zpTokenUid';
const AKEY = 'zpTokenAt';
const SW = '/firebase-messaging-sw.js';
const DAY = 864e5;

export type PushState = 'on' | 'off' | 'blocked' | 'unsupported' | 'ios-home';
export type Env = { supported: boolean; ios: boolean; standalone: boolean; permission: NotificationPermission | null; token: string };

/** Pure: what the device row should say. */
export function pushState(e: Env): PushState {
  if (e.ios && !e.standalone) return 'ios-home';
  if (!e.supported || !e.permission) return 'unsupported';
  if (e.permission === 'denied') return 'blocked';
  if (e.permission !== 'granted') return 'off';
  return e.token ? 'on' : 'off';
}

const ls = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
function save(token: string, uid: string) {
  try {
    if (token) {
      localStorage.setItem(KEY, token);
      localStorage.setItem(UKEY, uid);
      localStorage.setItem(AKEY, String(Date.now()));
    } else [KEY, UKEY, AKEY].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* private mode: it just re-registers next visit */
  }
}

function env(): Env {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return { supported, ios, standalone, permission: 'Notification' in window ? Notification.permission : null, token: ls(KEY) };
}

export const currentPushState = () => pushState(env());

async function token(): Promise<string> {
  const reg = await navigator.serviceWorker.register(SW);
  const m = await import('firebase/messaging');
  return m.getToken(m.getMessaging(firebaseApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
}

async function register(tok: string, uid: string) {
  const prev = ls(KEY);
  await callFunction('push_register', { token: tok });
  if (prev && prev !== tok) callFunction('push_unregister', { token: prev }).catch(() => {});
  save(tok, uid);
}

/** Ask for permission and connect this device. Throws a message to show on failure. */
export async function enablePush(uid: string): Promise<void> {
  const p = await Notification.requestPermission();
  if (p !== 'granted') throw new Error(p === 'denied' ? 'blocked' : 'notAllowed');
  const tok = await token();
  if (!tok) throw new Error('noToken');
  await register(tok, uid);
}

/** Forget this device (the switches on the account stay as they are). */
export async function disablePush(): Promise<void> {
  const tok = ls(KEY);
  save('', '');
  if (tok) await callFunction('push_unregister', { token: tok }).catch(() => {});
  try {
    const m = await import('firebase/messaging');
    await m.deleteToken(m.getMessaging(firebaseApp()));
  } catch {
    /* already gone */
  }
}

/** A test notification to this device. Resolves to how many devices got it. */
export async function testPush(): Promise<number> {
  const r = await callFunction<{ token: string }, { sent: number }>('push_test', { token: ls(KEY) });
  return r.sent;
}

let refreshing: Promise<boolean> | null = null;
/**
 * Every app start, once permission is granted: Firebase rotates device tokens, so get the
 * current one and re-register it if it changed, belongs to another account, or hasn't been
 * confirmed for a day. Keeps notifications connected without anyone turning them off and on.
 */
export function refreshPush(uid: string): Promise<boolean> {
  const e = env();
  if (!e.supported || e.permission !== 'granted' || (e.ios && !e.standalone)) return Promise.resolve(false);
  refreshing ??= token()
    .then(async (tok) => {
      if (!tok) return false;
      const fresh = Date.now() - (Number(ls(AKEY)) || 0) < DAY;
      if (tok === ls(KEY) && ls(UKEY) === uid && fresh) return true;
      await register(tok, uid);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Notifications that arrive while the app is open: call show(title, body) instead of a system pop-up. */
export async function onForegroundPush(show: (title: string, body: string) => void): Promise<() => void> {
  if (currentPushState() !== 'on') return () => {};
  const m = await import('firebase/messaging');
  return m.onMessage(m.getMessaging(firebaseApp()), (p) => show(p.notification?.title ?? 'Zelos', p.notification?.body ?? ''));
}
