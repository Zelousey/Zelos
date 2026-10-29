/**
 * Team Cooperation (Phase 10c, owner Q17): the squad plays as two teams balanced by XP. The host
 * makes the teams in the lobby and can move people; a team's score is its players' average %
 * return; teammates see each other's positions (firestore.rules), the other team doesn't.
 * The server decides the teams and the result (tw_teams, tw_start_teams, tw_team_results).
 */
import { useState } from 'react';
import { formatPercent } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, Card, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { setTeams, teamAverages, useBook, type Account, type Battle, type Team } from './battle';
import s from './Battles.module.css';

const other = (t: Team): Team => (t === 'A' ? 'B' : 'A');

/** Lobby: who's on which team; the host makes them and moves people. */
export function LobbyTeams({ b, uid }: { b: Battle; uid: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const host = b.host === uid;
  async function run(action: 'balance' | 'swap', who?: string) {
    setBusy(true);
    try {
      await setTeams(b.id, action, who);
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  const teams = b.teams;
  return (
    <Card title={t('tm.title')} subtitle={t('tm.sub')} pad>
      {!teams ? (
        <p className={s.muted}>{host ? t('tm.none.host') : t('tm.none')}</p>
      ) : (
        <div className={s.teams}>
          {(['A', 'B'] as const).map((team) => (
            <div key={team}>
              <h3 className={s.teamName}>{t('tm.team', { team })}</h3>
              <ul className={s.list}>
                {b.players
                  .filter((p) => teams[p] === team)
                  .map((p) => (
                    <li key={p}>
                      <span>{b.names[p] ?? 'Trader'}</span>
                      {p === uid && <Badge>{t('bt.you')}</Badge>}
                      {host && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run('swap', p)} aria-label={t('tm.moveLabel', { name: b.names[p] ?? 'Trader', team: other(team) })}>
                          {t('tm.move', { team: other(team) })}
                        </Button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {host && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run('balance')}>
          {teams ? t('tm.rebalance') : t('tm.make')}
        </Button>
      )}
    </Card>
  );
}

/** Live: each team's average return, your team marked. */
export function TeamScores({ b, uid, accounts }: { b: Battle; uid: string; accounts: Account[] }) {
  if (!b.teams) return null;
  const mine = b.teams[uid];
  const rows = teamAverages(accounts, b.teams);
  const lead = rows.length === 2 && rows[0]!.avgPct !== rows[1]!.avgPct ? (rows[0]!.avgPct > rows[1]!.avgPct ? rows[0]!.team : rows[1]!.team) : null;
  return (
    <Card title={t('tm.scores')} subtitle={t('tm.scoresSub')} flush>
      <ul className={s.board}>
        {rows.map((r) => (
          <li key={r.team} className={r.team === mine ? s.mine : undefined}>
            <span className={s.rank} aria-hidden="true">
              {r.team}
            </span>
            <span className={s.name}>
              {t('tm.team', { team: r.team })} <small className={s.muted}>{t('tm.players', { n: r.players })}</small>
            </span>
            <span className={s.tags}>
              {r.team === mine && <Badge>{t('tm.yours')}</Badge>}
              {r.team === lead && <Badge tone="gold">{t('tm.leading')}</Badge>}
            </span>
            <span className={[s.pct, r.avgPct >= 0 ? s.up : s.down].join(' ')}>{formatPercent(r.avgPct)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Live: your teammates' positions (the rules let only teammates read them). */
export function TeammateTrades({ b, uid }: { b: Battle; uid: string }) {
  const mine = b.teams?.[uid];
  const mates = mine ? b.players.filter((p) => p !== uid && b.teams![p] === mine) : [];
  if (!mates.length) return null;
  return (
    <Card title={t('tm.mates')} subtitle={t('tm.matesSub')} flush>
      <ul className={s.list}>
        {mates.map((p) => (
          <Mate key={p} warId={b.id} uid={p} name={b.names[p] ?? 'Trader'} />
        ))}
      </ul>
    </Card>
  );
}

function Mate({ warId, uid, name }: { warId: string; uid: string; name: string }) {
  const book = useBook(warId, uid);
  const pos = book.status === 'ready' ? book.data.positions : [];
  return (
    <li>
      <b>{name}</b>
      <span className={s.muted}>{book.status === 'loading' ? '…' : pos.length ? pos.map((x) => t('tm.holding', { qty: x.qty, sym: x.sym })).join(', ') : t('tm.noPositions')}</span>
    </li>
  );
}

/** Results: which team won on average return. */
export function TeamResult({ b, uid }: { b: Battle; uid: string }) {
  const r = b.teamResults;
  if (!r) return null;
  const mine = b.teams?.[uid];
  return (
    <Card pad className={s.winner}>
      <span className={s.trophy} aria-hidden="true">
        🤝
      </span>
      <div>
        <b>{r.winner ? t('tm.won', { team: r.winner }) : t('tm.tie')}</b>
        <span className={s.muted}>{r.teams.map((x) => t('tm.resultLine', { team: x.team, pct: formatPercent(x.avgPct), n: x.players })).join(' · ')}</span>
        {mine && r.winner && <span className={s.muted}>{r.winner === mine ? t('tm.youWon') : t('tm.youLost')}</span>}
      </div>
    </Card>
  );
}
