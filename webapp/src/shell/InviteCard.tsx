/**
 * Invitation cards in the bell (Phase 8, N-R2): coaching, battle, team-up and friend invites
 * Trade War challenges and private War invites each show who sent it, what it is, and that flow's
 * own actions. They stay separate flows: invite links (invites/{code}, invite_accept), challenges
 * (twInvites/{id}, tw_respond) and Wars (wars/{id}, war_lobby). The server decides everything;
 * this only shows and calls.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import type { DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../data/liveDoc';
import { parseBattle } from '../features/battles/battle';
import { modeLines } from '../features/battles/parts';
import { useSlotGate } from '../features/battles/slots';
import { acceptInvite, errorText, respondChallenge, useInvite, type InviteKind } from '../features/invites/invites';
import { useWar, warLobby } from '../features/war/lobby';
import { useAuth } from '../lib/auth';
import { formatMoney } from '../lib/format';
import { t, type MessageKey } from '../lib/i18n';
import { useNow } from '../lib/useNow';
import { Badge, Button, Icon, type IconName } from '../ui';
import type { InboxAction } from './useInbox';
import s from './Shell.module.css';

type Kind = InviteKind | 'challenge' | 'war';
const KIND: Record<Kind, { icon: IconName; label: MessageKey; accept: MessageKey }> = {
  battle: { icon: 'war', label: 'card.kind.battle', accept: 'card.accept.battle' },
  challenge: { icon: 'war', label: 'card.kind.challenge', accept: 'bell.accept' },
  war: { icon: 'war', label: 'card.kind.war', accept: 'warl.join' },
  squad: { icon: 'social', label: 'card.kind.squad', accept: 'card.accept.squad' },
  coach: { icon: 'missions', label: 'card.kind.coach', accept: 'card.accept.coach' },
  join: { icon: 'invite', label: 'card.kind.join', accept: 'bell.accept' },
};

const days = (n: number | null) => (n === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: n ?? 0 }));
const battleLine = (name: string | null, buyIn: number | null, d: number | null) => t('land.battleDetail', { war: name ?? 'Trade War', buyIn: formatMoney(buyIn ?? 0, { digits: 0 }), days: days(d) });

type View = { kind: Kind; who: string; username: string | null; what: string | null; modes: string[]; closed: MessageKey | null };

function Card({ view, children }: { view: View; children?: React.ReactNode }) {
  const k = KIND[view.kind];
  return (
    <div className={s.inviteCard}>
      <span className={s.inviteKind}>
        <Icon name={k.icon} size={14} />
        <Badge tone="accent">{t(k.label)}</Badge>
      </span>
      <p className={s.inviteWho}>
        {t('card.from', { name: view.who })}
        {view.username && <span className={s.inviteUser}> @{view.username}</span>}
      </p>
      {view.what && <p className={s.inviteWhat}>{view.what}</p>}
      {view.modes.length > 0 && (
        <ul className={s.notifModes} aria-label={t('bell.modes')}>
          {view.modes.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {view.closed ? (
        <p className={s.notifDone} role="status">
          {t(view.closed)}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

export function InviteCard({ action, onClose }: { action: InboxAction; onClose: () => void }) {
  if (action.type === 'war') return <WarInvite id={action.id} onClose={onClose} />;
  return action.type === 'invite' ? <LinkInvite code={action.code} onClose={onClose} /> : <Challenge id={action.id} />;
}

/** An invite link someone sent you by @username (invite_send): accept it here, or open its page. */
function LinkInvite({ code, onClose }: { code: string; onClose: () => void }) {
  const inv = useInvite(code);
  const now = useNow(60_000);
  const [state, setState] = useState<'idle' | 'busy' | 'accepted'>('idle');
  const [error, setError] = useState<string | null>(null);
  const slot = useSlotGate();
  if (inv.status === 'loading') return null;
  if (inv.status !== 'ready') return <p className={s.notifDone}>{t('land.missing')}</p>;
  const i = inv.data;
  const view: View = {
    kind: i.kind,
    who: i.fromName,
    username: i.fromUsername,
    what: i.kind === 'battle' ? battleLine(i.warName, i.buyIn, i.days) : i.kind === 'squad' ? i.squadName : i.kind === 'coach' ? t('land.coachSees') : t('card.join.what'),
    modes: [],
    closed: state === 'accepted' ? null : i.status !== 'open' ? 'land.cancelled' : now >= i.expiresAt ? 'land.expired' : null,
  };
  async function accept() {
    setState('busy');
    setError(null);
    try {
      setState((await slot.gate((x) => acceptInvite(code, x))) ? 'accepted' : 'idle');
    } catch (e) {
      setState('idle');
      setError(errorText(e, t('land.failed')));
    }
  }
  return (
    <Card view={view}>
      {slot.dialog}
      {state === 'accepted' ? (
        <p className={s.notifDone} role="status">
          {t('bell.accepted')}
          {' · '}
          <Link to={`/i/${code}`} onClick={onClose}>
            {t('bell.open')} →
          </Link>
        </p>
      ) : (
        <div className={s.notifActions}>
          <Button size="sm" variant="primary" disabled={state === 'busy'} onClick={() => void accept()}>
            {t(KIND[i.kind].accept)}
          </Button>
          <Link className={s.inviteMore} to={`/i/${code}`} onClick={onClose}>
            {t('card.details')}
          </Link>
          {error && (
            <p className={s.inviteError} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

type TwInvite = { fromName: string; fromUsername: string | null; warName: string | null; buyIn: number | null; days: number | null; status: string; modes: string[] };
// a challenge stores its modes like a battle (lms, modes) and squad battles' allowed stocks as `symbols`
const parseChallenge = (d: DocumentData): TwInvite => ({
  fromName: typeof d.fromName === 'string' && d.fromName ? d.fromName.slice(0, 24) : 'A trader',
  fromUsername: typeof d.fromUsername === 'string' && /^[a-z0-9_]{3,20}$/.test(d.fromUsername) ? d.fromUsername : null,
  warName: typeof d.warName === 'string' ? d.warName.slice(0, 40) : null,
  buyIn: typeof d.buyIn === 'number' ? d.buyIn : null,
  days: typeof d.days === 'number' ? d.days : null,
  status: typeof d.status === 'string' ? d.status : 'pending',
  modes: modeLines(parseBattle('', { ...d, rules: { symbols: d.symbols } })),
});
const CLOSED: Record<string, MessageKey> = { accepted: 'bell.accepted', declined: 'bell.declined', expired: 'land.expired', cancelled: 'land.cancelled' };

/** A Trade War challenge (tw_challenge, also rematches): Accept or Decline. */
function Challenge({ id }: { id: string }) {
  const inv = useLiveDoc(`twInvites/${id}`, parseChallenge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slot = useSlotGate();
  if (inv.status === 'loading') return null;
  if (inv.status !== 'ready') return <p className={s.notifDone}>{t('land.missing')}</p>;
  const c = inv.data;
  const view: View = { kind: 'challenge', who: c.fromName, username: c.fromUsername, what: battleLine(c.warName, c.buyIn, c.days), modes: c.modes, closed: c.status === 'pending' ? null : (CLOSED[c.status] ?? 'land.expired') };
  async function run(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      await slot.gate((x) => respondChallenge(id, accept, x)); // the card follows twInvites/{id}.status
    } catch (e) {
      setError(errorText(e, t('land.failed')));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card view={view}>
      {slot.dialog}
      <div className={s.notifActions}>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(true)}>
          {t('bell.accept')}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(false)}>
          {t('bell.decline')}
        </Button>
        {error && (
          <p className={s.inviteError} role="alert">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

/** A private War invite (war_lobby): Join or Decline here; the War's page has the rest. */
function WarInvite({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const w = useWar(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (w.status === 'loading') return null;
  if (w.status !== 'ready' || !w.data) return <p className={s.notifDone}>{t('land.missing')}</p>;
  const war = w.data;
  const uid = user?.uid ?? '';
  const joined = war.players.includes(uid);
  const view: View = {
    kind: 'war',
    who: war.names[war.organizer] ?? 'A friend',
    username: null,
    what: t('card.war.what', { name: war.name, days: days(war.days) }),
    modes: [],
    closed: joined ? 'bell.accepted' : war.status !== 'lobby' ? 'land.expired' : !war.invited.includes(uid) ? 'bell.declined' : null,
  };
  async function run(join: boolean) {
    setBusy(true);
    setError(null);
    try {
      await warLobby({ action: join ? 'join' : 'decline', warId: id }); // the card follows wars/{id}
    } catch (e) {
      setError(errorText(e, t('land.failed')));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card view={view}>
      <div className={s.notifActions}>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(true)}>
          {t('warl.join')}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(false)}>
          {t('bell.decline')}
        </Button>
        <Link className={s.inviteMore} to={`/war/${id}`} onClick={onClose}>
          {t('card.details')}
        </Link>
        {error && (
          <p className={s.inviteError} role="alert">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
