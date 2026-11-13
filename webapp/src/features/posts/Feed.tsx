/**
 * Community posts on the Communities page (owner 2026-11-13): Solo trades and Trade War battles in
 * two separate tabs, newest first. Your own posts can be deleted; anyone else's can be reported or
 * the person blocked (their posts then disappear for you).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button, Confirm, EmptyState, LoadingState, Tabs, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { SafetyMenu } from '../safety/SafetyMenu';
import { deletePost, useFeed, type Post, type PostSource } from './posts';
import { ShareCard } from './ShareCard';
import s from './Posts.module.css';

export function Feed() {
  const [params, setParams] = useSearchParams();
  const source: PostSource = params.get('feed') === 'battle' ? 'battle' : 'solo';
  const feed = useFeed(source);
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  const blocked = me.status === 'ready' ? me.data.blocked : [];
  const rows = feed.status === 'ready' ? feed.data.filter((p) => !blocked.includes(p.uid)) : [];
  return (
    <section className={s.feed} aria-labelledby="posts-h">
      <div className={s.feedHead}>
        <h2 id="posts-h" className={s.h2}>
          {t('post.feed')}
        </h2>
        <Tabs
          label={t('post.feed')}
          value={source}
          onChange={(v) => setParams((p) => (p.set('feed', v), p), { replace: true })}
          items={[
            { value: 'solo', label: t('post.tab.solo') },
            { value: 'battle', label: t('post.tab.battle') },
          ]}
        />
      </div>
      <p className={s.muted}>{t(source === 'solo' ? 'post.howSolo' : 'post.howBattle')}</p>
      {feed.status === 'loading' ? (
        <LoadingState rows={2} />
      ) : feed.status !== 'ready' ? (
        <p className={s.muted}>{t('post.loadFailed')}</p>
      ) : !rows.length ? (
        <EmptyState icon="chat" body={t(source === 'solo' ? 'post.emptySolo' : 'post.emptyBattle')} compact />
      ) : (
        <ul className={s.list}>
          {rows.map((p) => (
            <PostItem key={p.id} p={p} mine={!!user && user.uid === p.uid} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PostItem({ p, mine }: { p: Post; mine: boolean }) {
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <li className={s.post}>
      <div className={s.postHead}>
        <Link to={`/profile/${p.uid}`} className={s.author}>
          {p.photo ? <img src={p.photo} alt="" className={s.avatar} /> : <span className={s.avatar} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>}
          <span>
            <b>{p.name}</b>
            {p.username && <span className={s.muted}> @{p.username}</span>}
          </span>
        </Link>
        <span className={s.when}>{formatRelative(p.createdAt)}</span>
        {mine ? (
          <Button variant="ghost" size="sm" onClick={() => setAsk(true)} disabled={busy}>
            {t('post.delete')}
          </Button>
        ) : (
          <SafetyMenu what={{ kind: 'post', target: p.uid, where: p.id }} name={p.name} />
        )}
      </div>
      <ShareCard source={p.source} card={p.card} />
      {p.thesis && <p className={s.postThesis}>{p.thesis}</p>}
      <Confirm
        open={ask}
        title={t('post.deleteAsk')}
        action={t('post.delete')}
        variant="danger"
        busy={busy}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          setBusy(true);
          deletePost(p.id)
            .then(() => setAsk(false))
            .catch((e) => toast.show(errorText(e, t('post.failed')), 'error'))
            .finally(() => setBusy(false));
        }}
      >
        {t('post.deleteBody')}
      </Confirm>
    </li>
  );
}
