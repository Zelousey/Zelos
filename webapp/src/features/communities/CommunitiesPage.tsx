/**
 * The Founder Program hub (/communities): what founders earn, your community (or start one),
 * trending this week, the biggest, and browse by state.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Loadable } from '../../data/liveDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Card, EmptyState, Field, LoadingState, PageHeader, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { ACTIVE_DAYS, createCommunity, thisWeek, useBiggest, useByState, useCommunity, useMembership, useTrending, type Community } from './communities';
import { CommunityCard, Milestones, StateSelect } from './parts';
import s from './Communities.module.css';

function Grid({ rows, empty, sub }: { rows: Loadable<Community[]>; empty: string; sub?: (c: Community) => string }) {
  if (rows.status === 'loading') return <LoadingState rows={2} />;
  if (rows.status !== 'ready') return <p className={s.muted}>{t('cm.loadFailed')}</p>;
  if (!rows.data.length) return <p className={s.muted}>{empty}</p>;
  return (
    <div className={s.grid}>
      {rows.data.map((c) => (
        <CommunityCard key={c.id} c={c} sub={sub?.(c)} />
      ))}
    </div>
  );
}

function Mine({ uid }: { uid: string }) {
  const m = useMembership(uid);
  const cid = m.status === 'ready' && m.data.cid ? m.data.cid : null;
  const mine = useCommunity(cid);
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (m.status === 'loading' || (cid && mine.status === 'loading')) return <LoadingState rows={2} />;
  if (cid && mine.status === 'ready') return <CommunityCard c={mine.data} sub={t('cm.yours')} />;
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return setErr(t('cm.pickState'));
    setBusy(true);
    setErr(null);
    try {
      const r = await createCommunity(name.trim(), state);
      navigate(`/communities/${encodeURIComponent(r.cid)}`);
    } catch (e2) {
      const msg = errorText(e2, t('cm.failed'));
      setErr(msg);
      toast.show(msg, 'error');
      setBusy(false);
    }
  }
  return (
    <form className={s.form} onSubmit={create}>
      <p className={s.muted}>{t('cm.startBody')}</p>
      <Field label={t('cm.name')} value={name} minLength={3} maxLength={30} required onChange={(e) => setName(e.target.value)} placeholder="Zelos Clan" />
      <StateSelect id="cm-new-state" value={state} onChange={setState} label={t('cm.state')} />
      {err && (
        <p className={s.error} role="alert">
          {err}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        {t('cm.create')}
      </Button>
    </form>
  );
}

export default function CommunitiesPage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const wk = thisWeek();
  const trending = useTrending(wk);
  const biggest = useBiggest();
  const [st, setSt] = useState('');
  const byState = useByState(st || null);
  const stateRows: Loadable<Community[]> = byState.status === 'ready' ? { status: 'ready', data: [...byState.data].sort((a, b) => b.members - a.members) } : byState;
  return (
    <>
      <PageHeader title={t('nav.communities')} subtitle={t('cm.subtitle')} />
      <div className={s.stack}>
        <Card title={t('cm.programTitle')} pad>
          <p className={s.lead}>{t('cm.programBody')}</p>
          <Milestones />
          <p className={s.fine}>{t('cm.fine', { n: ACTIVE_DAYS })}</p>
        </Card>
        <Card title={t('cm.yourCommunity')} pad>
          {!ready ? (
            <LoadingState rows={1} />
          ) : uid ? (
            <Mine uid={uid} />
          ) : (
            <EmptyState icon="social" body={t('cm.signIn')} compact actions={<Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>{t('auth.signInWithGoogle')}</Button>} />
          )}
        </Card>
        <Card title={t('cm.trending')} pad>
          <Grid rows={trending} empty={t('cm.trendingNone')} sub={(c) => t('cm.joinedWeek', { n: c.weeks[wk] ?? 0 })} />
        </Card>
        <Card title={t('cm.biggest')} pad>
          <Grid rows={biggest} empty={t('cm.none')} />
        </Card>
        <Card title={t('cm.byState')} pad>
          <StateSelect id="cm-browse-state" value={st} onChange={setSt} label={t('cm.state')} />
          {st && <Grid rows={stateRows} empty={t('cm.noneInState')} />}
        </Card>
      </div>
    </>
  );
}
