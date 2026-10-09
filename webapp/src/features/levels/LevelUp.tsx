/**
 * The level-up celebration (the website's ZelosLevels.celebrate): when your XP reaches a new
 * level, the new badge pops in with its frame, light rays and confetti. Shown once per level;
 * the "already celebrated" level is shared with the website (localStorage zelosLevelCelebrated),
 * so you don't see it twice. A first visit only records your level.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { levelFor, type Level } from '../../data/levels';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { lsGet, lsSet } from '../welcome/welcome';
import { LevelBadge, tierOf } from './LevelBadge';
import s from './Levels.module.css';

const SEEN_KEY = 'zelosLevelCelebrated';

/** Which level (if any) to celebrate for this XP; records the level either way. */
export function levelToCelebrate(xp: number, seenRaw: string | null): Level | null {
  const lv = levelFor(xp).level;
  if (seenRaw == null) return null; // first time on this device: nothing to compare with
  const seen = parseInt(seenRaw, 10) || 0;
  return lv.level >= 1 && lv.level > seen ? lv : null;
}

export function LevelUpWatcher() {
  const { user, isReal } = useAuth();
  const doc = useUserDoc(isReal && user ? user.uid : null);
  const xp = doc.status === 'ready' ? doc.data.xp : null;
  const [show, setShow] = useState<{ lv: Level; xp: number } | null>(null);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (xp == null) return;
    const lv = levelFor(xp).level;
    const seen = lsGet(SEEN_KEY);
    const next = levelToCelebrate(xp, seen);
    if (seen == null || lv.level > (parseInt(seen, 10) || 0)) lsSet(SEEN_KEY, String(lv.level));
    if (next && last.current !== next.level) {
      last.current = next.level;
      setShow({ lv: next, xp });
    }
  }, [xp]);
  return show ? <LevelUp lv={show.lv} xp={show.xp} onClose={() => setShow(null)} /> : null;
}

export function LevelUp({ lv, xp, onClose }: { lv: Level; xp: number; onClose: () => void }) {
  const [c0, , c2] = lv.colors;
  const card = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    btn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const timer = setTimeout(onClose, 9000);
    const stop = card.current ? confetti(card.current, [c0, c2]) : undefined;
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
      stop?.();
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose, c0, c2]);
  const newFrame = lv.level > 1 && tierOf(lv.level) !== tierOf(lv.level - 1);
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={t('lvl.aria', { name: lv.name })} style={{ '--c0': c0, '--c2': c2, '--glow': `${c0}88` } as CSSProperties} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.card} ref={card}>
        <div className={s.rays} aria-hidden="true" />
        <div className={s.badgeWrap}>
          <LevelBadge level={lv} size={132} />
        </div>
        <div className={s.kicker}>{t('lvl.up')}</div>
        <div className={s.title}>{t('lvl.title', { n: lv.level, name: lv.name })}</div>
        <div className={s.sub}>{lv.title}</div>
        <div className={s.xp}>{t('lvl.xp', { n: xp.toLocaleString('en-US') })}</div>
        <div className={s.chips}>
          {newFrame && <span className={s.chip}>{t('lvl.newFrame')}</span>}
          <span className={s.chip}>{t('lvl.newBadge')}</span>
        </div>
        <div className={s.btns}>
          <button ref={btn} type="button" className={s.btn} onClick={onClose}>
            {t('lvl.nice')}
          </button>
          <Link className={s.btn2} to="/missions" onClick={onClose}>
            {t('nav.missions')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function confetti(host: HTMLElement, colors: string[]): () => void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
  const cv = document.createElement('canvas');
  cv.className = s.confetti!;
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = host.clientWidth;
  const H = host.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  if (!ctx) return () => cv.remove();
  ctx.scale(dpr, dpr);
  const pal = [...colors, '#3ecb7c', '#4a86ff'];
  const parts = Array.from({ length: 90 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 6;
    return { x: W / 2, y: 110, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 2 + Math.random() * 3, c: pal[i % pal.length]!, rot: Math.random() * 6, vr: Math.random() * 0.3 - 0.15 };
  });
  const t0 = performance.now();
  let raf = 0;
  const frame = (tm: number) => {
    const dt = tm - t0;
    if (dt > 2600) return cv.remove();
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.18;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - dt / 2600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    cv.remove();
  };
}
