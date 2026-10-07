import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Button, Icon, Sheet, useToast } from '../ui';
import { Avatar } from './Avatar';
import s from './Shell.module.css';

/** Account menu: who you are, quick links, sign in / out. */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isReal, signInWithGoogle, signOut } = useAuth();
  const toast = useToast();
  return (
    <Sheet open={open} onClose={onClose} title={t('nav.profile')} labelledBy="profile-title">
      <div className={s.profileHead}>
        <Avatar user={user} size={48} />
        <div>
          <div className={s.profileName}>{isReal ? user?.displayName || user?.email : t('auth.guest')}</div>
          {isReal && user?.email && <div className={s.profileSub}>{user.email}</div>}
        </div>
      </div>
      <nav className={s.sheetList} aria-label={t('nav.group.account')}>
        <Link to="/profile" onClick={onClose} className={s.sheetItem}>
          <Icon name="profile" /> {t('nav.profile')} <Icon name="chevronRight" size={16} className={s.chev} />
        </Link>
        <Link to="/settings" onClick={onClose} className={s.sheetItem}>
          <Icon name="settings" /> {t('nav.settings')} <Icon name="chevronRight" size={16} className={s.chev} />
        </Link>
      </nav>
      <div className={s.sheetFoot}>
        {isReal ? (
          <Button variant="secondary" block size="lg" onClick={() => signOut().then(onClose)}>
            {t('auth.signOut')}
          </Button>
        ) : (
          <Button
            variant="primary"
            block
            size="lg"
            onClick={() =>
              signInWithGoogle()
                .then(onClose)
                .catch(() => toast.show(t('auth.signInFailed'), 'error'))
            }
          >
            {t('auth.signInWithGoogle')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
