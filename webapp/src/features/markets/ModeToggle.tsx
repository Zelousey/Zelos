/**
 * The Day Trading / Long Term switch (owner 2026-11-10). One shared choice (data/tradeMode):
 * switching it on Market changes the chart below, and the Full Chart opens in the same mode.
 * The selected mode is always spelled out (a filled, coloured segment with an icon), so no one
 * has to guess which mode is on. The first time someone switches, a short note explains the
 * difference.
 */
import { useState } from 'react';
import { useQuotes } from '../../data/markets';
import { markModeExplained, modeExplained, useMode, type Mode } from '../../data/tradeMode';
import { t } from '../../lib/i18n';
import { Button, Icon } from '../../ui';
import s from './ModeToggle.module.css';

/** The minutes between price updates for each mode, from the live price doc (falls back to 1 / 15). */
export function useModeMinutes(): { fast: number; slow: number } {
  const q = useQuotes();
  const d = q.status === 'ready' ? q.data : null;
  return { fast: d?.every ?? 1, slow: d?.everySlow ?? 15 };
}

export function modeExplanation(m: { fast: number; slow: number }): string {
  return t('mode.explain', { fast: m.fast, slow: m.slow });
}

/** onChange: when given, the caller decides what switching means (the Full Chart may have to change symbol). */
export function ModeToggle({ onChange, compact, className }: { onChange?: (m: Mode) => void; compact?: boolean; className?: string }) {
  const [mode, setMode] = useMode();
  const [note, setNote] = useState(false);
  const minutes = useModeMinutes();
  const pick = (m: Mode) => {
    if (m === mode) return;
    if (!modeExplained()) {
      markModeExplained();
      setNote(true);
    }
    if (onChange) onChange(m);
    else setMode(m);
  };
  const item = (m: Mode) => (
    <button
      key={m}
      type="button"
      role="radio"
      aria-checked={mode === m}
      className={[s.opt, m === 'fast' ? s.fast : s.slow].join(' ')}
      onClick={() => pick(m)}
      title={m === 'fast' ? t('mode.fast.hint', { n: minutes.fast }) : t('mode.slow.hint', { n: minutes.slow })}
    >
      <Icon name={m === 'fast' ? 'signal' : 'chart'} size={14} />
      <span>{t(m === 'fast' ? 'mode.fast' : 'mode.slow')}</span>
    </button>
  );
  return (
    <div className={[s.wrap, compact && s.compact, className].filter(Boolean).join(' ')}>
      <div role="radiogroup" aria-label={t('mode.label')} className={s.group} data-mode={mode}>
        {item('fast')}
        {item('slow')}
      </div>
      {note && (
        <div className={s.note} role="note">
          <p>{modeExplanation(minutes)}</p>
          <Button size="sm" variant="ghost" onClick={() => setNote(false)}>
            {t('mode.explain.ok')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A small label for places that show the mode without switching it. */
export function ModeBadge({ className }: { className?: string }) {
  const [mode] = useMode();
  return (
    <span className={[s.badge, mode === 'fast' ? s.fast : s.slow, className].filter(Boolean).join(' ')} data-mode={mode}>
      <Icon name={mode === 'fast' ? 'signal' : 'chart'} size={12} /> {t(mode === 'fast' ? 'mode.badge.fast' : 'mode.badge.slow')}
    </span>
  );
}
