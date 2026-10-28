/** The "Back to your lesson" button on other screens (see learnReturn.ts). Never inside Trading 101. */
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { t } from '../../lib/i18n';
import { Icon } from '../../ui';
import { clearLearnPlace, readLearnPlace } from './learnReturn';
import s from './LearnReturn.module.css';

export function LearnReturn() {
  const { pathname } = useLocation();
  const inLearn = /^\/(learn|quiz)(\/|$)/.test(pathname);
  const [hidden, setHidden] = useState(0); // bumps when you close it
  // read on every screen change (it's one sessionStorage read); `hidden` re-reads after closing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const place = useMemo(() => (inLearn ? null : readLearnPlace()), [inLearn, pathname, hidden]);
  if (!place) return null;
  return (
    <div className={s.pill} role="region" aria-label={t('ln.return.label')} data-testid="learn-return">
      <Link className={s.go} to={place.path} onClick={() => clearLearnPlace()}>
        <Icon name="back" size={16} /> <span>{t('ln.return.go', { title: place.title })}</span>
      </Link>
      <button
        type="button"
        className={s.close}
        aria-label={t('ln.return.close')}
        onClick={() => {
          clearLearnPlace();
          setHidden((n) => n + 1);
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
