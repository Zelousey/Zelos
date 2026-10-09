/**
 * One squad (/social/:id; the website's squads.html?s=): join, the shared goal, the squad
 * leaderboard (competition, all-time, week, month, season, by % growth so every balance
 * competes fairly), a squad Trade War, the members-only chat, the invite link and room code,
 * and the owner's controls.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { levelFor } from '../../data/levels';
import { useAuth } from '../../lib/auth';
import { formatDate, formatMoney } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Button, buttonClass, Card, Confirm, EmptyState, LoadingState, PageHeader, Tabs, useToast } from '../../ui';
import { LevelBadge } from '../dashboard/LevelBadge';
import type { Ranked } from '../dashboard/social';
import { nyToday, seasonFor } from '../leaderboard/periods';
import { createInvite, errorText, shareLink } from '../invites/invites';
import { ChallengeSheet } from '../profile/ChallengeSheet';
import { OwnerPanel } from './OwnerPanel';
import { SquadChat } from './SquadChat';
import { goalProgress, joinSquad, leaveSquad, metric, useProfiles, useSquad, type BoardId, type Squad } from './squads';
import s from './Social.module.css';

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const days = (end: number, now: number) => Math.max(0, Math.ceil((end - now) / 864e5));

export default function SquadPage() {
  const { id = '' } = useParams();
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const valid = /^[A-Za-z0-9]{6,40}$/.test(id);
  const sq = useSquad(valid && ready && user ? id : null);
  const signIn = () => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'));
  if (!ready || (valid && user && sq.status === 'loading')) return <LoadingState rows={6} />;
  if (!user || sq.status === 'error')
    return <EmptyState icon="social" title={t('sq.private.title')} body={t('sq.private.body')} actions={<Button variant="primary" onClick={signIn}>{t('auth.signInWithGoogle')}</Button>} />;
  if (!valid || sq.status !== 'ready')
    return (
      <EmptyState
        icon="social"
        title={t('sq.notFound')}
        body={t('sq.notFound.body')}
        actions={
          <Link className={buttonClass({ variant: 'primary' })} to="/social">
            {t('sq.yours')}
          </Link>
        }
      />
    );
  return <SquadView sq={sq.data} uid={isReal ? user.uid : null} displayName={user.displayName} onSignIn={signIn} />;
}

function SquadView({ sq, uid, displayName, onSignIn }: { sq: Squad; uid: string | null; displayName: string | null; onSignIn: () => void }) {
  const now = useNow();
  const profs = useProfiles(sq.members);
  const isMember = !!uid && sq.members.includes(uid);
  const isOwner = !!uid && sq.owner === uid;
  const compOn = !!sq.comp && now < sq.comp.end;
  return (
    <div className={s.page}>
      <PageHeader
        keepOnPhone
        title={`👥 ${sq.name}`}
        subtitle={
          <>
            {t('sq.kicker')} · {t('sq.members', { n: sq.members.length })}
            {sq.comp ? ` · ${compOn ? t('sq.comp.left', { n: days(sq.comp.end, now) }) : t('sq.comp.done', { date: formatDate(sq.comp.end) })}` : ''}
          </>
        }
      />
      {!isMember && <JoinCard sq={sq} uid={uid} displayName={displayName} onSignIn={onSignIn} />}
      {sq.goal && profs && <GoalCard sq={sq} profs={profs} now={now} />}
      <div className={s.cols}>
        <Board sq={sq} uid={uid} profs={profs} now={now} isMember={isMember} />
        {isMember && uid && <SquadChat sq={sq} uid={uid} />}
      </div>
      {isMember && uid && (
        <>
          <InviteCard sq={sq} />
          {isOwner ? <OwnerPanel sq={sq} profs={profs} compOn={compOn} /> : <LeaveCard sq={sq} uid={uid} />}
        </>
      )}
      <p className={s.fine}>{t('sq.fine')}</p>
    </div>
  );
}

function JoinCard({ sq, uid, displayName, onSignIn }: { sq: Squad; uid: string | null; displayName: string | null; onSignIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function join() {
    if (!uid) return;
    setBusy(true);
    setErr(null);
    try {
      await joinSquad(sq, uid, displayName);
    } catch (e) {
      setErr(errorText(e, t('sq.failed')));
      setBusy(false);
    }
  }
  return (
    <Card pad className={s.join}>
      <h2 className={s.cardTitle}>{t('sq.join.title')}</h2>
      {uid ? (
        <Button variant="primary" disabled={busy} onClick={() => void join()}>
          {t('sq.join.go', { name: sq.name })}
        </Button>
      ) : (
        <Button variant="primary" onClick={onSignIn}>
          {t('sq.join.signIn')}
        </Button>
      )}
      {err ? (
        <p className={s.error} role="alert">
          {err}
        </p>
      ) : (
        <p className={s.muted}>{t('sq.join.body')}</p>
      )}
    </Card>
  );
}

function GoalCard({ sq, profs, now }: { sq: Squad; profs: Record<string, Ranked>; now: number }) {
  const g = sq.goal!;
  const gp = goalProgress(sq, profs, now)!;
  return (
    <Card pad className={[s.goal, gp.done && s.goalDone].filter(Boolean).join(' ')}>
      <div className={s.goalTop}>
        <span className={s.kicker}>{gp.over ? t('sq.goal.finished') : t('sq.goal.left', { n: days(g.end, now) })}</span>
        <b className={gp.avg >= 0 ? s.up : s.down}>
          {pct(gp.avg)} <small>{t('sq.goal.of', { n: g.target })}</small>
        </b>
      </div>
      <h2 className={s.cardTitle}>{g.text || t('sq.goal.default', { n: g.target })}</h2>
      <div className={s.bar} role="progressbar" aria-label={t('sq.goal.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gp.pct)}>
        <i style={{ width: `${gp.pct.toFixed(1)}%` }} />
      </div>
      <p className={s.muted}>
        {gp.done ? `🎉 ${t('sq.goal.reached')} ` : ''}
        {t('sq.goal.body', { n: gp.counted, date: formatDate(g.start) })}
      </p>
    </Card>
  );
}

function Board({ sq, uid, profs, now, isMember }: { sq: Squad; uid: string | null; profs: Record<string, Ranked> | null; now: number; isMember: boolean }) {
  const season = seasonFor(nyToday(now));
  const compOn = !!sq.comp && now < sq.comp.end;
  const boards: BoardId[] = [...(sq.comp ? (['comp'] as BoardId[]) : []), 'all', 'week', 'month', ...(season ? (['season'] as BoardId[]) : [])];
  const [pick, setPick] = useState<BoardId | null>(null);
  const board = pick && boards.includes(pick) ? pick : boards[0]!;
  const [war, setWar] = useState(false);
  const label = (b: BoardId) => (b === 'comp' ? t(compOn ? 'sq.board.comp' : 'sq.board.lastComp') : b === 'season' ? season!.name : t(`sq.board.${b}` as MessageKey));
  const rows = sq.members
    .map((u) => ({ uid: u, p: profs?.[u], name: profs?.[u]?.name || sq.names[u] || 'Trader', m: metric(sq, board, u, profs?.[u], now) }))
    .sort((a, b) => (b.m ? b.m.pct : -1e9) - (a.m ? a.m.pct : -1e9));
  const cfg = sq.config;
  return (
    <Card flush title={t('sq.board')}>
      <div className={s.boardTabs}>
        <Tabs label={t('sq.board')} value={board} onChange={setPick} items={boards.map((b) => ({ value: b, label: label(b) }))} />
      </div>
      {!profs ? (
        <LoadingState rows={3} />
      ) : (
        <ol className={s.list}>
          {rows.map((r, i) => {
            const lv = r.p ? levelFor(r.p.xp).level : null;
            return (
              <li key={r.uid} className={r.uid === uid ? s.me : undefined}>
                <Link to={`/profile/${encodeURIComponent(r.uid)}`} className={s.boardRow}>
                  <span className={s.place}>{i + 1}</span>
                  {lv ? <LevelBadge level={lv} size={24} /> : <span className={s.badgeGap} />}
                  <span className={s.who}>
                    <b>
                      {r.name}
                      {r.uid === sq.owner && <small className={s.ownerTag}>{t('sq.owner').toLowerCase()}</small>}
                      {board === 'comp' && !compOn && i === 0 && r.m ? ' 🏆' : ''}
                    </b>
                    <small>{r.p ? `${formatMoney(r.p.equity, { digits: 2 })} · ${r.p.xp.toLocaleString('en-US')} XP` : t('sq.private')}</small>
                  </span>
                  <span className={[s.num, r.m ? (r.m.pct >= 0 ? s.up : s.down) : ''].join(' ')}>{r.m ? pct(r.m.pct) : '–'}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {isMember && sq.members.length > 1 && (
        <div className={s.boardFoot}>
          <Button variant="secondary" size="sm" onClick={() => setWar(true)}>
            {t('sq.war')}
          </Button>
          {(cfg.symbols || cfg.viewTrades) && <p className={s.muted}>{[cfg.symbols ? t('sq.war.symbols', { n: cfg.symbols.length }) : '', cfg.viewTrades ? t('sq.war.viewTrades') : ''].filter(Boolean).join(' · ')}</p>}
          {war && <ChallengeSheet open onClose={() => setWar(false)} squadId={sq.id} toName={sq.name} />}
        </div>
      )}
      <p className={[s.muted, s.boardNote].join(' ')}>{t('sq.board.note')}</p>
    </Card>
  );
}

function InviteCard({ sq }: { sq: Squad }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const inv = await createInvite({ kind: 'squad', squadId: sq.id });
      const r = await shareLink(inv.url, t('sq.invite.title'), t('sq.invite.text', { name: sq.name }) + (sq.code ? ` ${t('sq.invite.code', { code: sq.code })}` : ''));
      if (r === 'copied') toast.show(t('sq.invite.copied'));
    } catch (e) {
      toast.show(errorText(e, t('sq.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card pad>
      <h2 className={s.cardTitle}>{t('sq.invite')}</h2>
      <p className={s.muted}>{t('sq.invite.body')}</p>
      <div className={s.inlineRow}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => void share()}>
          {t('sq.invite.share')}
        </Button>
        {sq.code && (
          <span className={s.muted}>
            {t('sq.invite.orCode')} <b className={s.code}>{sq.code}</b>
          </span>
        )}
      </div>
    </Card>
  );
}

function LeaveCard({ sq, uid }: { sq: Squad; uid: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  async function leave() {
    setBusy(true);
    try {
      await leaveSquad(sq, uid);
      navigate('/social');
    } catch (e) {
      toast.show(errorText(e, t('sq.failed')), 'error');
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>
        {t('sq.leave')}
      </Button>
      <Confirm open={asking} title={t('sq.leave.confirm', { name: sq.name })} action={t('sq.leave')} busy={busy} onConfirm={() => void leave()} onClose={() => setAsking(false)}>
        <p>{t('sq.leave.body')}</p>
      </Confirm>
    </div>
  );
}

