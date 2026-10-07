import { describe, expect, it, vi } from 'vitest';
import { restoreRedirect } from './router';

function run(search: string) {
  const replaceState = vi.fn();
  restoreRedirect({ search } as Location, { replaceState } as unknown as History, '/app/');
  return replaceState.mock.calls[0]?.[2];
}

describe('404 redirect restore', () => {
  it('restores an in-app deep link', () => {
    expect(run('?r=' + encodeURIComponent('/app/markets/AAPL?tf=1D'))).toBe('/app/markets/AAPL?tf=1D');
  });
  it('refuses anything outside the app', () => {
    expect(run('?r=' + encodeURIComponent('https://evil.example/'))).toBe('/app/');
    expect(run('?r=' + encodeURIComponent('//evil.example/app/'))).toBe('/app/');
    expect(run('?r=' + encodeURIComponent('/index.html'))).toBe('/app/');
  });
  it('does nothing without ?r', () => {
    expect(run('')).toBeUndefined();
  });
});
