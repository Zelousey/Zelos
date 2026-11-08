/** Settings: theme, candle colours, your account (profile, notifications, tokens), the Privacy Policy and Terms, and deleting your account. */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { PRIVACY_URL, TERMS_URL } from '../../lib/platform';
import { Link } from 'react-router';
import { getTheme, setTheme, THEMES, type Theme } from '../../lib/theme';
import { Card, Icon, PageHeader, Tabs } from '../../ui';
import { ChartColors } from './ChartColors';
import { DeleteAccount } from './DeleteAccount';
import { BlockedList } from '../safety/BlockedList';
import s from './SettingsPage.module.css';

const THEME_LABEL = { black: 'settings.theme.black', blue: 'settings.theme.blue', white: 'settings.theme.white' } as const;

export default function SettingsPage() {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <div className={s.grid}>
        <div className={s.col}>
          <Card group title={t('settings.appearance')} className={s.o2}>
            <div className={s.row}>
              <div>
                <div className={s.rowLabel}>{t('settings.theme')}</div>
                <div className={s.note}>{t('settings.theme.help')}</div>
              </div>
              <Tabs
                label={t('settings.theme')}
                items={THEMES.map((v) => ({ value: v, label: t(THEME_LABEL[v]) }))}
                value={theme}
                onChange={(v) => {
                  setTheme(v);
                  setThemeState(v);
                }}
              />
            </div>
            <div className={s.sub}>
              <div className={s.rowLabel}>{t('settings.candles')}</div>
              <div className={s.note}>{t('settings.candles.help')}</div>
            </div>
            <ChartColors />
          </Card>
          <div className={s.o4}>
            <BlockedList />
          </div>
        </div>
        <div className={s.col}>
          <Card group title={t('settings.account')} flush className={s.o1}>
            <ul className={s.links}>
              <li>
                <Link to="/profile">
                  {t('settings.profile')} <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/alerts?tab=notify">
                  {t('settings.notifications')} <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/tokens">
                  {t('settings.tokens')} <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/help">
                  {t('nav.help')} <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            </ul>
          </Card>
          <Card group title={t('settings.legal')} flush className={s.o3}>
            <ul className={s.links}>
              <li>
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                  {t('settings.privacy')} <Icon name="external" size={16} />
                </a>
              </li>
              <li>
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                  {t('settings.terms')} <Icon name="external" size={16} />
                </a>
              </li>
            </ul>
            <p className={s.legalNote}>{t('settings.legalNote')}</p>
          </Card>
          <div className={s.o5}>
            <DeleteAccount />
          </div>
        </div>
      </div>
    </>
  );
}
