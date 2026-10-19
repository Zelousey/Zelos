/**
 * The battle form's buy-in (with the level locks) and game settings: Classic or Last Man
 * Standing (and its elimination rules), plus the game options (draft, Whale vs Minnow,
 * Volatility Storms, Bounty Board, stop-loss / take-profit). Used by the invite page and
 * the challenge sheet; the server checks all of it again.
 */
import { useId, useState } from 'react';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Choices } from '../invites/Choices';
import { BUY_INS } from '../invites/invites';
import { buyInLock, BUYIN_TIERS, cutOptions, DRAFT_PICKS, LMS_KEYS, LMS_OPTS, optionsOn, WHALE_CAPS, WHALE_SHIELDS, type LmsKey, type Settings } from './settings';
import s from './BattleSettings.module.css';

const money = (v: number) => formatMoney(v, { digits: 0 });
const MODES: Settings['mode'][] = ['classic', 'lms'];
const STORMS: Settings['storms'][] = ['', 'rare', 'often'];

/** Buy-in chips; the ones your level hasn't unlocked are locked (xp null = still loading). */
export function BuyInChoices({ value, onChange, xp }: { value: number; onChange: (v: number) => void; xp: number | null }) {
  const locked = xp == null ? [] : BUYIN_TIERS.filter(([, , need]) => xp < need);
  return (
    <div className={s.group}>
      <Choices label={t('inv.battle.buyIn')} value={value} options={BUY_INS} onChange={onChange} format={money} locked={(b) => xp != null && !!buyInLock(b, xp)} />
      {xp != null && locked.length > 0 && (
        <p className={s.note}>
          {locked.map(([cap, level, need, name]) => t('bs.lockAt', { buyIn: money(cap), level, name, xp: need.toLocaleString('en-US') })).join(' ')} {t('bs.youHave', { xp: xp.toLocaleString('en-US') })}
        </p>
      )}
    </div>
  );
}

function Pick<T extends number | string>({ label, value, options, onChange, format }: { label: string; value: T; options: T[]; onChange: (v: T) => void; format: (v: T) => string }) {
  const id = useId();
  return (
    <div className={s.select}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x) === e.target.value);
          if (o !== undefined) onChange(o);
        }}
      >
        {options.map((o) => (
          <option key={o} value={String(o)}>
            {format(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

const LMS_LABEL: Record<LmsKey, (n: number) => string> = {
  floorPct: (n) => t('bs.lms.floorOpt', { n }),
  maxLossPct: (n) => t('bs.lms.bigLossOpt', { n }),
  maxLosses: (n) => t('bs.lms.lossesOpt', { n }),
  cutHours: (n) => t('bs.lms.cutOpt', { n }),
};

/**
 * simple (beginners): show "Quick battle" (classic rules, no extras) with a button to open
 * every game mode, so the first battle has nothing to figure out.
 */
export function BattleSettings({ value, onChange, days, simple = false }: { value: Settings; onChange: (v: Settings) => void; days: number; simple?: boolean }) {
  const [more, setMore] = useState(false);
  const open = !simple || more;
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  const on = optionsOn(value);
  if (!open)
    return (
      <div className={s.quick}>
        <b>{t('bs.quickTitle')}</b>
        <span>{t('bs.quickBody')}</span>
        <button type="button" className={s.quickMore} onClick={() => setMore(true)}>
          {t('bs.quickMore')}
        </button>
      </div>
    );
  return (
    <>
      <Choices label={t('bs.mode')} value={value.mode} options={MODES} onChange={(mode) => set({ mode })} format={(m) => t(m === 'lms' ? 'bs.mode.lms' : 'bs.mode.classic')} />
      {value.mode === 'lms' && (
        <fieldset className={s.lms}>
          <legend>{t('bs.lms.title')}</legend>
          <p className={s.note}>{t('bs.lms.body')}</p>
          <div className={s.grid}>
            {LMS_KEYS.map((k) => (
              <Pick
                key={k}
                label={t(`bs.lms.${k}`)}
                value={value.lms[k]}
                options={[0, ...(k === 'cutHours' ? cutOptions(days) : LMS_OPTS[k])]}
                onChange={(n) => set({ lms: { ...value.lms, [k]: n } })}
                format={(n) => (n ? LMS_LABEL[k](n) : t('bs.off'))}
              />
            ))}
          </div>
        </fieldset>
      )}
      <details className={s.more}>
        <summary>
          {t('bs.options')} <small>{on ? t('bs.optionsOn', { n: on }) : t('bs.optionsHint')}</small>
        </summary>
        <div className={s.grid}>
          <Pick label={t('bs.draft')} value={value.draftPicks} options={[0, ...DRAFT_PICKS]} onChange={(draftPicks) => set({ draftPicks })} format={(n) => (n ? t('bs.draftOpt', { n }) : t('bs.off'))} />
          <Pick label={t('bs.storms')} value={value.storms} options={STORMS} onChange={(storms) => set({ storms })} format={(v) => (v ? t(`bs.storms.${v}`) : t('bs.off'))} />
          <Pick label={t('bs.whale')} value={value.whaleCap} options={[0, ...WHALE_CAPS]} onChange={(whaleCap) => set({ whaleCap })} format={(n) => (n ? t('bs.whaleOpt', { n }) : t('bs.off'))} />
          {value.whaleCap > 0 && <Pick label={t('bs.shields')} value={value.whaleShields} options={WHALE_SHIELDS} onChange={(whaleShields) => set({ whaleShields })} format={(n) => t('bs.shieldsOpt', { n })} />}
        </div>
        <label className={s.check}>
          <input type="checkbox" checked={value.bounties} onChange={(e) => set({ bounties: e.target.checked })} /> {t('bs.bounties')}
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={value.stops} onChange={(e) => set({ stops: e.target.checked })} /> {t('bs.stops')}
        </label>
        <p className={s.note}>{t('bs.optionsNote')}</p>
      </details>
    </>
  );
}
