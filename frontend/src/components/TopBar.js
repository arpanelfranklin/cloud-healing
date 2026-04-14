"use client";
import { usePathname } from 'next/navigation';
import { useRealtime } from '@/context/RealtimeContext';

const TITLES = {
  '/':          { title: 'Overview',      sub: 'Platform summary and quick actions'       },
  '/dashboard': { title: 'Dashboard',     sub: 'Live cluster telemetry and AI diagnostics' },
  '/servers':   { title: 'Servers',       sub: 'Registered nodes and real-time health'    },
  '/history':   { title: 'Incident Log',  sub: 'Historical failures and healing events'   },
};

export default function TopBar() {
  const pathname = usePathname();
  const ctx = useRealtime();
  const wsConnected = ctx?.wsConnected;
  const notifications = ctx?.notifications ?? [];
  const meta = TITLES[pathname] || { title: 'SelfHeal', sub: '' };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{meta.title}</h1>
        {meta.sub && <span className="topbar-sub">{meta.sub}</span>}
      </div>
      <div className="topbar-right">
        {notifications.length > 0 && (
          <div className="topbar-toast-stack" aria-live="polite">
            {notifications.map((n) => (
              <div key={n.id} className={`topbar-toast-item status-toast-${n.type}`}>
                {n.msg}
              </div>
            ))}
          </div>
        )}
        <div
          className={`live-indicator ${wsConnected === false ? 'ws-disconnected' : ''}`}
          title={wsConnected ? 'WebSocket connected' : 'Connecting...'}
        >
          <span className="live-dot" style={{ background: wsConnected === false ? 'var(--warning)' : undefined }} />
          {wsConnected === false ? 'CONNECTING' : 'WS LIVE'}
        </div>
        <div className="topbar-time" suppressHydrationWarning>
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </header>
  );
}
