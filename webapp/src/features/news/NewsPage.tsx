/**
 * Zelos News: Zelos updates, Trade War news, market news (official sources + the team's
 * market posts, optionally just your watchlist) and posts by people who move markets.
 * A featured post on top of "All"; posts newer than your last visit get a "New" badge.
 */
import { reportMission } from '../../data/missionEvent';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDate, formatRelative } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, buttonClass, Card, EmptyState, Icon, PageHeader, SkeletonRows } from '../../ui';
import { useWatchlist } from '../dashboard/useWatchlist';
import { readSeen, useCanPost, useOfficialNews, usePosts, type NewsPost, type NewsSection, type OfficialItem } from './news';
import s from './News.module.css';

export const SECTION_LABEL: Record<NewsSection, MessageKey> = {
  zelos: 'news.sec.zelos',
  tradewar: 'news.sec.tradewar',
  market: 'news.sec.market',
  voices: 'news.sec.voices',
};
const PLATFORM: Record<string, MessageKey> = { x: 'news.platform.x', truth: 'news.platform.truth', other: 'news.platform.other' };

const day = (d: string) => formatDate(`${d}T12:00:00`, { year: true });
const isExternal = (to: string) => to.startsWith('https://');

type Tab = 'all' | NewsSection;
type Entry = { kind: 'post'; post: NewsPost; at: number } | { kind: 'official'; item: OfficialItem; at: number };

export default function NewsPage() {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  // what you'd seen before this visit (the shell marks everything seen once you're here)
  const [seen] = useState(readSeen);
  const [tab, setTab] = useState<Tab>('all');
  const [mine, setMine] = useState(false);
  const { status, posts } = usePosts();
  const official = useOfficialNews();
  const watch = useWatchlist(uid);
  const canPost = useCanPost(uid);
  const watchlist = watch.status === 'ready' ? watch.data : [];
  const items = official.status === 'ready' ? official.data : [];

  const featured = tab === 'all' ? posts.find((p) => p.featured) : undefined;
  let entries: Entry[] = posts.filter((p) => p !== featured && (tab === 'all' || p.section === tab)).map((post) => ({ kind: 'post', post, at: post.stamp }));
  if (tab === 'market' || tab === 'all') {
    const off = items.filter((i) => !(tab === 'market' && mine) || (i.sym && watchlist.includes(i.sym)));
    // "All" shows only the latest few official items; Market shows them all
    entries = entries.concat((tab === 'all' ? off.slice(0, 6) : off).map((item) => ({ kind: 'official', item, at: item.at })));
  }
  if (tab === 'market' && mine) entries = entries.filter((e) => e.kind === 'official');
  entries.sort((a, b) => b.at - a.at);

  return (
    <>
      <PageHeader
        title={t('nav.news')}
        subtitle={t('news.subtitle')}
        actions={
          canPost ? (
            <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/news/post">
              {t('news.post.open')}
            </Link>
          ) : undefined
        }
      />
      <div className={s.filters} role="group" aria-label={t('news.filter')}>
        {(['all', 'zelos', 'tradewar', 'market', 'voices'] as const).map((c) => (
          <button key={c} type="button" className={s.chip} aria-pressed={tab === c} onClick={() => setTab(c)}>
            {c === 'all' ? t('news.all') : t(SECTION_LABEL[c])}
          </button>
        ))}
      </div>

      {tab === 'market' && (
        <div className={s.marketBar}>
          <p className={s.note}>{t('news.market.note')}</p>
          {uid && (
            <div className={s.toggle} role="group" aria-label={t('news.market.scope')}>
              <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>
                {t('news.market.everything')}
              </button>
              <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>
                {t('news.market.watchlist')}
              </button>
            </div>
          )}
        </div>
      )}
      {tab === 'voices' && <p className={s.note}>{t('news.voices.note')}</p>}

      {featured && <Featured post={featured} isNew={featured.stamp > seen} />}

      {status === 'loading' && !entries.length ? (
        <Card pad>
          <SkeletonRows rows={4} />
        </Card>
      ) : entries.length ? (
        <div className={s.feed}>
          {entries.map((e) => (e.kind === 'post' ? <Post key={e.post.id} post={e.post} isNew={e.post.stamp > seen} /> : <Official key={e.item.id} item={e.item} />))}
        </div>
      ) : (
        !featured && (
          <Card>
            <EmptyState icon="news" body={tab === 'market' && mine ? (watchlist.length ? t('news.market.noneWatch') : t('news.market.noWatchlist')) : t('news.empty')} />
          </Card>
        )
      )}
    </>
  );
}

function Meta({ post, isNew, onDark }: { post: NewsPost; isNew: boolean; onDark?: boolean }) {
  return (
    <div className={[s.meta, onDark && s.onDark].filter(Boolean).join(' ')}>
      <span className={s.cat}>{t(SECTION_LABEL[post.section])}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={post.date}>{day(post.date)}</time>
      {isNew && <Badge tone="accent">{t('news.new')}</Badge>}
    </div>
  );
}

function PostLink({ link, className, size = 14 }: { link: { to: string; label: string }; className?: string; size?: number }) {
  return isExternal(link.to) ? (
    <a className={className} href={link.to} target="_blank" rel="noopener noreferrer">
      {link.label}
      <Icon name="external" size={size} />
    </a>
  ) : (
    <Link className={className} to={link.to}>
      {link.label}
      <Icon name="chevronRight" size={size} />
    </Link>
  );
}

function Featured({ post, isNew }: { post: NewsPost; isNew: boolean }) {
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  return (
    <article className={s.featured} aria-labelledby={titleId}>
      <div className={s.featuredArt} aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={64} height={64} />
      </div>
      <div className={s.featuredBody}>
        <div className={s.featuredTag}>{t('news.featured')}</div>
        <Meta post={post} isNew={isNew} onDark />
        <h2 id={titleId} className={s.featuredTitle}>
          {post.title}
        </h2>
        <div id={bodyId} className={s.featuredText}>
          {(open ? post.body : post.body.slice(0, 1)).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <div className={s.featuredActions}>
          {post.link && <PostLink link={post.link} className={buttonClass({ variant: 'secondary' })} size={16} />}
          {post.body.length > 1 && (
            <button type="button" className={s.featuredMore} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
              {open ? t('news.less') : t('news.more')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Post({ post, isNew }: { post: NewsPost; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  if (post.voice) return <VoiceCard post={post} isNew={isNew} />;
  const long = post.body.length > 1;
  return (
    <article className={s.post} aria-labelledby={titleId}>
      <Meta post={post} isNew={isNew} />
      <h2 id={titleId} className={s.postTitle}>
        {post.title}
      </h2>
      <div id={bodyId} className={[s.body, long && !open && s.clamped].filter(Boolean).join(' ')}>
        {(open ? post.body : post.body.slice(0, 1)).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      <div className={s.postActions}>
        {long && (
          <button type="button" className={s.more} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
            {open ? t('news.less') : t('news.more')}
          </button>
        )}
        {post.link && <PostLink link={post.link} className={s.link} />}
      </div>
    </article>
  );
}

function VoiceCard({ post, isNew }: { post: NewsPost; isNew: boolean }) {
  const v = post.voice!;
  const titleId = useId();
  return (
    <article className={[s.post, s.voice].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <div className={s.meta}>
        <span className={s.cat}>{t('news.sec.voices')}</span>
        <span aria-hidden="true">·</span>
        <span>{t(PLATFORM[v.platform] ?? 'news.platform.other')}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={v.postedAt}>{day(v.postedAt)}</time>
        {isNew && <Badge tone="accent">{t('news.new')}</Badge>}
      </div>
      <div className={s.voiceWho}>
        <span className={s.voiceAvatar} aria-hidden="true">
          {v.author.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b id={titleId}>{v.author}</b>
          {v.handle && <span className={s.handle}> @{v.handle}</span>}
        </span>
      </div>
      <blockquote className={s.quote} cite={v.url}>
        {v.quote}
      </blockquote>
      {post.title && <p className={s.why}>{post.title}</p>}
      <div className={s.postActions}>
        <a className={s.link} href={v.url} target="_blank" rel="noopener noreferrer" onClick={() => reportMission('news', post.id)}>
          {t(v.platform === 'x' ? 'news.voices.viewX' : v.platform === 'truth' ? 'news.voices.viewTruth' : 'news.voices.view')}
          <Icon name="external" size={14} />
        </a>
      </div>
    </article>
  );
}

function Official({ item }: { item: OfficialItem }) {
  return (
    <article className={[s.post, s.official].join(' ')} aria-label={item.title}>
      <div className={s.meta}>
        <span className={s.cat}>{item.kind === 'fed' ? t('news.src.fed') : t('news.src.sec')}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={new Date(item.at).toISOString()}>{formatRelative(item.at)}</time>
        {item.sym && (
          <Link className={s.sym} to={`/markets/${item.sym}`}>
            {item.sym}
          </Link>
        )}
      </div>
      <h2 className={s.postTitle}>{item.title}</h2>
      {item.detail && <p className={s.detail}>{item.detail}</p>}
      <div className={s.postActions}>
        <a className={s.link} href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => reportMission('news', item.id)}>
          {item.kind === 'fed' ? t('news.src.readFed') : t('news.src.readSec')}
          <Icon name="external" size={14} />
        </a>
      </div>
    </article>
  );
}
