import { NavLink } from 'react-router';
import { GROUP_LABEL, GROUP_ORDER, menuModules } from '../app/modules';
import { t } from '../lib/i18n';
import { Icon, Sheet } from '../ui';
import s from './Shell.module.css';

/** The ☰ menu (top-right on phones): every listed module that isn't a tab, grouped like the desktop sidebar. */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mods = menuModules();
  return (
    <Sheet open={open} onClose={onClose} title={t('nav.menu')} placement="bottom" labelledBy="menu-title">
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
