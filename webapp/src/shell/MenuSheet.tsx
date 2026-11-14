import { NavLink } from 'react-router';
import { GROUP_LABEL, GROUP_ORDER, menuModules } from '../app/modules';
import { t } from '../lib/i18n';
import { Icon, Sheet } from '../ui';
import s from './Shell.module.css';

/**
 * The ☰ menu (top-right on phones): every listed module that isn't a tab, grouped like the desktop sidebar.
 * Invite friends comes first, bold and highlighted, so it's found without scrolling (owner, 2026-11-13).
 * The menu is phones only; the desktop sidebar keeps its own Invite placement.
 */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const all = menuModules();
  const invite = all.find((m) => m.id === 'invite');
  const mods = all.filter((m) => m !== invite);
  return (
    <Sheet open={open} onClose={onClose} title={t('nav.menu')} placement="bottom" labelledBy="menu-title">
      {invite && (
        <NavLink to={`/${invite.path}`} onClick={onClose} className={s.menuInvite}>
          <img src={`${import.meta.env.BASE_URL}art/bull.webp`} alt="" width={44} height={44} />
          <span>
            <b>{t('nav.invite')}</b>
            <small>{t('nav.invite.sub')}</small>
          </span>
          <Icon name="chevronRight" size={18} className={s.chev} />
        </NavLink>
      )}
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
