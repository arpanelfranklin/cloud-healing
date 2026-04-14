"use client";
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRealtime } from '@/context/RealtimeContext';

import BACKEND_URL from '@/lib/config';

const FAILURE_TYPES = [
  { id: 'HIGH_CPU',        label: 'High CPU',    icon: '🔥', desc: 'Runaway thread pool spike'  },
  { id: 'HIGH_ERROR_RATE', label: 'Error Surge', icon: '💥', desc: 'HTTP 5xx cascade failure'    },
  { id: 'MEMORY_LEAK',     label: 'Memory Leak', icon: '💾', desc: 'OOM kill loop triggered'     },
];

const DEMO_STEPS = [
  { id: 1, label: 'Fleet Connected',   icon: '🌐', sub: 'Servers registered and sending metrics'  },
  { id: 2, label: 'Failure Injected',  icon: '💥', sub: 'Critical threshold crossed'              },
  { id: 3, label: 'AI Diagnosing',     icon: '🧠', sub: 'Root cause analysis in progress'         },
  { id: 4, label: 'Action Dispatched', icon: '⚡', sub: 'Remediation command executing'           },
  { id: 5, label: 'System Recovered',  icon: '✅', sub: 'All nodes back to healthy'               },
];

function ActivityFeed({ events }) {
  if (!events.length) return (
    <div className="activity-empty">
      <span style={{ fontSize: '1.5rem', opacity: 0.25 }}>📭</span>
      <span>Waiting for incidents...</span>
    </div>
  );
  return (
    <div className="activity-feed">
      {events.slice(0, 6).map((e, i) => (
        <div key={e.id || i} className={`activity-item ${i === 0 ? 'activity-item-new' : ''}`}>
          <span className={`activity-dot ${e.type === 'ALERT' ? 'dot-danger' : 'dot-success'}`}
            style={{ width: 7, height: 7, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.node}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.root_cause || e.action || '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span className={`badge ${e.type === 'ALERT' ? 'badge-critical' : 'badge-healing'}`} style={{ fontSize: '0.58rem' }}>
              {e.type}
            </span>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const delay = ms => new Promise(r => setTimeout(r, ms));

export default function Home() {
  const { servers, events, stats } = useRealtime();
  const [selected, setSelected] = useState('HIGH_CPU');
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoMsg,  setDemoMsg]  = useState('');

  const healthy  = servers.filter(s => s.status === 'healthy').length;
  const critical = servers.filter(s => s.status === 'critical').length;

  const runDemo = useCallback(async () => {
    if (demoBusy || !selected) return;
    setDemoBusy(true);
    setDemoStep(1); setDemoMsg('Fleet is connected and healthy...');
    await delay(1500);
    setDemoStep(2); setDemoMsg('Injecting failure scenario...');
    try {
      await fetch(`${BACKEND_URL}/api/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failureType: selected }),
      });
    } catch (_) {}
    setDemoStep(3); setDemoMsg('AI engine analyzing root cause...');
    await delay(4000);
    setDemoStep(4); setDemoMsg('Dispatching remediation action...');
    await delay(2500);
    setDemoStep(5); setDemoMsg('System recovered. All nodes healthy ✅');
    await delay(6000);
    setDemoStep(0); setDemoMsg(''); setDemoBusy(false);
  }, [demoBusy, selected]);

  const selectedMeta = FAILURE_TYPES.find(f => f.id === selected);

  return (
    <div className="fade-in">
      {/* ── Hero Banner ── */}
      <div className="overview-hero slide-up">
        <div className="overview-hero-left">
          <div className="overview-status-orb" data-status={critical > 0 ? 'critical' : 'healthy'} />
          <div>
            <div className="overview-status-label">{critical > 0 ? '⚠ ACTIVE INCIDENT' : '✅ ALL SYSTEMS OPERATIONAL'}</div>
            <div className="overview-status-sub">
              {servers.length} nodes · {healthy} healthy · {critical} critical
              {stats?.uptime && ` · Uptime ${stats.uptime}`}
            </div>
          </div>
        </div>
        <div className="live-indicator"><span className="live-dot" />WS LIVE</div>
      </div>

      {/* ── Stat Tiles ── */}
      <div className="grid-4 slide-up delay-1" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Connected Nodes', val: servers.length, color: 'var(--accent)',   cls: 'stat-card-accent'   },
          { label: 'Healthy',         val: healthy,         color: 'var(--success)',  cls: 'stat-card-success'  },
          { label: 'Critical',        val: critical,        color: critical > 0 ? 'var(--danger)' : undefined, cls: critical > 0 ? 'stat-card-danger' : '' },
          { label: 'Total Incidents', val: events.length,   color: 'var(--healing)', cls: '' },
        ].map(({ label, val, color, cls }) => (
          <div key={label} className={`card stat-card ${cls}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 slide-up delay-2">
        {/* ── Demo Control Panel ── */}
        <div className="card" style={{ borderColor: demoBusy ? 'rgba(239,68,68,0.3)' : undefined }}>
          <div className="card-header">Demo Control Panel <span className="badge badge-warning">Live Mode</span></div>
          <div className="demo-steps">
            {DEMO_STEPS.map(step => {
              const done = demoStep > step.id, active = demoStep === step.id;
              return (
                <div key={step.id} className={`demo-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                  <div className="demo-step-icon">{done ? '✓' : step.icon}</div>
                  <div className="demo-step-body">
                    <div className="demo-step-label">{step.label}</div>
                    {active && <div className="demo-step-sub">{demoMsg || step.sub}</div>}
                  </div>
                  {step.id < DEMO_STEPS.length && <div className="demo-step-line" />}
                </div>
              );
            })}
          </div>
          {!demoBusy && (
            <>
              <div className="failure-type-grid" style={{ marginTop: '1rem' }}>
                {FAILURE_TYPES.map(ft => (
                  <button key={ft.id} className={`failure-type-btn ${selected === ft.id ? 'selected' : ''}`}
                    onClick={() => setSelected(ft.id)}>
                    <span className="btn-icon">{ft.icon}</span>
                    <span>{ft.label}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{ft.desc}</span>
                  </button>
                ))}
              </div>
              <button onClick={runDemo} disabled={demoBusy}
                className="btn btn-danger btn-lg" style={{ width: '100%', marginTop: '0.875rem' }}>
                ⚡ Start Demo — Inject {selectedMeta?.label}
              </button>
            </>
          )}
          {demoBusy && (
            <div className="demo-running">
              <div className="spin" style={{ fontSize: '1.5rem' }}>⚙️</div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--danger)' }}>Demo Running</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{demoMsg}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Live Activity Feed ── */}
        <div className="card">
          <div className="card-header">
            Live Incident Feed
            <span className="live-indicator" style={{ fontSize: '0.6rem' }}><span className="live-dot" />WS</span>
          </div>
          <ActivityFeed events={events} />
          {events.length > 0 && (
            <Link href="/history" className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '0.875rem' }}>
              View All {events.length} Incidents →
            </Link>
          )}
        </div>
      </div>

      {/* ── Quick Nav ── */}
      <div className="grid-3 slide-up delay-3">
        {[
          { href: '/dashboard', icon: '📊', label: 'Dashboard',     sub: 'Live telemetry & AI cards' },
          { href: '/servers',   icon: '🖥️',  label: 'Servers',      sub: `${servers.length} nodes connected` },
          { href: '/history',   icon: '📋',  label: 'Incident Log',  sub: `${events.length} total events` },
        ].map(({ href, icon, label, sub }) => (
          <Link key={href} href={href}>
            <div className="card card-clickable" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: '1rem' }}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
