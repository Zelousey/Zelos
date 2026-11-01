/**
 * Open War zones (W6b1): "Join a War zone" and "Your seasons". The server (war_lobby zoneJoin,
 * functions/warzone.py) picks the zone, Rookie or open by your Battle Level rank, and sets your
 * army; this card only explains the rules. The zone you're in shows as a card in ZoneGrid.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, Card, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { warLobby } from './lobby';
import { battleRank, type WarProfile } from './war';
import s from './War.module.css';

/** The join buttons and rules, inside a War Zone card. */
export function JoinZone({ p }: { p: WarProfile }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const rank = battleRank(p.battlePoints);
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
  return (
    <div className={s.ticket}>
      <p>{rookieRank && p.zonePref !== 'open' ? t('wzone.joinRookie', { rank: rank.name }) : t('wzone.joinOpen', { rank: rank.name })}</p>
      <p className={s.muted}>{t('wzone.rules', { n: Math.min(150, 100 + 10 * rank.index) })}</p>
      <Button variant="primary" block disabled={busy} onClick={() => void join(rookieRank ? p.zonePref === 'open' : undefined)}>
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
  );
}

/** Your last open-zone seasons and where you finished. */
export function Seasons({ p }: { p: WarProfile }) {
  if (!p.seasons.length) return null;
  return (
    <Card title={t('wzone.seasons')} flush>
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
    </Card>
  );
}
