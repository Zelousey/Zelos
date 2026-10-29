/** A private War's settings: name, length, lobby deadline, max players (checked again on the server). */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { Button, Field } from '../../ui';
import { Choices } from '../invites/Choices';
import { DAYS, LOBBY_HOURS, mapSize, PLAYERS, type WarConfig } from './lobby';
import s from './War.module.css';

const DEFAULTS: WarConfig = { name: '', days: 3, lobbyHours: 6, maxPlayers: 4 };

export function WarSettingsForm({ initial, submit, busy, onSubmit }: { initial?: WarConfig; submit: string; busy: boolean; onSubmit: (cfg: WarConfig) => void }) {
  const [cfg, setCfg] = useState<WarConfig>(initial ?? DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<WarConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
    setError(null);
  };
  return (
    <form
      className={s.ticket}
      onSubmit={(e) => {
        e.preventDefault();
        const name = cfg.name.trim().replace(/\s+/g, ' ');
        if (name.length < 2) return setError(t('warl.nameNeeded'));
        onSubmit({ ...cfg, name });
      }}
    >
      <Field label={t('warl.name')} value={cfg.name} maxLength={40} placeholder={t('warl.namePh')} onChange={(e) => set({ name: e.target.value })} error={error ?? undefined} />
      <Choices label={t('warl.days')} value={cfg.days} options={[...DAYS]} onChange={(days) => set({ days })} format={(d) => (d === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: d }))} />
      <Choices label={t('warl.lobbyHours')} value={cfg.lobbyHours} options={[...LOBBY_HOURS]} onChange={(lobbyHours) => set({ lobbyHours })} format={(h) => t('warl.hours', { n: h })} />
      <Choices label={t('warl.maxPlayers')} value={cfg.maxPlayers} options={[...PLAYERS]} onChange={(maxPlayers) => set({ maxPlayers })} format={(n) => String(n)} />
      <p className={s.muted}>{t('warl.mapNote', { n: mapSize(cfg.maxPlayers) })}</p>
      <p className={s.muted}>{t('warl.armies')}</p>
      <Button type="submit" variant="primary" block disabled={busy}>
        {submit}
      </Button>
    </form>
  );
}
