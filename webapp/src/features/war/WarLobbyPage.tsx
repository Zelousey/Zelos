/**
 * One private War (/war/:id, W3): its lobby while it's being set up and filled (settings, players
 * and who's ready, invites by @username, start once), then the War itself. Every action goes
 * through war_lobby; the server checks who may do what and handles the lobby deadline.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, Confirm, Field, LoadingState, PageHeader, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import NotFoundPage from '../notfound/NotFoundPage';
import { WarGate } from './Gate';
import { armyOf, shieldedUntil, statusKey, useWar, warLobby, WAR_ID_RE, ZONE_SIZE, type PrivateWar, type WarConfig } from './lobby';
import { WarMap } from './WarMap';
import { WarSettingsForm } from './WarSettingsForm';
import s from './War.module.css';

export default function WarLobbyPage() {
  const raw = useParams().id ?? '';
  const id = WAR_ID_RE.test(raw) ? raw : null;
  if (!id) return <NotFoundPage />;
  return <WarGate>{(uid) => <Lobby id={id} uid={uid} />}</WarGate>;
}

function Lobby({ id, uid }: { id: string; uid: string }) {
  const w = useWar(id);
  if (w.status === 'loading') return <LoadingState rows={6} />;
  if (w.status !== 'ready' || !w.data) return <NotFoundPage />;
  return <WarView w={w.data} uid={uid} />;
}

function WarView({ w, uid }: { w: PrivateWar; uid: string }) {
  const toast = useToast();
  const now = useNow(30000);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<'cancel' | 'leave' | 'zoneLeave' | 'moveUp' | null>(null);
  const zone = w.kind === 'zone';
  const org = w.organizer === uid;
  const inIt = w.players.includes(uid);
  const invited = !inIt && w.invited.includes(uid);
  const lobby = w.status === 'lobby';
  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await fn();
      if (done) toast.show(done, 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  const cfg: WarConfig = { name: w.name, days: w.days, lobbyHours: w.lobbyHours, maxPlayers: w.maxPlayers };
  return (
    <>
      <Link to="/war" className={s.back}>
        ← {t('warl.back')}
      </Link>
      <PageHeader
        title={w.name}
        keepOnPhone
        subtitle={
          <span className={s.meta}>
            <span className={s.simBadge}>{t('war.sim')}</span>
            <Badge tone={lobby || w.status === 'active' ? 'accent' : 'neutral'}>{t(statusKey(w))}</Badge>
            {zone && <Badge tone="neutral">{w.rookie ? t('wzone.rookie') : t('wzone.open')}</Badge>}
          </span>
        }
      />
      {(w.status === 'active' || w.status === 'ended') && inIt && w.territories.length > 0 && (
        <div className={s.mapArea}>
          <WarMap w={w} uid={uid} now={now} />
        </div>
      )}
      <div className={s.cols}>
        <div className={s.stack}>
          <Card title={zone ? t('wzone.about') : t('warl.about')} pad>
            <div className={s.ticket}>
              <TimeLine w={w} now={now} />
              {org && w.stage === 'configuring' ? (
                <>
                  <WarSettingsForm initial={cfg} submit={t('warl.save')} busy={busy} onSubmit={(c) => void act(() => warLobby({ action: 'config', warId: w.id, ...c }), t('warl.saved'))} />
                  <p className={s.muted}>{t('warl.openHelp', { n: w.lobbyHours })}</p>
                  <Button variant="primary" size="lg" block disabled={busy} onClick={() => void act(() => warLobby({ action: 'open', warId: w.id }), t('warl.opened'))}>
                    {t('warl.open')}
                  </Button>
                </>
              ) : zone ? (
                <dl className={s.facts}>
                  <dt>{t('wzone.ends')}</dt>
                  <dd>{formatRelative(w.endsAt ?? now, now)}</dd>
                  <dt>{t('warl.maxPlayers')}</dt>
                  <dd>{ZONE_SIZE}</dd>
                  <dt>{t('warl.map')}</dt>
                  <dd>{t('warl.territories', { n: w.territories.length })}</dd>
                  {inIt && (
                    <>
                      <dt>{t('wzone.yourArmy')}</dt>
                      <dd>{t('wzone.armyValue', { n: armyOf(w, uid) })}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <dl className={s.facts}>
                  <dt>{t('warl.days')}</dt>
                  <dd>{w.days === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: w.days })}</dd>
                  <dt>{t('warl.maxPlayers')}</dt>
                  <dd>{w.maxPlayers}</dd>
                  <dt>{t('warl.map')}</dt>
                  <dd>{t('warl.territories', { n: w.mapSize ?? (w.players.length <= 3 ? 6 : w.players.length <= 6 ? 8 : 10) })}</dd>
                  <dt>{t('warl.armyLabel')}</dt>
                  <dd>{t('warl.armyValue', { n: w.soldiers })}</dd>
                </dl>
              )}
              {zone && inIt && shieldedUntil(w, uid, now) && <p className={s.muted}>{t('wzone.shieldYou', { when: formatRelative(shieldedUntil(w, uid, now)!, now) })}</p>}
              {zone && inIt && w.status === 'active' && w.rookie && (
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm('moveUp')}>
                  {t('wzone.moveUp')}
                </Button>
              )}
              {zone && inIt && w.status === 'active' && (
                <Button variant="ghost" disabled={busy} onClick={() => setConfirm('zoneLeave')}>
                  {t('wzone.leave')}
                </Button>
              )}
            </div>
          </Card>
          {invited && lobby && (
            <Card title={t('warl.invitedTitle', { name: w.names[w.organizer] ?? 'A friend' })} pad>
              <div className={s.actionsRow}>
                <Button variant="primary" disabled={busy} onClick={() => void act(() => warLobby({ action: 'join', warId: w.id }), t('warl.joined'))}>
                  {t('warl.join')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => void act(() => warLobby({ action: 'decline', warId: w.id }), t('warl.declined'))}>
                  {t('warl.decline')}
                </Button>
              </div>
            </Card>
          )}
        </div>
        <div className={s.stack}>
          <Card title={t('warl.playersTitle', { n: w.players.length, max: zone ? ZONE_SIZE : w.maxPlayers })} flush>
            <ul className={s.rows}>
              {w.players.map((p) => (
                <li key={p} className={s.player}>
                  <span className={s.who}>
                    <b>
                      {w.names[p] ?? 'Trader'}
                      {p === uid && ` ${t('warl.you')}`}
                    </b>
                    <small>{zone ? (w.joinedAt[p] && w.startedAt && w.joinedAt[p]! > w.startedAt + 3600e3 ? t('wzone.dropIn') : t('warl.player')) : p === w.organizer ? t('warl.organizer') : t('warl.player')}</small>
                  </span>
                  {zone && shieldedUntil(w, p, now) && <Badge tone="gold">{t('wzone.shielded')}</Badge>}
                  {lobby && w.stage !== 'configuring' && <Badge tone={w.ready[p] ? 'up' : 'neutral'}>{w.ready[p] ? t('warl.isReady') : t('warl.notReady')}</Badge>}
                </li>
              ))}
            </ul>
            {lobby && w.invited.length > 0 && <p className={s.note}>{t('warl.waitingInvites', { n: w.invited.length })}</p>}
          </Card>
          {lobby && inIt && w.stage !== 'configuring' && (
            <Card pad>
              <div className={s.ticket}>
                {org ? (
                  <>
                    <InviteForm warId={w.id} full={w.players.length >= w.maxPlayers} />
                    <p className={s.muted}>{w.stage === 'ready' ? t('warl.canStart') : t('warl.needReady')}</p>
                    <Button variant="primary" size="lg" block disabled={busy || w.stage !== 'ready'} onClick={() => void act(() => warLobby({ action: 'start', warId: w.id }))}>
                      {t('warl.start')}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant={w.ready[uid] ? 'ghost' : 'primary'}
                    size="lg"
                    block
                    disabled={busy}
                    aria-pressed={!!w.ready[uid]}
                    onClick={() => void act(() => warLobby({ action: 'ready', warId: w.id, ready: !w.ready[uid] }))}
                  >
                    {w.ready[uid] ? t('warl.unready') : t('warl.readyGo')}
                  </Button>
                )}
                <Button variant="ghost" disabled={busy} onClick={() => setConfirm(org ? 'cancel' : 'leave')}>
                  {org ? t('warl.cancel') : t('warl.leave')}
                </Button>
              </div>
            </Card>
          )}
          {lobby && org && w.stage === 'configuring' && (
            <Button variant="ghost" disabled={busy} onClick={() => setConfirm('cancel')}>
              {t('warl.cancel')}
            </Button>
          )}
        </div>
      </div>
      <Confirm
        open={confirm != null}
        title={confirm === 'cancel' ? t('warl.cancelQ') : confirm === 'zoneLeave' ? t('wzone.leaveQ') : confirm === 'moveUp' ? t('wzone.moveUpQ') : t('warl.leaveQ')}
        action={confirm === 'cancel' ? t('warl.cancel') : confirm === 'zoneLeave' ? t('wzone.leave') : confirm === 'moveUp' ? t('wzone.moveUp') : t('warl.leave')}
        variant="danger"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm === 'moveUp'
            ? void act(async () => {
                await warLobby({ action: 'zoneLeave', warId: w.id });
                const r = await warLobby({ action: 'zoneJoin', open: true });
                toast.show(t('wzone.moved', { name: String(r.war.name ?? '') }), 'success');
                navigate(`/war/${r.warId}`);
              })
            : confirm === 'zoneLeave'
            ? void act(async () => {
                await warLobby({ action: 'zoneLeave', warId: w.id });
                navigate('/war');
              }, t('wzone.left'))
            : void act(() => warLobby({ action: confirm === 'cancel' ? 'cancel' : 'leave', warId: w.id }))
        }
      >
        <p>{confirm === 'cancel' ? t('warl.cancelBody') : confirm === 'zoneLeave' ? t('wzone.leaveBody') : confirm === 'moveUp' ? t('wzone.moveUpBody') : t('warl.leaveBody')}</p>
      </Confirm>
    </>
  );
}

function TimeLine({ w, now }: { w: PrivateWar; now: number }) {
  let line: string;
  if (w.status === 'lobby' && w.stage === 'configuring') line = t('warl.tl.draft');
  else if (w.status === 'lobby') line = t('warl.tl.lobby', { when: w.deadline ? formatRelative(w.deadline, now) : '' });
  else if (w.status === 'active' && w.kind === 'zone') line = t('wzone.tl', { ends: formatRelative(w.endsAt ?? now, now) });
  else if (w.status === 'active') line = t('warl.tl.active', { started: formatRelative(Math.min(w.startedAt ?? now, now), now), ends: formatRelative(w.endsAt ?? now, now) });
  else if (w.status === 'ended') line = t('warl.tl.ended');
  else line = w.why === 'not-enough-players' ? t('warl.tl.cancelledDeadline') : w.why === 'never-opened' ? t('warl.tl.cancelledDraft') : t('warl.tl.cancelled');
  return (
    <p className={s.timeline} role="status">
      {line}
    </p>
  );
}

function InviteForm({ warId, full }: { warId: string; full: boolean }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const u = name.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) return setError(t('warl.inviteBad'));
    setBusy(true);
    setError(null);
    try {
      await warLobby({ action: 'invite', warId, username: u });
      toast.show(t('warl.inviteSent', { name: '@' + u }), 'success');
      setName('');
    } catch (err) {
      setError(errorText(err, t('warl.failed')));
    } finally {
      setBusy(false);
    }
  }
  if (full) return <p className={s.muted}>{t('warl.full')}</p>;
  return (
    <form className={s.inviteForm} onSubmit={send}>
      <Field label={t('warl.inviteLabel')} prefix="@" value={name} maxLength={21} autoCapitalize="none" autoCorrect="off" onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
      <Button type="submit" variant="secondary" disabled={busy}>
        {t('warl.inviteGo')}
      </Button>
    </form>
  );
}
