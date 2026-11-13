/**
 * The pictures on the invite cards (owner 2026-11-10: redesigned around the Zelos bull vs bear
 * logo). Battle: the bull and the bear face off. Invite a friend: the bull and a friend-to-be still
 * in shadow. Team up and Coaching use the owner's pictures (2026-11-13): the bull and the bear
 * arm-wrestling, and the bull at a rising chart (art/teamup.webp, art/coach.webp). The art fills the picture with even padding all round, so nothing sits
 * against an edge and there are no empty black gaps.
 */
import type { InviteKind } from './invites';
import s from './InviteScene.module.css';

const ART = `${import.meta.env.BASE_URL}art/`;
const Bull = ({ className }: { className?: string }) => <img src={`${ART}bull.webp`} alt="" className={[s.a, className].filter(Boolean).join(' ')} width={313} height={320} loading="lazy" decoding="async" />;
const Bear = ({ className }: { className?: string }) => <img src={`${ART}bear.webp`} alt="" className={[s.a, className].filter(Boolean).join(' ')} width={343} height={320} loading="lazy" decoding="async" />;

export function InviteScene({ kind }: { kind: InviteKind }) {
  return (
    <span className={[s.scene, s[kind]].join(' ')} aria-hidden="true">
      {kind === 'battle' && (
        <>
          <Bull className={s.left} />
          <span className={s.vs}>VS</span>
          <Bear className={s.right} />
        </>
      )}
      {kind === 'squad' && <img src={`${ART}teamup.webp`} alt="" className={[s.a, s.art].join(' ')} width={560} height={466} loading="lazy" decoding="async" />}
      {kind === 'join' && (
        <>
          <Bull className={s.left} />
          <span className={s.plus}>+</span>
          <Bull className={[s.right, s.flip, s.ghost].join(' ')} />
        </>
      )}
      {kind === 'coach' && <img src={`${ART}coach.webp`} alt="" className={[s.a, s.art].join(' ')} width={720} height={476} loading="lazy" decoding="async" />}
    </span>
  );
}
