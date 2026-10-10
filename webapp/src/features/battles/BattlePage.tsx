/**
 * One battle (/battles/:id): the website's match room (practice/war.html) in the app. The
 * lobby, the stock draft, the live match (your match account, the trade ticket, positions,
 * leaderboard, Battlefield Ticker, Last Man Standing, storms, Bounty Board) and the results
 * with token rewards. Everything is decided by the server (tw_* functions); this screen reads
 * the match live and calls those functions.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuotes } from '../../data/markets';
import { useAuth } from '../../lib/auth';
import { formatMoney, formatPercent } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, Confirm, EmptyState, LoadingState, PageHeader, useToast } from '../../ui';
import { createInvite, errorText, shareLink } from '../invites/invites';
import { BATTLE_ID_RE, cancelBattle, joinBattle, leaveBattle, OUT_REASON, startBattle, surrender, useAccounts, useBattle, useBook, useEvents, type Battle } from './battle';
import { DraftView } from './DraftView';
import { LiveView } from './LiveView';
import { clock, RulesBox } from './parts';
import s from './Battles.module.css';

export default function BattlePage() {
  const raw = useParams().id ?? '';
  const id = BATTLE_ID_RE.test(raw) ? raw : null;
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const b = useBattle(id && ready && user ? id : null);
  const toast = useToast();
  if (!id) return <EmptyState icon="war" title={t('bt.missing')} actions={<Link to="/battles">{t('bt.back')}</Link>} />;
  if (!ready) return <LoadingState rows={6} />;
  if (!user || !isReal)
    return (
      <EmptyState
        icon="war"
        body={t('bt.signIn')}
        actions={
          <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
            {t('auth.signInWithGoogle')}
          </Button>
        }
      />
    );
  if (b.status === 'loading') return <LoadingState rows={6} />;
  if (b.status !== 'ready' || b.data.status === 'cancelled')
    return <EmptyState icon="war" title={b.status === 'ready' ? t('bt.cancelled') : t('bt.missing')} actions={<Link to="/battles">{t('bt.back')}</Link>} />;
  return <Room b={b.data} uid={user.uid} />;
}

function Room({ b, uid }: { b: Battle; uid: string }) {
  const player = b.players.includes(uid);
  const accts = useAccounts(player ? b.id : null);
  const book = useBook(player ? b.id : null, uid);
  const events = useEvents(player && b.status !== 'lobby' ? b.id : null);
  const quotes = useQuotes();
  const now = useNow(1000);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'leave' | 'cancel' | 'surrender'>(null);
  const host = b.host === uid;
  const accounts = accts.status === 'ready' ? accts.data : [];
  const me = accounts.find((a) => a.uid === uid) ?? null;

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.show(ok, 'success');
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  async function share() {
    setBusy(true);
    try {
      const inv = await createInvite({ kind: 'battle', warId: b.id });
      const r = await shareLink(inv.url, b.name, t('bt.shareText', { name: b.name }));
      if (r === 'copied') toast.show(t('bt.copied'), 'success');
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = { lobby: t('bt.status.lobby'), draft: t('bt.status.draft'), active: t('bt.status.active'), ended: t('bt.status.ended'), cancelled: t('bt.cancelled') }[b.status];
  return (
    <>
      <Link to="/battles" className={s.back}>
        ← {t('bt.back')}
      </Link>
      <PageHeader
        title={b.name}
        keepOnPhone
        subtitle={
          <span className={s.meta}>
            <Badge tone={b.status === 'active' ? 'up' : b.status === 'ended' ? 'neutral' : 'accent'}>{statusBadge}</Badge>
            {b.lms && <Badge tone="gold">{t('bt.lms')}</Badge>}
            <span>{t('bt.metaLine', { host: b.hostName, buyIn: formatMoney(b.buyIn, { digits: 0 }), days: b.days, n: b.players.length, max: b.maxPlayers })}</span>
            {b.status === 'active' && <b className="num">{t('bt.endsIn', { t: clock(b.endAt - now) })}</b>}
          </span>
        }
        actions={
          <span className={s.headActions}>
            {b.status === 'lobby' && player && b.players.length < b.maxPlayers && (
              <Button variant="secondary" disabled={busy} onClick={() => void share()}>
                {t('bt.invite')}
              </Button>
            )}
            {b.status === 'lobby' && player && !host && (
              <Button variant="ghost" disabled={busy} onClick={() => setConfirm('leave')}>
                {t('bt.leave')}
              </Button>
            )}
            {b.status === 'lobby' && host && (
              <Button variant="ghost" disabled={busy} onClick={() => setConfirm('cancel')}>
                {t('bt.cancel')}
              </Button>
            )}
            {b.status === 'active' && me && !me.out && (
              <Button variant="ghost" disabled={busy} onClick={() => setConfirm('surrender')}>
                {t('bt.surrender')}
              </Button>
            )}
          </span>
        }
      />

      {b.status === 'lobby' && <Lobby b={b} uid={uid} busy={busy} onJoin={() => void run(() => joinBattle(b.id), t('bt.joined'))} onStart={() => void run(() => startBattle(b.id), t('bt.started'))} />}
      {b.status !== 'lobby' && !player && b.status !== 'ended' && <EmptyState icon="war" body={t('bt.playersOnly')} />}
      {b.status === 'draft' && player && <DraftView b={b} uid={uid} now={now} />}
      {b.status === 'active' && player && <LiveView b={b} uid={uid} accounts={accounts} me={me} book={book.status === 'ready' ? book.data : { positions: [], fills: [] }} events={events.status === 'ready' ? events.data : []} quotes={quotes.status === 'ready' ? quotes.data : null} now={now} />}
      {b.status === 'ended' && <Results b={b} uid={uid} />}

      <Confirm
        open={!!confirm}
        title={confirm === 'surrender' ? t('bt.surrender.title') : confirm === 'cancel' ? t('bt.cancel.title') : t('bt.leave.title')}
        action={confirm === 'surrender' ? t('bt.surrender') : confirm === 'cancel' ? t('bt.cancel') : t('bt.leave')}
        variant="danger"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          void run(
            () => (confirm === 'surrender' ? surrender(b.id) : confirm === 'cancel' ? cancelBattle(b.id) : leaveBattle(b.id)),
            confirm === 'surrender' ? t('bt.surrendered') : confirm === 'cancel' ? t('bt.cancelledToast') : t('bt.left'),
          )
        }
      >
        <p>{confirm === 'surrender' ? t('bt.surrender.body') : confirm === 'cancel' ? t('bt.cancel.body') : t('bt.leave.body')}</p>
      </Confirm>
    </>
  );
}

function Lobby({ b, uid, busy, onJoin, onStart }: { b: Battle; uid: string; busy: boolean; onJoin: () => void; onStart: () => void }) {
  const player = b.players.includes(uid);
  const waiting = b.invited.filter((u) => !b.players.includes(u)).length;
  return (
    <div className={s.cols}>
      <Card title={t('bt.players', { n: b.players.length, max: b.maxPlayers })} flush>
        <ul className={s.list}>
          {b.players.map((p) => (
            <li key={p}>
              <Link to={`/profile/${p}`}>{b.names[p] ?? 'Trader'}</Link>
              {p === b.host && <Badge tone="accent">{t('bt.hostTag')}</Badge>}
              {p === uid && <Badge>{t('bt.you')}</Badge>}
            </li>
          ))}
        </ul>
        {waiting > 0 && <p className={s.note}>{t('bt.waitingFor', { n: waiting })}</p>}
        <div className={s.actions}>
          {!player && (
            <Button variant="primary" size="lg" disabled={busy || b.players.length >= b.maxPlayers} onClick={onJoin}>
              {b.players.length >= b.maxPlayers ? t('bt.full') : t('bt.join', { buyIn: formatMoney(b.buyIn, { digits: 0 }) })}
            </Button>
          )}
          {b.host === uid && (
            <Button variant="primary" size="lg" disabled={busy || b.players.length < 2} onClick={onStart}>
              {t('bt.start')}
            </Button>
          )}
          {b.host === uid && b.players.length < 2 && <span className={s.muted}>{t('bt.needTwo')}</span>}
          {player && b.host !== uid && <span className={s.muted}>{t('bt.waitHost', { name: b.hostName })}</span>}
        </div>
      </Card>
      <RulesBox b={b} />
    </div>
  );
}

function Results({ b, uid }: { b: Battle; uid: string }) {
  const winner = b.results.find((r) => r.rank === 1);
  const mine = b.rewards.find((r) => r.uid === uid);
  return (
    <div className={s.cols}>
      <div className={s.stack}>
        <Card pad className={s.winner}>
          <span className={s.trophy} aria-hidden="true">
            🏆
          </span>
          <div>
            <b>{winner ? t(b.lms ? 'bt.lastStanding' : 'bt.winner', { name: winner.name }) : t('bt.noWinner')}</b>
            {winner && <span className={s.muted}>{t('bt.winnerLine', { pct: formatPercent(winner.pnlPct), pnl: formatMoney(winner.pnl) })}</span>}
          </div>
        </Card>
        <Card title={t('bt.rewards')} pad>
          {!b.rewardsPaid ? (
            <p className={s.muted}>{t('bt.rewardsSoon')}</p>
          ) : b.rewards.length ? (
            <ul className={s.list}>
              {b.rewards.map((r) => (
                <li key={r.uid} className={r.uid === uid ? s.mine : undefined}>
                  <span>{b.names[r.uid] ?? 'Trader'}</span>
                  <b className="num">+{r.tokens}</b>
                  <small className={s.muted}>{r.note}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{t('bt.noRewards')}</p>
          )}
          {mine && <p className={s.note}>{t('bt.yourReward', { n: mine.tokens })}</p>}
        </Card>
      </div>
      <Card title={t('bt.final')} flush>
        <ol className={s.board}>
          {b.results.map((r) => (
            <li key={r.uid} className={r.uid === uid ? s.mine : undefined}>
              <span className={s.rank}>{r.rank}</span>
              <Link to={`/profile/${r.uid}`} className={s.name}>
                {r.name}
              </Link>
              {r.out && <Badge tone="down">{t('bt.outTag')}</Badge>}
              <span className={[s.pct, r.pnlPct >= 0 ? s.up : s.down].join(' ')}>{formatPercent(r.pnlPct)}</span>
              <small className={s.muted}>{r.out && r.outReason ? OUT_REASON[r.outReason] ?? r.outReason : t('bt.tradesN', { n: r.trades })}</small>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
