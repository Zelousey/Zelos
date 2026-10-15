/** "Notifications on this device": turn pop-up notifications on or off for this phone or computer. */
import { useEffect, useState } from 'react';
import { errorText } from '../invites/invites';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, Card, useToast } from '../../ui';
import { currentPushState, disablePush, enablePush, onForegroundPush, refreshPush, testPush, type PushState } from './push';
import s from './Alerts.module.css';

const TEXT: Record<PushState, [MessageKey, MessageKey]> = {
  on: ['pn.on', 'pn.on.hint'],
  off: ['pn.off', 'pn.off.hint'],
  blocked: ['pn.blocked', 'pn.blocked.hint'],
  unsupported: ['pn.unsupported', 'pn.unsupported.hint'],
  'ios-home': ['pn.ios', 'pn.ios.hint'],
};
const FAIL: Record<string, MessageKey> = { blocked: 'pn.err.blocked', notAllowed: 'pn.err.notAllowed', noToken: 'pn.err.noToken' };

export function PushDevice({ uid }: { uid: string }) {
  const toast = useToast();
  const [state, setState] = useState<PushState>(currentPushState);
  const [busy, setBusy] = useState(false);
  const [title, hint] = TEXT[state];
  async function run(fn: () => Promise<string>) {
    setBusy(true);
    try {
      toast.show(await fn());
    } catch (e) {
      const key = e instanceof Error ? FAIL[e.message] : undefined;
      toast.show(key ? t(key) : errorText(e, t('pn.err.generic')), 'error');
    } finally {
      setState(currentPushState());
      setBusy(false);
    }
  }
  return (
    <Card title={t('pn.title')} aria-label={t('pn.title')}>
      <div className={s.device}>
        <p>
          <b>{t(title)}</b>
          <small>{t(hint)}</small>
        </p>
        {state === 'off' && (
          <Button variant="primary" disabled={busy} onClick={() => void run(() => enablePush(uid).then(() => t('pn.done.on')))}>
            {t('pn.turnOn')}
          </Button>
        )}
        {state === 'on' && (
          <span className={s.deviceActions}>
            <Button variant="secondary" disabled={busy} onClick={() => void run(() => testPush().then((n) => (n ? t('pn.done.test') : t('pn.done.testNone'))))}>
              {t('pn.test')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void run(() => disablePush().then(() => t('pn.done.off')))}>
              {t('pn.turnOff')}
            </Button>
          </span>
        )}
      </div>
    </Card>
  );
}

/**
 * Mounted once in the app shell: keeps this device's notification token fresh and, while the
 * app is open, shows arriving notifications as a toast instead of a system pop-up.
 */
export function PushKeeper({ uid }: { uid: string | null }) {
  const toast = useToast();
  useEffect(() => {
    if (!uid) return;
    let stop: (() => void) | undefined;
    let gone = false;
    void refreshPush(uid).then((ok) => {
      if (ok && !gone)
        void onForegroundPush((title, body) => toast.show(body ? `${title}: ${body}` : title)).then((off) => {
          if (gone) off();
          else stop = off;
        });
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [uid, toast]);
  return null;
}
