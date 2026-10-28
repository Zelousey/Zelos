/**
 * Candle colours (owner 2026-10-27: "green and red unless someone changes in the settings"). The
 * free presets from the shared chart engine (practice-chart.js, the same list as the classic site);
 * saved on this device and applied to every open chart at once. A chart theme bought with tokens
 * draws its own colours on top.
 */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { engine, setCandleColors } from '../charts/engine';
import s from './SettingsPage.module.css';

export function ChartColors() {
  const presets = engine().PRESETS;
  const [current, setCurrent] = useState(() => engine().loadColors().id);
  return (
    <div className={s.swatches} role="radiogroup" aria-label={t('settings.candles')}>
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={current === p.id}
          className={s.swatch}
          onClick={() => {
            setCandleColors(p);
            setCurrent(p.id);
          }}
        >
          <span className={s.candles} aria-hidden>
            <i style={{ background: p.up, height: '70%' }} />
            <i style={{ background: p.down, height: '45%' }} />
            <i style={{ background: p.up, height: '90%' }} />
          </span>
          {p.name}
        </button>
      ))}
    </div>
  );
}
