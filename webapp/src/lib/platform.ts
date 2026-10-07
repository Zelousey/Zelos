/**
 * Where the app is running. Today: always the web. When the Capacitor shell arrives,
 * `isNative()` becomes true inside the iOS/Android app and code that needs a native
 * plugin (push, secure storage, haptics, sign-in, purchases) branches on it here,
 * in one place. See docs/APP_ARCHITECTURE.md → "Native (Capacitor) readiness".
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function cap(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return !!cap()?.isNativePlatform?.();
}

export function platform(): 'web' | 'ios' | 'android' {
  const p = cap()?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/** The classic site's origin, for links to pages that haven't moved into the app yet. */
export function classicUrl(path: string): string {
  const clean = path.replace(/^\//, '');
  // On the web the classic site is the same origin. Inside the native app it must be the public site.
  return isNative() ? `https://agentictrading.info/${clean}` : `/${clean}`;
}
