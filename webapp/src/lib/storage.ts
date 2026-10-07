/**
 * Small wrapper around localStorage.
 *
 * Every read and write is guarded: storage can be missing or throw (private mode,
 * blocked site data). Keeping all access in one place also gives us a single spot to
 * swap in Capacitor Preferences / secure storage when the native app arrives.
 * Never store secrets or auth tokens here; Firebase Auth manages its own session.
 */
export function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting just won't persist */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}
