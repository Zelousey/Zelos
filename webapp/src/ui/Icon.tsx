/**
 * The app's icon set: 24px line icons, drawn to match the classic site's tab bar.
 * One component, one path table, so icons stay consistent. Decorative by default
 * (aria-hidden); pass `label` when an icon is the only content of a control.
 */
const PATHS = {
  dashboard: '<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v11h5v-6h3v6h5V9"/>',
  markets: '<path d="M3.5 3.5v17h17"/><path d="M7.5 15l4-4.5 3 3 6-7"/><path d="M16.5 6.5h4v4"/>',
  chart: '<path d="M3 17l5-5 4 3 7-8"/><path d="M15 7h4v4"/>',
  practice: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.8 9.4c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2s1 1.7 2.8 2.1 2.9 1 2.9 2.2-1.3 2.1-2.9 2.1c-1.3 0-2.4-.6-2.9-1.5"/>',
  war: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  options: '<path d="M4 18c4 0 5-12 8-12s4 12 8 12"/><path d="M3 18h18"/>',
  crypto: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 8h4a2 2 0 0 1 0 4h-4m0 0h4.5a2 2 0 0 1 0 4h-4.5M9.5 8v8M11 6.5V8M11 16v1.5"/>',
  alerts: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  social: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  invite: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
  share: '<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  missions: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>',
  arcade: '<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  signal: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  news: '<path d="M4 5.5h12.5V19H6a2 2 0 0 1-2-2z"/><path d="M16.5 9H20v8a2 2 0 0 1-2 2h-1.5"/><path d="M7.5 9h5.5M7.5 12.5h5.5M7.5 16h3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  alertTriangle: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
  wifiOff: '<path d="M2 8.5a15 15 0 0 1 5-2.8M10.5 5a15 15 0 0 1 11.5 3.5M5 12a10 10 0 0 1 4-2M14.5 9.7A10 10 0 0 1 19 12M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: (label ? `<title>${label.replace(/[<&>]/g, '')}</title>` : '') + PATHS[name] }}
    />
  );
}
