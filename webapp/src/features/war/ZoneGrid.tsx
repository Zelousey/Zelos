/**
 * "Your War Zones" (owner 2026-11-01): every War Zone you're in, as a card you open to see its map.
 * Your weekly open zone (or a card to join one), your private Wars with their own names, invites
 * waiting for an answer, and a card to start a private War. Each card shows the name, the kind,
 * players, phase and time left, and a strip of the map's territories coloured by holder.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatRelative } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Icon, LoadingState, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { SECTOR_NAME } from './map';
import { holdings, isOpen, sortZones, statusKey, useMyWars, useWarInvites, warLobby, type Holding, type PrivateWar, type WarConfig } from './lobby';
import { WarSettingsForm } from './WarSettingsForm';
import { JoinZone } from './WarZones';
import type { WarProfile } from './war';
import s from './War.module.css';

const HOLD_KEY: Record<Holding, MessageKey> = { mine: 'wmap.k.mine', enemy: 'wmap.k.enemy', neutral: 'wmap.k.neutral', contested: 'wmap.k.contested' };

export function ZoneGrid({ uid, p }: { uid: string; p: WarProfile | null }) {
  const mine = useMyWars(uid);
  const invites = useWarInvites(uid);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(30000);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const all = mine.status === 'ready' ? mine.data.filter((w) => w.status !== 'cancelled') : [];
  const running = sortZones(all.filter(isOpen));
  const finished = sortZones(all.filter((w) => w.status === 'ended')).slice(0, 3);
  const inZone = running.some((w) => w.kind === 'zone');
  const waiting = invites.status === 'ready' ? invites.data.filter((w) => w.status === 'lobby' && !w.players.includes(uid)) : [];
  async function create(cfg: WarConfig) {
    setBusy(true);
    try {
      const r = await warLobby({ action: 'create', ...cfg });
      setCreating(false);
      navigate(`/war/${r.warId}`);
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.zones} aria-labelledby="war-zones">
      <div className={s.zonesHead}>
        <h2 id="war-zones" className={s.zonesTitle}>
          {t('wz.title')}
        </h2>
        <p className={s.muted}>{t('wz.sub')}</p>
      </div>
      {mine.status === 'loading' ? (
        <LoadingState rows={3} />
      ) : (
        <ul className={s.zoneGrid} aria-label={t('wz.title')}>
          {running.map((w) => (
            <li key={w.id}>
              <ZoneCard w={w} uid={uid} now={now} />
            </li>
          ))}
          {waiting.map((w) => (
            <li key={w.id}>
              <Link className={s.zoneCard} to={`/war/${w.id}`}>
                <span className={s.zoneKind}>{t('wz.kind.private')}</span>
                <span className={s.zoneName}>{w.name}</span>
                <span className={s.muted}>{t('warl.invitedBy', { name: w.names[w.organizer] ?? 'A friend' })}</span>
                <span className={s.zoneFoot}>
                  <Badge tone="accent">{t('warl.invite')}</Badge>
                  <span className={s.zoneOpen}>
                    {t('wz.see')} <Icon name="chevronRight" size={16} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {!inZone && p && (
            <li>
              <div className={`${s.zoneCard} ${s.zoneAdd}`}>
                <span className={s.zoneKind}>{t('wz.kind.open')}</span>
                <span className={s.zoneName}>{t('wzone.join')}</span>
                <JoinZone p={p} />
              </div>
            </li>
          )}
          <li>
            <button type="button" className={`${s.zoneCard} ${s.zoneAdd} ${s.zoneNew}`} onClick={() => setCreating(true)}>
              <span className={s.zoneKind}>{t('wz.kind.private')}</span>
              <span className={s.zoneName}>{t('warl.new')}</span>
              <span className={s.muted}>{t('wz.newBody')}</span>
              <span className={s.zoneFoot}>
                <span />
                <span className={s.zoneOpen}>
                  {t('wz.create')} <Icon name="chevronRight" size={16} />
                </span>
              </span>
            </button>
          </li>
        </ul>
      )}
      {finished.length > 0 && (
        <details className={s.finished}>
          <summary>{t('wz.finished', { n: finished.length })}</summary>
          <ul className={s.rows}>
            {finished.map((w) => (
              <li key={w.id}>
                <Link className={s.row} to={`/war/${w.id}`}>
                  <span className={s.who}>
                    <b>{w.name}</b>
                    <small>{w.kind === 'zone' ? t('wz.kind.open') : t('wz.kind.private')}</small>
                  </span>
                  <span />
                  <Badge tone="neutral">{t(statusKey(w))}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Sheet open={creating} onClose={() => setCreating(false)} title={t('warl.new')} labelledBy="war-new">
        <div className={s.explain}>
          <p className={s.muted}>{t('warl.newHelp')}</p>
          <WarSettingsForm submit={t('warl.create')} busy={busy} onSubmit={(cfg) => void create(cfg)} />
        </div>
      </Sheet>
    </section>
  );
}

function ZoneCard({ w, uid, now }: { w: PrivateWar; uid: string; now: number }) {
  const zone = w.kind === 'zone';
  const kind = zone ? (w.rookie ? t('wz.kind.rookie') : t('wz.kind.open')) : t('wz.kind.private');
  const land = w.status === 'active' && w.phase === 'holding' ? holdings(w, uid) : [];
  const held = land.filter((x) => x.h === 'mine').length;
  const line =
    w.status === 'lobby'
      ? t('warl.players', { n: w.players.length, max: w.maxPlayers })
      : w.phase === 'claiming'
        ? `${t('wmap.st.claim')} · ${t('wmap.st.min', { n: Math.max(0, Math.round(((w.claimEnds ?? now) - now) / 60000)) })}`
        : t('wmap.st.held', { n: held, of: w.territories.length });
  return (
    <Link className={s.zoneCard} to={`/war/${w.id}`}>
      <span className={s.zoneKind}>{kind}</span>
      <span className={s.zoneName}>{w.name}</span>
      <span className={s.zoneLine}>{line}</span>
      {land.length > 0 && (
        <span className={s.strip} role="img" aria-label={land.map((x) => `${SECTOR_NAME[x.t] ?? x.t}: ${t(HOLD_KEY[x.h])}`).join(', ')}>
          {land.map((x) => (
            <i key={x.t} className={s[`h_${x.h}`]} />
          ))}
        </span>
      )}
      <span className={s.zoneStats}>
        <span>{t('warl.players', { n: w.players.length, max: zone ? w.maxPlayers || 10 : w.maxPlayers })}</span>
        {w.status === 'active' && w.endsAt != null && <span>{t(zone ? 'wz.seasonEnds' : 'wz.ends', { when: formatRelative(w.endsAt, now) })}</span>}
      </span>
      <span className={s.zoneFoot}>
        <Badge tone={w.status === 'active' ? 'accent' : 'neutral'}>{t(statusKey(w))}</Badge>
        <span className={s.zoneOpen}>
          {t('wz.openMap')} <Icon name="chevronRight" size={16} />
        </span>
      </span>
    </Link>
  );
}
