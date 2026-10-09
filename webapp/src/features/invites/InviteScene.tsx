/**
 * Little scenes with the Zelos mascot (the character from the original site) for each kind of
 * invite: two facing off for a Battle, side by side to Team up, the mascot and a friend-to-be
 * for Invite a friend, a big one and a small one for Coaching. The second character is the same
 * art in another colour.
 */
import type { InviteKind } from './invites';
import s from './InviteScene.module.css';

const MASCOT = `${import.meta.env.BASE_URL}art/mascot.png`;
const Mascot = ({ className }: { className?: string }) => <img src={MASCOT} alt="" className={[s.m, className].filter(Boolean).join(' ')} width={208} height={340} loading="lazy" decoding="async" />;

export function InviteScene({ kind }: { kind: InviteKind }) {
  return (
    <span className={[s.scene, s[kind]].join(' ')} aria-hidden="true">
      {kind === 'battle' && (
        <>
          <Mascot className={s.left} />
          <span className={s.vs}>VS</span>
          <Mascot className={[s.right, s.flip, s.red].join(' ')} />
        </>
      )}
      {kind === 'squad' && (
        <>
          <Mascot className={[s.pairA, s.blue].join(' ')} />
          <Mascot className={[s.pairB, s.flip].join(' ')} />
          <span className={s.badge}>🤝</span>
        </>
      )}
      {kind === 'join' && (
        <>
          <Mascot className={s.left} />
          <span className={s.plus}>+</span>
          <Mascot className={[s.right, s.flip, s.ghost].join(' ')} />
        </>
      )}
      {kind === 'coach' && (
        <>
          <Mascot className={[s.big, s.violet].join(' ')} />
          <span className={s.bubble}>📈</span>
          <Mascot className={[s.small, s.flip].join(' ')} />
        </>
      )}
    </span>
  );
}
