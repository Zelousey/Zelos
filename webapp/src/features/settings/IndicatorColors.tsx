/**
 * Indicator colours (owner 2026-11-11): pick the colour of volume, the Bollinger Bands, RSI and the
 * MACD line and signal. Saved on this device by the shared chart engine and applied to every open
 * chart at once. "Default" keeps the built-in colour (volume's default follows the candles). Each is one line that
 * opens its colours (owner 2026-11-12).
 */
import { useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { engine, setIndColors, type IndColors } from '../charts/engine';
import { PickRow } from './PickRow';
import s from './SettingsPage.module.css';

const PALETTE: [string, MessageKey][] = [
  ['#4a86ff', 'settings.ind.blue'],
  ['#8f7bf6', 'settings.ind.violet'],
  ['#e8b23d', 'settings.ind.gold'],
  ['#22d3ee', 'settings.ind.cyan'],
  ['#f472b6', 'settings.ind.pink'],
  ['#3ecb7c', 'settings.ind.green'],
  ['#f97316', 'settings.ind.orange'],
  ['#e8eaef', 'settings.ind.white'],
];

const ROWS: [keyof IndColors, MessageKey][] = [
  ['vol', 'settings.ind.vol'],
  ['bb', 'settings.ind.bb'],
  ['rsi', 'settings.ind.rsi'],
  ['macd', 'settings.ind.macd'],
  ['macdSignal', 'settings.ind.macdSignal'],
];

export function IndicatorColors({ open, onOpen }: { open: string | null; onOpen: (k: string | null) => void }) {
  const [cur, setCur] = useState<IndColors>(() => engine().loadIndColors());
  const pick = (k: keyof IndColors, v: string | null) => {
    const next = { ...cur };
    if (v) next[k] = v;
    else delete next[k];
    setCur(next);
    setIndColors(next);
  };
  return (
    <>
      {ROWS.map(([k, label]) => {
        const hex = cur[k];
        const named = PALETTE.find(([h]) => h === hex)?.[1];
        const value = hex ? (named ? t(named) : hex) : k === 'vol' ? t('settings.ind.candles') : t('settings.ind.default');
        return (
          <PickRow key={k} label={t(label)} value={value} preview={<i className={s.dotPreview} style={{ background: hex ?? 'transparent' }} data-empty={!hex || undefined} />} open={open === k} onToggle={() => onOpen(open === k ? null : k)}>
            <div className={s.dots} role="radiogroup" aria-label={t(label)}>
              <button
                type="button"
                role="radio"
                aria-checked={!hex}
                aria-label={k === 'vol' ? t('settings.ind.matchCandles') : undefined}
                title={k === 'vol' ? t('settings.ind.matchCandles') : undefined}
                className={s.dotDefault}
                onClick={() => pick(k, null)}
              >
                {k === 'vol' ? t('settings.ind.candles') : t('settings.ind.default')}
              </button>
              {PALETTE.map(([h, name]) => (
                <button key={h} type="button" role="radio" aria-checked={hex === h} aria-label={t(name)} title={t(name)} className={s.dot} style={{ background: h }} onClick={() => pick(k, h)} />
              ))}
            </div>
          </PickRow>
        );
      })}
    </>
  );
}
