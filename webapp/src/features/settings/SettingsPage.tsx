/** Settings that live in the app today: theme. Account management still links to My Zelos on the classic site. */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { getTheme, setTheme, THEMES, type Theme } from '../../lib/theme';
import { ButtonLink, Card, Icon, PageHeader, Tabs } from '../../ui';
import s from './SettingsPage.module.css';

const THEME_LABEL = { black: 'settings.theme.black', blue: 'settings.theme.blue', white: 'settings.theme.white' } as const;

export default function SettingsPage() {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <div className={s.stack}>
        <Card title={t('settings.theme')} subtitle={t('settings.theme.help')}>
          <Tabs
            label={t('settings.theme')}
            items={THEMES.map((v) => ({ value: v, label: t(THEME_LABEL[v]) }))}
            value={theme}
            onChange={(v) => {
              setTheme(v);
              setThemeState(v);
            }}
          />
        </Card>
        <Card title={t('settings.account')}>
          <ButtonLink variant="secondary" href={classicUrl('my-zelos.html')}>
            {t('settings.manageAccount')}
            <Icon name="external" size={16} />
          </ButtonLink>
        </Card>
      </div>
    </>
  );
}
