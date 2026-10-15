/**
 * Chart tools under a chart (owner 2026-10-10): indicators (the engine's registry, remembered
 * on this device and shared with the classic site), Fibonacci retracement over the visible
 * swing, and price alerts: press Alert, then tap a price on the chart; drag a line to move it.
 * Alerts are the engine's store (the same list as the classic site's Trade War alerts, saved
 * on your account); they fire while the app is open (PriceAlertWatcher) and, with it closed,
 * the server checks them on every price update and notifies you (functions/price_alerts.py). The Three-Legged (A-B-C)
 * drawing is left out on purpose: it becomes a token strategy (PROJECT_STATE.md, 2026-10-10).
 * ChartView owns the state; this only shows it.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button, Sheet } from '../../ui';
import { engine, type PriceAlert } from './engine';
import s from './ChartView.module.css';

export type ToolsState = { fib: boolean; placing: boolean; alerts: PriceAlert[] };
export type ToolsActions = { readShow: () => Record<string, boolean>; toggle: (id: string, on: boolean) => void; flipFib: () => void; flipPlacing: () => void; remove: (id: string) => void };

export function ChartTools({ sym, state, act }: { sym: string; state: ToolsState; act: ToolsActions }) {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const groups = [...new Set(engine().INDICATORS.map((i) => i.group))];
  return (
    <div className={s.tools}>
      <div className={s.toolRow} role="toolbar" aria-label={t('ct.tools')}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setShow(act.readShow());
            setOpen(true);
          }}
        >
          {t('ct.indicatorsTitle')}
        </Button>
        <Button size="sm" variant={state.fib ? 'primary' : 'ghost'} aria-pressed={state.fib} onClick={act.flipFib}>
          {t('ct.fib')}
        </Button>
        <Button size="sm" variant={state.placing ? 'primary' : 'ghost'} aria-pressed={state.placing} onClick={act.flipPlacing}>
          ⏰ {t('ct.alert')}
        </Button>
      </div>
      {state.placing && (
        <p className={s.toolHint} role="status">
          {t('ct.placeHint')}
        </p>
      )}
      {state.alerts.length > 0 && (
        <ul className={s.alertList} aria-label={t('ct.alerts', { sym })}>
          {state.alerts.map((a) => (
            <li key={a.id}>
              <span>{t(a.dir === 'above' ? 'ct.above' : 'ct.below', { sym, price: formatPrice(a.price) })}</span>
              <Button size="sm" variant="ghost" onClick={() => act.remove(a.id)} aria-label={t('ct.remove', { price: formatPrice(a.price) })}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
      {state.alerts.length > 0 && (
        <p className={s.toolHint}>
          {t('ct.closedHint')} <Link to="/alerts?tab=notify">{t('ct.closedLink')}</Link>
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('ct.indicatorsTitle')} labelledBy="ct-ind-title">
        {groups.map((g) => (
          <fieldset key={g} className={s.indGroup}>
            <legend>{g}</legend>
            {engine()
              .INDICATORS.filter((i) => i.group === g)
              .map((i) => (
                <label key={i.id} className={s.indRow}>
                  <input
                    type="checkbox"
                    checked={!!show[i.id]}
                    onChange={(e) => {
                      act.toggle(i.id, e.target.checked);
                      setShow((v) => ({ ...v, [i.id]: e.target.checked }));
                    }}
                  />{' '}
                  {i.label}
                </label>
              ))}
          </fieldset>
        ))}
      </Sheet>
    </div>
  );
}
