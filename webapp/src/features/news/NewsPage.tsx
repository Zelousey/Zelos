/**
 * Zelos News: the in-app announcement centre. A featured post on top, category filters,
 * then the feed. Posts newer than your last visit get a "New" badge.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { formatDate } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, buttonClass, Card, EmptyState, Icon, PageHeader } from '../../ui';
import { CATEGORIES, NEWS, readSeen, type NewsCategory, type NewsPost } from './news';
import s from './News.module.css';

const CAT_LABEL: Record<NewsCategory, MessageKey> = {
  updates: 'news.cat.updates',
  announcements: 'news.cat.announcements',
  tradewar: 'news.cat.tradewar',
  events: 'news.cat.events',
  features: 'news.cat.features',
  community: 'news.cat.community',
};

const day = (d: string) => formatDate(`${d}T12:00:00`, { year: true });

export default function NewsPage() {
  // what you'd seen before this visit (the shell marks everything seen once you're here)
  const [seen] = useState(readSeen);
  const [cat, setCat] = useState<NewsCategory | 'all'>('all');
  const used = CATEGORIES.filter((c) => NEWS.some((p) => p.category === c));
  const featured = cat === 'all' ? NEWS.find((p) => p.featured) : undefined;
  const list = NEWS.filter((p) => p !== featured && (cat === 'all' || p.category === cat));
  const isNew = (p: NewsPost) => p.date > seen;

  return (
    <>
      <PageHeader title={t('nav.news')} subtitle={t('news.subtitle')} />
      <div className={s.filters} role="group" aria-label={t('news.filter')}>
        {(['all', ...used] as const).map((c) => (
          <button key={c} type="button" className={s.chip} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c === 'all' ? t('news.all') : t(CAT_LABEL[c])}
          </button>
        ))}
      </div>

      {featured && <Featured post={featured} isNew={isNew(featured)} />}

      {list.length ? (
        <div className={s.feed}>
          {list.map((p) => (
            <Post key={p.id} post={p} isNew={isNew(p)} />
          ))}
        </div>
      ) : (
        !featured && (
          <Card>
            <EmptyState icon="news" body={t('news.empty')} />
          </Card>
        )
      )}
    </>
  );
}

function Meta({ post, isNew, onDark }: { post: NewsPost; isNew: boolean; onDark?: boolean }) {
  return (
    <div className={[s.meta, onDark && s.onDark].filter(Boolean).join(' ')}>
      <span className={s.cat}>{t(CAT_LABEL[post.category])}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={post.date}>{day(post.date)}</time>
      {isNew && <Badge tone="accent">{t('news.new')}</Badge>}
    </div>
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
          {post.link && (
            <Link className={buttonClass({ variant: 'secondary' })} to={post.link.to}>
              {post.link.label}
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
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
        {post.link && (
          <Link className={s.link} to={post.link.to}>
            {post.link.label}
            <Icon name="chevronRight" size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}
