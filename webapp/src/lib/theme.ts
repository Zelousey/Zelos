/**
 * Background theme (Black / Blue / White).
 *
 * Shares the `zelosTheme` localStorage key with the classic site (zelos-theme-toggle.js),
 * so picking a theme in either place applies to both. index.html applies the stored
 * theme before first paint to avoid a flash.
 */
import { readString, writeString } from './storage';

export const THEMES = ['black', 'blue', 'white'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = 'zelosTheme';

export function normalizeTheme(value: string | null | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'black';
}

export function getTheme(): Theme {
  return normalizeTheme(readString(THEME_KEY));
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0c0d10');
}

export function setTheme(theme: Theme): void {
  writeString(THEME_KEY, theme);
  applyTheme(theme);
  // canvases (the chart engine) redraw on this event, same as on the classic site
  window.dispatchEvent(new CustomEvent('zelos:theme', { detail: { theme } }));
}
