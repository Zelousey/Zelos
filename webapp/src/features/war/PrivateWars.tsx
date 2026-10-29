/**
 * Your private Wars with friends (W3) on the War zone page: the ones you're in, invites waiting
 * for an answer, and "Start a private War" (a draft you set up, then open for friends).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatRelative } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, EmptyState, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { WarSettingsForm } from './WarSettingsForm';
import { isOpen, useMyWars, useWarInvites, warLobby, type PrivateWar, type WarConfig } from './lobby';
import s from './War.module.css';

export const STATUS: Record<string, MessageKey> = {
  configuring: 'warl.st.configuring',
  recruiting: 'warl.st.recruiting',
  ready: 'warl.st.ready',
  active: 'warl.st.active',
  ended: 'warl.st.ended',
  cancelled: 'warl.st.cancelled',
};
export const statusKey = (w: PrivateWar): MessageKey => STATUS[w.status === 'lobby' ? (w.stage ?? 'recruiting') : w.status]!;

export function PrivateWars({ uid }: { uid: string }) {
  const mine = useMyWars(uid);
  const invites = useWarInvites(uid);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(60000);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const wars = mine.status === 'ready' ? [...mine.data].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (b.startedAt ?? b.deadline ?? 0) - (a.startedAt ?? a.deadline ?? 0)).slice(0, 8) : [];
  const waiting = invites.status === 'ready' ? invites.data.filter((w) => w.status === 'lobby') : [];
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
    <Card
      title={t('warl.title')}
      subtitle={t('warl.sub')}
      flush
      actions={
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          {t('warl.new')}
        </Button>
      }
    >
      {waiting.length > 0 && (
        <ul className={s.rows} aria-label={t('warl.invites')}>
          {waiting.map((w) => (
            <li key={w.id}>
              <Link className={s.row} to={`/war/${w.id}`}>
                <span className={s.who}>
                  <b>{w.name}</b>
                  <small>{t('warl.invitedBy', { name: w.names[w.organizer] ?? 'A friend' })}</small>
                </span>
                <span />
                <Badge tone="accent">{t('warl.invite')}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mine.status === 'ready' && wars.length === 0 && waiting.length === 0 ? (
        <EmptyState icon="war" body={t('warl.none')} compact />
      ) : (
        <ul className={s.rows} aria-label={t('warl.title')}>
          {wars.map((w) => (
            <li key={w.id}>
              <Link className={s.row} to={`/war/${w.id}`}>
                <span className={s.who}>
                  <b>{w.name}</b>
                  <small>
                    {t('warl.players', { n: w.players.length, max: w.maxPlayers })}
                    {w.status === 'active' && w.endsAt ? ` · ${t('warl.ends', { when: formatRelative(w.endsAt, now) })}` : ''}
                  </small>
                </span>
                <span />
                <Badge tone={isOpen(w) ? 'accent' : 'neutral'}>{t(statusKey(w))}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={creating} onClose={() => setCreating(false)} title={t('warl.new')} labelledBy="war-new">
        <div className={s.explain}>
          <p className={s.muted}>{t('warl.newHelp')}</p>
          <WarSettingsForm submit={t('warl.create')} busy={busy} onSubmit={(cfg) => void create(cfg)} />
        </div>
      </Sheet>
    </Card>
  );
}
