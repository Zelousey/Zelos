import { beforeEach, describe, expect, it } from 'vitest';
import { getTheme, normalizeTheme, setTheme, THEME_KEY } from './theme';

describe('theme', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to black and ignores retired values', () => {
    expect(getTheme()).toBe('black');
    expect(normalizeTheme('brown')).toBe('black');
  });
  it('shares the classic site key and applies to <html>', () => {
    setTheme('white');
    expect(localStorage.getItem(THEME_KEY)).toBe('white');
    expect(document.documentElement.getAttribute('data-theme')).toBe('white');
  });
});
