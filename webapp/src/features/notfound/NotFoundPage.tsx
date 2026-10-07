import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { buttonClass, Card, EmptyState } from '../../ui';

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon="search"
        title={t('notFound.title')}
        body={t('notFound.body')}
        actions={
          <Link className={buttonClass({ variant: 'primary' })} to="/dashboard">
            {t('notFound.home')}
          </Link>
        }
      />
    </Card>
  );
}
