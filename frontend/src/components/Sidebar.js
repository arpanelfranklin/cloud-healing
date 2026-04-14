"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',          label: 'Overview',     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard', label: 'Dashboard',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/servers',   label: 'Servers',      icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
  { href: '/history',   label: 'Incident Log', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div className="sidebar-brand-name">SelfHeal</div>
          <div className="sidebar-brand-tag">CLOUD PLATFORM</div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="sidebar-nav">
        <p className="sidebar-section-label">Navigation</p>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`sidebar-link ${active ? 'active' : ''}`}>
              <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon}/>
              </svg>
              {label}
              {active && <span className="sidebar-active-bar" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer status ── */}
      <div className="sidebar-footer">
        <p className="sidebar-section-label">System</p>
        <div className="sidebar-status-row">
          <span className="status-dot dot-success" style={{ width: 7, height: 7 }}></span>
          <span>AI Engine</span>
          <span style={{ marginLeft: 'auto', color: 'var(--success)', fontSize: '0.72rem' }}>Online</span>
        </div>
        <div className="sidebar-status-row">
          <span className="status-dot dot-success" style={{ width: 7, height: 7 }}></span>
          <span>Supabase</span>
          <span style={{ marginLeft: 'auto', color: 'var(--success)', fontSize: '0.72rem' }}>Connected</span>
        </div>
        <div className="sidebar-status-row">
          <span className="live-dot" style={{ width: 7, height: 7 }}></span>
          <span>Live Feed</span>
          <span style={{ marginLeft: 'auto', color: 'var(--success)', fontSize: '0.72rem' }}>Active</span>
        </div>
      </div>
    </aside>
  );
}
