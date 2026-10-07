import { NavLink } from 'react-router';
import { GROUP_LABEL, GROUP_ORDER, moreModules } from '../app/modules';
import { t } from '../lib/i18n';
import { Icon, Sheet } from '../ui';
import s from './Shell.module.css';

/** Phone "More" tab: every module that isn't one of the four tabs, as a grouped list (like the desktop sidebar's groups). */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mods = moreModules();
  return (
    <Sheet open={open} onClose={onClose} title={t('nav.more')} placement="bottom" labelledBy="more-title">
      {GROUP_ORDER.map((g) => {
        const list = mods.filter((m) => m.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className={s.moreGroup}>
            {g !== 'main' && <div className={s.groupLabel}>{t(GROUP_LABEL[g])}</div>}
            <div className={s.moreList}>
              {list.map((m) => (
                <NavLink key={m.id} to={`/${m.path}`} onClick={onClose} className={({ isActive }) => [s.moreItem, isActive && s.active].filter(Boolean).join(' ')}>
                  <Icon name={m.icon} size={22} />
                  <span>{t(m.label)}</span>
                  <Icon name="chevronRight" size={16} className={s.chev} />
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
