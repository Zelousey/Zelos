/**
 * Invite friends (/invite): pick Battle, Team up or Invite a friend, then share the link or
 * send it to a Zelos user by @username. Each choice is a picture card with a mascot scene
 * (owner 2026-10-09). The server makes the invite; nothing here decides who gets what.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { COACH_MIN_XP } from '../coach/coach';
import { formatMoney } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, EmptyState, Field, Icon, LoadingState, PageHeader, useToast, type IconName } from '../../ui';
import { BUY_INS, copyText, createBattle, createInvite, DAYS, errorText, sendInvite, shareLink, useMySquads, type Created, type InviteKind } from './invites';
import { Choices } from './Choices';
import { InviteScene } from './InviteScene';
import s from './Invites.module.css';

type Step = { at: 'pick' } | { at: 'battle' } | { at: 'squad' } | { at: 'ready'; kind: InviteKind; created: Created; warId?: string };

const KINDS: { kind: InviteKind; icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { kind: 'battle', icon: 'war', title: 'inv.battle', body: 'inv.battle.body' },
  { kind: 'squad', icon: 'social', title: 'inv.squad', body: 'inv.squad.body' },
  { kind: 'join', icon: 'invite', title: 'inv.join', body: 'inv.join.body' },
  { kind: 'coach', icon: 'missions', title: 'inv.coach', body: 'inv.coach.body2' },
];

export default function InvitePage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const start = params.get('kind');
  const [step, setStep] = useState<Step>(() => (start === 'battle' || start === 'squad' ? { at: start } : { at: 'pick' }));
  const [busy, setBusy] = useState(false);
  const me = useUserDoc(isReal && user ? user.uid : null);
  const canCoach = me.status === 'ready' && me.data.xp >= COACH_MIN_XP;
  // /invite?kind=coach (from Coaching) goes straight to the coach link, once
  const autoCoach = useRef(start === 'coach');
  useEffect(() => {
    if (autoCoach.current && canCoach) {
      autoCoach.current = false;
      void makeLink('coach');
    }
  });

  async function makeLink(kind: 'join' | 'coach') {
    setBusy(true);
    try {
      setStep({ at: 'ready', kind, created: await createInvite({ kind }) });
    } catch (e) {
      toast.show(errorText(e, t('inv.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  if (!ready) body = <LoadingState rows={3} />;
  else if (!isReal || !user)
    body = (
      <Card pad>
        <EmptyState
          icon="invite"
          body={t('inv.signIn')}
          actions={
            <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
              {t('auth.signInWithGoogle')}
            </Button>
          }
        />
      </Card>
    );
  else if (step.at === 'pick')
    body = (
      <ul className={s.kinds}>
        {KINDS.map((k) => {
          const soon = k.kind === 'coach' && !canCoach;
          return (
            <li key={k.kind}>
              <button type="button" className={s.kind} disabled={soon || busy} onClick={() => (k.kind === 'join' || k.kind === 'coach' ? void makeLink(k.kind) : setStep({ at: k.kind } as Step))}>
                <InviteScene kind={k.kind} />
                <span className={s.kindBody}>
                  <span className={[s.kindIcon, s[`k_${k.kind}`]].join(' ')}>
                    <Icon name={k.icon} size={20} />
                  </span>
                  <span className={s.kindText}>
                    <b>
                      {t(k.title)} {soon && <Badge>{t('inv.coach.locked')}</Badge>}
                    </b>
                    <span>{t(k.body)}</span>
                  </span>
                  {!soon && <Icon name="chevronRight" size={18} className={s.chev} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  else if (step.at === 'battle') body = <BattleForm name={user.displayName?.split(' ')[0] ?? ''} onBack={() => setStep({ at: 'pick' })} onReady={(created, warId) => setStep({ at: 'ready', kind: 'battle', created, warId })} />;
  else if (step.at === 'squad') body = <SquadPicker uid={user.uid} onBack={() => setStep({ at: 'pick' })} onReady={(created) => setStep({ at: 'ready', kind: 'squad', created })} />;
  else body = <ShareStep kind={step.kind} created={step.created} warId={step.warId} onAnother={() => setStep({ at: 'pick' })} />;

  return (
    <>
      <PageHeader title={t('inv.title')} subtitle={t('inv.subtitle')} />
      <div className={s.page}>{body}</div>
    </>
  );
}

function BattleForm({ name, onBack, onReady }: { name: string; onBack: () => void; onReady: (c: Created, warId: string) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(() => (name ? t('inv.battle.nameDefault', { name }) : 'Trade War'));
  const [buyIn, setBuyIn] = useState(1000);
  const [days, setDays] = useState(3);
  const [players, setPlayers] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return setError(t('inv.battle.name'));
    setBusy(true);
    setError(null);
    try {
      const war = await createBattle({ name: title.trim(), buyIn, days, maxPlayers: players });
      onReady(await createInvite({ kind: 'battle', warId: war.warId }), war.warId);
    } catch (err) {
      const m = errorText(err, t('inv.failed'));
      setError(m);
      toast.show(m, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card pad>
      <form className={s.form} onSubmit={submit}>
        <BackRow onBack={onBack} title={t('inv.battle')} icon="war" />
        <Field label={t('inv.battle.name')} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} required />
        <Choices label={t('inv.battle.buyIn')} value={buyIn} options={BUY_INS} onChange={setBuyIn} format={(v) => formatMoney(v, { digits: 0 })} />
        <Choices label={t('inv.battle.days')} value={days} options={DAYS} onChange={setDays} format={(v) => (v === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: v }))} />
        <Choices label={t('inv.battle.players')} value={players} options={[2, 4, 6, 10]} onChange={setPlayers} format={(v) => String(v)} />
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {t('inv.battle.create')}
        </Button>
      </form>
    </Card>
  );
}

function SquadPicker({ uid, onBack, onReady }: { uid: string; onBack: () => void; onReady: (c: Created) => void }) {
  const toast = useToast();
  const squads = useMySquads(uid);
  const list = squads.status === 'ready' ? squads.data : [];
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = pick ?? list[0]?.id ?? null;
  const name = useId();
  async function go() {
    if (!chosen) return;
    setBusy(true);
    try {
      onReady(await createInvite({ kind: 'squad', squadId: chosen }));
    } catch (e) {
      toast.show(errorText(e, t('inv.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card pad>
      <div className={s.form}>
        <BackRow onBack={onBack} title={t('inv.squad')} icon="social" />
        {squads.status === 'loading' ? (
          <LoadingState rows={2} />
        ) : !list.length ? (
          <EmptyState
            icon="social"
            body={t('inv.squad.none')}
            compact
            actions={
              <Link className={buttonClass({ variant: 'primary' })} to="/social">
                {t('inv.squad.create')}
              </Link>
            }
          />
        ) : (
          <>
            <fieldset className={s.choices}>
              <legend>{t('inv.squad.pick')}</legend>
              <div className={s.squadList}>
                {list.map((q) => (
                  <label key={q.id} className={[s.squadRow, q.id === chosen && s.chipOn].filter(Boolean).join(' ')}>
                    <input type="radio" name={name} checked={q.id === chosen} onChange={() => setPick(q.id)} />
                    <b>{q.name}</b>
                    <span className={s.muted}>{t('inv.squad.members', { n: q.members })}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button variant="primary" size="lg" block disabled={busy || !chosen} onClick={() => void go()}>
              {t('inv.squad.get')}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function BackRow({ onBack, title, icon }: { onBack: () => void; title: string; icon: IconName }) {
  return (
    <div className={s.backRow}>
      <Button variant="ghost" size="sm" iconOnly aria-label={t('inv.back')} onClick={onBack}>
        <Icon name="back" />
      </Button>
      <Icon name={icon} size={20} />
      <h2>{title}</h2>
    </div>
  );
}

function ShareStep({ kind, created, warId, onAnother }: { kind: InviteKind; created: Created; warId?: string; onAnother: () => void }) {
  const toast = useToast();
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const text = t(`inv.shareText.${kind}` as MessageKey);
  async function share() {
    const r = await shareLink(created.url, t('app.name'), text);
    if (r === 'copied') toast.show(t('inv.copied'));
    if (r === 'failed') toast.show(t('inv.copyFailed'), 'error');
  }
  async function copy() {
    if ((await copyText(created.url)) === 'copied') toast.show(t('inv.copied'));
    else toast.show(t('inv.copyFailed'), 'error');
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const name = to.trim().replace(/^@/, '').toLowerCase();
    if (!name) return;
    setSending(true);
    try {
      const r = await sendInvite(created.code, name);
      setNote(r.sent ? t('inv.sent', { name }) : t('inv.alreadySent', { name }));
      if (r.sent) setTo('');
    } catch (err) {
      setNote(errorText(err, t('inv.failed')));
    } finally {
      setSending(false);
    }
  }
  return (
    <Card pad className={s.ready}>
      <div className={s.readyHead}>
        <span className={s.readyIcon} aria-hidden>
          <Icon name="share" size={24} />
        </span>
        <div>
          <h2>{t('inv.ready')}</h2>
          <p className={s.muted}>{t('inv.ready.body')}</p>
        </div>
      </div>
      <div className={s.linkRow}>
        <Field label={t('inv.link')} value={created.url} readOnly onFocus={(e) => e.currentTarget.select()} />
        <Button variant="secondary" onClick={() => void copy()} aria-label={t('inv.copy')}>
          <Icon name="copy" size={18} /> {t('inv.copy')}
        </Button>
      </div>
      <Button variant="primary" size="lg" block onClick={() => void share()}>
        <Icon name="share" size={18} /> {t('inv.share')}
      </Button>
      <form className={s.sendRow} onSubmit={send}>
        <Field label={t('inv.sendTo')} prefix="@" placeholder={t('inv.username')} value={to} onChange={(e) => {
            setTo(e.target.value);
            setNote(null);
          }} autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={21} />
        <Button type="submit" variant="secondary" disabled={sending || !to.trim()}>
          {t('inv.send')}
        </Button>
      </form>
      {note && (
        <p className={s.note} role="status">
          {note}
        </p>
      )}
      <div className={s.row}>
        {kind === 'battle' && warId && (
          <Link className={buttonClass({ variant: 'ghost' })} to={`/battles/${encodeURIComponent(warId)}`}>
            {t('inv.openBattle')}
          </Link>
        )}
        <Button variant="ghost" onClick={onAnother}>
          {t('inv.another')}
        </Button>
        <Link className={buttonClass({ variant: 'ghost' })} to="/trade-war">
          {t('nav.tradeWar')}
        </Link>
      </div>
    </Card>
  );
}
