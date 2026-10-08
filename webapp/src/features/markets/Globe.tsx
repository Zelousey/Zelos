/**
 * The live globe: the classic site's self-contained WebGL globe (zelos-globe.js, no
 * libraries), loaded from the same origin so there is one globe in the codebase. It draws
 * the real day/night line and which exchanges are in their regular session right now.
 * If the script or WebGL isn't available (e.g. the native app before it bundles the file),
 * the panel says so and everything around it still works.
 */
import { useEffect, useRef, useState } from 'react';
import { classicUrl } from '../../lib/platform';
import s from './Globe.module.css';

type Ctrl = { destroy: () => void };
type GlobeApi = { mount: (o: Record<string, unknown>) => Ctrl | null };
const win = window as unknown as { ZelosGlobe?: GlobeApi };

let loading: Promise<GlobeApi> | null = null;
function loadGlobe(): Promise<GlobeApi> {
  if (win.ZelosGlobe) return Promise.resolve(win.ZelosGlobe);
  loading ??= new Promise<GlobeApi>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = classicUrl('zelos-globe.js');
    el.async = true;
    el.onload = () => (win.ZelosGlobe ? resolve(win.ZelosGlobe) : reject(new Error('no globe')));
    el.onerror = () => reject(new Error('globe script failed'));
    document.head.appendChild(el);
  }).catch((e) => {
    loading = null; // try again next time the panel mounts
    throw e;
  });
  return loading;
}

export function Globe({ label, height = 360 }: { label: string; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let ctrl: Ctrl | null = null;
    let live = true;
    loadGlobe()
      .then((api) => {
        if (!live || !host.current) return;
        ctrl = api.mount({ el: host.current, style: 'blend', autoRotate: true, enableZoom: false, altitude: 2.2, exchanges: true, arcs: true });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      ctrl?.destroy();
    };
  }, []);
  return (
    <div className={s.wrap} style={{ height }} role="img" aria-label={label}>
      {failed ? <div className={s.fallback}>The globe isn’t available here right now.</div> : <div ref={host} className={s.host} />}
    </div>
  );
}
