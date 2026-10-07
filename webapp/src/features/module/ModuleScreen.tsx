/**
 * Hand-off screen for a module that hasn't moved into the app yet: explains it and
 * links to the classic page (same account, same data). For 'planned' modules it says
 * the module is coming.
 */
import type { AppModule } from '../../app/modules';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { ButtonLink, Card, EmptyState, Icon, PageHeader } from '../../ui';

export function ModuleScreen({ module }: { module: AppModule }) {
  const name = t(module.label);
  return (
    <>
      <PageHeader title={name} />
      <Card>
        {module.status === 'classic' && module.classicPath ? (
          <EmptyState
            icon={module.icon}
            title={t('module.classic.title', { name })}
            body={t('module.classic.body')}
            actions={
              <ButtonLink variant="primary" size="lg" href={classicUrl(module.classicPath)}>
                {t('module.classic.open', { name })}
                <Icon name="external" size={16} />
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState icon={module.icon} title={t('module.planned.title', { name })} body={t('module.planned.body')} />
        )}
      </Card>
    </>
  );
}
