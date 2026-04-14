"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--accent-primary)" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="navbar-brand-name">SelfHeal</span>
        <span className="navbar-brand-tag">PLATFORM</span>
      </div>

      <div className="navbar-links">
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
          Overview
        </Link>
        <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link href="/servers" className={`nav-link ${pathname === '/servers' ? 'active' : ''}`}>
          Servers
        </Link>
        <Link href="/history" className={`nav-link ${pathname === '/history' ? 'active' : ''}`}>
          Incident Log
        </Link>
      </div>

      <div className="navbar-right">
        <div className="live-indicator">
          <span className="live-dot"></span>
          LIVE
        </div>
      </div>
    </nav>
  );
}
