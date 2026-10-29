/**
 * War is hidden until it's all built (owner 2026-10-29): the server decides who may enter (war_open
 * refuses anyone but admins for now) and everyone else gets "Page not found".
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../lib/auth';
import { LoadingState } from '../../ui';
import NotFoundPage from '../notfound/NotFoundPage';
import { openWar } from './war';

export function WarGate({ children }: { children: (uid: string) => ReactNode }) {
  const { user, isReal, ready } = useAuth();
  const uid = ready && user && isReal ? user.uid : null;
  const [access, setAccess] = useState<{ uid: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    openWar()
      .then(() => live && setAccess({ uid, ok: true }))
      .catch(() => live && setAccess({ uid, ok: false }));
    return () => {
      live = false;
    };
  }, [uid]);
  if (!ready || (uid && access?.uid !== uid)) return <LoadingState rows={6} />;
  if (!uid || !access?.ok) return <NotFoundPage />;
  return <>{children(uid)}</>;
}
