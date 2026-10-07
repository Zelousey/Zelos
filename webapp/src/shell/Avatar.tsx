import type { User } from 'firebase/auth';
import { Icon } from '../ui';
import s from './Shell.module.css';

/** The signed-in person's photo (Google), else their initial, else a generic icon for guests. */
export function Avatar({ user, size = 32 }: { user: User | null; size?: number }) {
  const real = user && !user.isAnonymous ? user : null;
  const initial = (real?.displayName || real?.email || '').trim().charAt(0).toUpperCase();
  return (
    <span className={s.avatar} style={{ width: size, height: size }}>
      {real?.photoURL ? <img src={real.photoURL} alt="" referrerPolicy="no-referrer" width={size} height={size} /> : initial ? <span>{initial}</span> : <Icon name="profile" size={Math.round(size * 0.6)} />}
    </span>
  );
}
