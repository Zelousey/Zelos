/** The card itself, as the feed and the share sheet show it (cardImage.ts draws the same as a picture). */
import { formatDate, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { BattleCard, PostSource, SoloCard } from './posts';
import s from './Posts.module.css';

const pct = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2) + '%';
const money = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ShareCard({ source, card }: { source: PostSource; card: SoloCard | BattleCard }) {
  if (source === 'solo') {
    const c = card as SoloCard;
    const up = c.pnl >= 0;
    return (
      <div className={[s.card, up ? s.cardUp : s.cardDown].join(' ')}>
        <span className={s.cardKind}>{t('post.kind.solo')}</span>
        <div className={s.cardMain}>
          <b className={s.cardSym}>{c.sym}</b>
          {c.option && <span className={s.cardSub}>{c.option}</span>}
        </div>
        <div className={s.cardResult}>
          <b className={up ? 'up' : 'down'}>{pct(c.pct)}</b>
          <span className={up ? 'up' : 'down'}>{money(c.pnl)}</span>
        </div>
        <span className={s.cardMeta}>
          {t(c.option ? 'post.contracts' : 'post.shares', { n: c.qty })} · {t('post.inOut', { a: formatPrice(c.entry), b: formatPrice(c.exit) })}
          {c.openDay && c.closeDay ? ` · ${formatDate(c.openDay + 'T12:00:00Z')} → ${formatDate(c.closeDay + 'T12:00:00Z')}` : ''}
        </span>
      </div>
    );
  }
  const b = card as BattleCard;
  const up = b.pnlPct >= 0;
  return (
    <div className={[s.card, s.cardBattle, up ? s.cardUp : s.cardDown].join(' ')}>
      <span className={s.cardKind}>{t('post.kind.battle')}</span>
      <div className={s.cardMain}>
        <b className={s.cardSym}>{b.rank === 1 ? t('post.won') : t('post.place', { n: b.rank })}</b>
        <span className={s.cardSub}>{t('post.battleLine', { name: b.name, n: b.of })}</span>
      </div>
      <div className={s.cardResult}>
        <b className={up ? 'up' : 'down'}>{pct(b.pnlPct)}</b>
        <span className={s.cardSub}>{t('post.trades', { n: b.trades })}</span>
      </div>
    </div>
  );
}
