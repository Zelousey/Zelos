/**
 * The track record as bull vs bear (owner 2026-11-13). The green (wins) side grows from the left
 * with the bull riding its front edge, the red (losses) side grows from the right with the bear
 * on its front edge. They meet exactly where the real win rate puts the line, bump heads once,
 * and the side that's ahead keeps its animal; the other one fades. A tie keeps both.
 *
 * Plays once when it appears (and again when the numbers change, e.g. a filter). With reduced
 * motion it shows the final picture straight away. The bar's widths are the real counts.
 */
import type { CSSProperties } from 'react';
import { t } from '../../lib/i18n';
import s from './RecordDuel.module.css';

const ART = `${import.meta.env.BASE_URL}art/`;

export function RecordDuel({ wins, losses }: { wins: number; losses: number }) {
  const p = (wins / (wins + losses)) * 100;
  const lead = wins > losses ? 'bull' : losses > wins ? 'bear' : 'tie';
  return (
    <div
      key={`${wins}-${losses}`}
      className={s.duel}
      data-lead={lead}
      style={{ '--p': `${p}%` } as CSSProperties}
      role="img"
      aria-label={`${t('al.record.bar', { wins, losses })}. ${t(lead === 'bull' ? 'al.record.bullLeads' : lead === 'bear' ? 'al.record.bearLeads' : 'al.record.even')}`}
    >
      <div className={s.track}>
        <i className={s.win} />
        <i className={s.loss} />
      </div>
      <img className={`${s.icon} ${s.bull}`} src={`${ART}bull.webp`} alt="" width={313} height={320} decoding="async" />
      <img className={`${s.icon} ${s.bear}`} src={`${ART}bear.webp`} alt="" width={343} height={320} decoding="async" />
    </div>
  );
}
