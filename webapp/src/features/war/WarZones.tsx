/**
 * Open War zones (W6b1) on the War zone page: the zone you're in this season, or "Join a War zone".
 * The server (war_lobby zoneJoin, functions/warzone.py) picks the zone, Rookie or open by your
 * Battle Level rank, and sets your army; this card only explains the rules.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate, formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, LoadingState, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { useWar, warLobby, ZONE_SIZE } from './lobby';
import { battleRank, type WarProfile } from './war';
import s from './War.module.css';

export function WarZones({ uid, p }: { uid: string; p: WarProfile }) {
  const zone = useWar(p.zone);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(60000);
  const [busy, setBusy] = useState(false);
  const rank = battleRank(p.battlePoints);
  const mine = zone.status === 'ready' && zone.data && zone.data.status === 'active' && zone.data.players.includes(uid) ? zone.data : null;
  const rookieRank = rank.index <= 1;
  async function join(open?: boolean) {
    setBusy(true);
    try {
      const r = await warLobby(open === undefined ? { action: 'zoneJoin' } : { action: 'zoneJoin', open });
      toast.show(t('wzone.joined', { name: String(r.war.name ?? '') }), 'success');
      navigate(`/war/${r.warId}`);
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  if (p.zone && zone.status === 'loading') return <LoadingState rows={2} />;
  return (
    <Card title={t('wzone.title')} subtitle={t('wzone.sub')} flush>
      {mine ? (
        <ul className={s.rows} aria-label={t('wzone.title')}>
          <li>
            <Link className={s.row} to={`/war/${mine.id}`}>
              <span className={s.who}>
                <b>{mine.name}</b>
                <small>{t('wzone.row', { n: mine.players.length, max: ZONE_SIZE, when: formatRelative(mine.endsAt ?? now, now) })}</small>
              </span>
              <span />
              <Badge tone="accent">{mine.rookie ? t('wzone.rookie') : t('wzone.open')}</Badge>
            </Link>
          </li>
        </ul>
      ) : (
        <div className={`${s.ticket} ${s.zonePad}`}>
          <p>{rookieRank && p.zonePref !== 'open' ? t('wzone.joinRookie', { rank: rank.name }) : t('wzone.joinOpen', { rank: rank.name })}</p>
          <p className={s.muted}>{t('wzone.rules', { n: Math.min(150, 100 + 10 * rank.index) })}</p>
          <Button variant="primary" size="lg" block disabled={busy} onClick={() => void join(rookieRank ? p.zonePref === 'open' : undefined)}>
            {t('wzone.join')}
          </Button>
          {rookieRank && (
            <>
              <p className={s.muted}>{t('wzone.rookieChoice')}</p>
              <Button variant="ghost" disabled={busy} onClick={() => void join(p.zonePref !== 'open')}>
                {p.zonePref === 'open' ? t('wzone.joinRookieBtn') : t('wzone.joinOpenBtn')}
              </Button>
            </>
          )}
        </div>
      )}
      {p.seasons.length > 0 && (
        <ul className={s.rows} aria-label={t('wzone.seasons')}>
          {p.seasons.slice(0, 5).map((r) => (
            <li key={r.season + r.zone} className={s.player}>
              <span className={s.who}>
                <b>{r.zone}</b>
                <small>{t('wzone.seasonRow', { date: formatDate(r.season + 'T12:00:00') })}</small>
              </span>
              <span className={s.meta}>
                {r.forfeit ? <Badge tone="neutral">{t('wzone.forfeit')}</Badge> : r.rank <= 3 && r.of >= 2 && <Badge tone="gold">{t('wzone.top3')}</Badge>}
                <b>{t('wzone.finish', { rank: r.rank, of: r.of })}</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
