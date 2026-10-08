/**
 * The launch animation lives in index.html (it paints before this code loads). Once the app
 * has rendered, hide it after it has had about a second to play (half that for reduced motion).
 */
type Splash = { t: number; done: () => void };

export function hideSplash() {
  const z = (window as unknown as { __zsplash?: Splash }).__zsplash;
  if (!z) return;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = Math.max(0, (reduced ? 500 : 1100) - (performance.now() - z.t));
  setTimeout(z.done, wait);
}
