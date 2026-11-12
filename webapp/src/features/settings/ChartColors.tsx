/**
 * Candle colours (owner 2026-10-27: "green and red unless someone changes in the settings"). The
 * free presets from the shared chart engine (practice-chart.js, the same list as the classic site);
 * saved on this device and applied to every open chart at once. A chart theme bought with tokens
 * draws its own colours on top. Shown as one line that opens the presets (owner 2026-11-12).
 */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { engine, setCandleColors } from '../charts/engine';
import { PickRow } from './PickRow';
import s from './SettingsPage.module.css';

const Mini = ({ up, down }: { up: string; down: string }) => (
  <span className={s.candles} aria-hidden>
    <i style={{ background: up, height: '70%' }} />
    <i style={{ background: down, height: '45%' }} />
    <i style={{ background: up, height: '90%' }} />
  </span>
);

export function ChartColors({ open, onOpen }: { open: string | null; onOpen: (k: string | null) => void }) {
  const presets = engine().PRESETS;
  const [current, setCurrent] = useState(() => engine().loadColors().id);
  const cur = presets.find((p) => p.id === current) ?? presets[0]!;
  return (
    <PickRow label={t('settings.candles')} value={cur.name} preview={<Mini up={cur.up} down={cur.down} />} open={open === 'candles'} onToggle={() => onOpen(open === 'candles' ? null : 'candles')}>
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
            <Mini up={p.up} down={p.down} />
            {p.name}
          </button>
        ))}
      </div>
    </PickRow>
  );
}
