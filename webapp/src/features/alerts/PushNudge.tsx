/**
 * "Get trade alerts on this phone" (owner 2026-11-14: buys, option moves and closed trades should
 * be real phone notifications, even with Zelos closed). Shown on the Dashboard while this device
 * isn't set up: one tap turns them on; on an iPhone it explains Add to Home Screen first, because
 * iPhones only allow web notifications for apps opened from the Home Screen (iOS 16.4 and later).
 * "Not now" hides it for 14 days on this device.
 */
import { useState } from 'react';
import { errorText } from '../invites/invites';
import { t } from '../../lib/i18n';
import { isNative } from '../../lib/platform';
import { readString, writeString } from '../../lib/storage';
import { Button, Card, useToast } from '../../ui';
import { currentPushState, enablePush, type PushState } from './push';
import s from './Alerts.module.css';

const LATER = 'zelosPushNudgeAt';

export function PushNudge({ uid }: { uid: string }) {
  const toast = useToast();
  const [state, setState] = useState<PushState>(() => (isNative() ? 'unsupported' : currentPushState()));
  const [hidden, setHidden] = useState(() => Date.now() - Number(readString(LATER) ?? 0) < 14 * 864e5);
  const [busy, setBusy] = useState(false);
  if (hidden || (state !== 'off' && state !== 'ios-home')) return null;
  const later = () => {
    writeString(LATER, String(Date.now()));
    setHidden(true);
  };
  return (
    <Card title={t('pnn.title')} subtitle={t('pnn.sub')}>
      <p className={s.muted}>{t(state === 'ios-home' ? 'pnn.ios' : 'pnn.body')}</p>
      <div className={s.nudgeActions}>
        {state === 'off' && (
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              enablePush(uid)
                .then(() => toast.show(t('pnn.done'), 'success'))
                .catch((e) => toast.show(errorText(e, t('pn.err.generic')), 'error'))
                .finally(() => {
                  setBusy(false);
                  setState(currentPushState());
                });
            }}
          >
            {t('pnn.turnOn')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={later}>
          {t('pnn.later')}
        </Button>
      </div>
    </Card>
  );
}
