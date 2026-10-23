/**
 * Your chart theme (bought with tokens, cosmetics/{uid}.chart) follows you: while you're signed
 * in, the shared chart engine draws every chart in the app with it. Signed out, or with none
 * on, charts use the plain look and the free candle colours.
 */
import { useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useLooks } from '../profile/profile';
import { engine } from './engine';

export function ChartThemeSync() {
  const { user, isReal } = useAuth();
  const looks = useLooks(isReal && user ? user.uid : null);
  const chart = looks.status === 'ready' ? looks.data.chart : null;
  const settled = looks.status === 'ready' || looks.status === 'missing' || !isReal;
  useEffect(() => {
    if (!settled) return;
    const e = engine();
    if (chart || e.loadTheme()) e.setTheme(chart);
  }, [chart, settled]);
  return null;
}
