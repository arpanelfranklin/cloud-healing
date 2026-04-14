"use client";
import { useEffect, useRef, useState } from 'react';
import { useRealtime } from '@/context/RealtimeContext';
import BACKEND_URL from '@/lib/config';
import ServerFleetCard from '@/components/ServerFleetCard';

const PHASES = { HEALTHY: 'healthy', SIMULATING: 'simulating', FAILING: 'failing', RECOVERING: 'recovering' };
const FAILURE_TYPES = [
  { id: 'HIGH_CPU', label: 'High CPU', icon: '🔥' },
  { id: 'HIGH_ERROR_RATE', label: 'Error Surge', icon: '💥' },
  { id: 'MEMORY_LEAK', label: 'Memory Leak', icon: '💾' },
];

function MetricBar({ label, value, unit = '%' }) {
  const num = parseFloat(value) || 0;
  const cls = num > 90 ? 'danger' : num > 70 ? 'warn' : '';
  const color = num > 90 ? 'var(--danger)' : num > 70 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="metric-bar-wrap">
      <div className="metric-bar-header">
        <span className="metric-bar-label">{label}</span>
        <span className="metric-bar-value" style={{ color }}>
          {value}
          {unit}
        </span>
      </div>
      <div className="metric-bar-track">
        <div className={`metric-bar-fill ${cls}`} style={{ width: `${Math.min(num, 100)}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    servers,
    stats,
    activeIncident: wsIncident,
    latestDiagnosis,
    timeline,
    pushNotification,
    wsConnected,
  } = useRealtime() || {};

  const [incident, setIncident] = useState(null);
  const [phase, setPhase] = useState(PHASES.HEALTHY);
  const [visibleLogs, setVisible] = useState([]);
  const [selectedType, setType] = useState('HIGH_CPU');
  const [loading, setLoading] = useState(false);
  const [triggerServerId, setTriggerServerId] = useState('');
  const [triggerType, setTriggerType] = useState('cpu_spike');
  const [tfLoading, setTfLoading] = useState(false);
  const logTimers = useRef([]);

  useEffect(() => {
    if (servers?.length && !triggerServerId) {
      setTriggerServerId(servers[0].id);
    }
  }, [servers, triggerServerId]);

  useEffect(() => {
    if (wsIncident && wsIncident !== incident) {
      setIncident(wsIncident);
      setPhase(PHASES.FAILING);
    } else if (!wsIncident && phase === PHASES.FAILING) {
      setPhase(PHASES.RECOVERING);
      setTimeout(() => setPhase(PHASES.HEALTHY), 3500);
    }
  }, [wsIncident, incident, phase]);

  useEffect(() => {
    logTimers.current.forEach(clearTimeout);
    logTimers.current = [];
    if (!incident?.log_lines) {
      setVisible([]);
      return;
    }
    setVisible([]);
    incident.log_lines.forEach((l, i) => {
      const t = setTimeout(() => setVisible((p) => [...p, l]), i * 700 + 200);
      logTimers.current.push(t);
    });
  }, [incident?.id]);

  const triggerSimulated = async () => {
    if (phase !== PHASES.HEALTHY) return;
    setPhase(PHASES.SIMULATING);
    setLoading(true);
    try {
      await fetch(`${BACKEND_URL}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failureType: selectedType }),
      });
    } catch {
      setPhase(PHASES.HEALTHY);
    }
    setLoading(false);
  };

  const triggerRealFailure = async () => {
    if (!triggerServerId) {
      pushNotification?.('Select a server first', 'warning');
      return;
    }
    setTfLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/trigger-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_id: triggerServerId,
          type: triggerType === 'process_crash' ? 'process_crash' : 'cpu_spike',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      pushNotification?.('Failure command queued — watch metrics', 'info');
    } catch (e) {
      pushNotification?.(String(e.message || e), 'danger');
    }
    setTfLoading(false);
  };

  const healthyCount = servers?.filter((s) => s.status === 'healthy').length ?? 0;
  const criticalCount = servers?.filter((s) => s.status === 'critical').length ?? 0;
  const recoveringCount = servers?.filter((s) => s.status === 'recovering').length ?? 0;
  const avgCpu = servers?.length
    ? Math.round(servers.reduce((acc, srv) => acc + (parseFloat(srv.cpu) || 0), 0) / servers.length)
    : null;

  const anyFleetCritical = (servers || []).some((s) => s.status === 'critical');
  const anyFleetRecovering = (servers || []).some((s) => s.status === 'recovering');
  const isFailing = phase === PHASES.FAILING || phase === PHASES.SIMULATING;
  const diag = incident?.root_cause ? incident : null;
  const getLogClass = (l) =>
    l.includes('[CRIT]') ? 'log-line crit' : l.includes('[ERROR]') ? 'log-line error' : 'log-line warn';

  const fleetBanner = anyFleetCritical
    ? {
        cls: 'failing',
        icon: '🔴',
        title: 'Fleet alert — critical node(s)',
        sub: `${criticalCount} server(s) require attention`,
      }
    : anyFleetRecovering
      ? {
          cls: 'recovering',
          icon: '🧠',
          title: 'Autonomous recovery in progress',
          sub: 'LLM diagnosis and healing pipeline running',
        }
      : {
          cls: 'healthy',
          icon: '✅',
          title: 'All systems operational',
          sub: `${servers?.length ?? 0} registered node(s)`,
        };

  const simBanner = {
    [PHASES.HEALTHY]: fleetBanner,
    [PHASES.SIMULATING]: {
      cls: 'simulating',
      icon: '⏳',
      title: 'Injecting failure scenario',
      sub: 'AI inference running — collecting diagnostics…',
    },
    [PHASES.FAILING]: {
      cls: 'failing',
      icon: '🔴',
      title: `INCIDENT: ${incident?.failure_label ?? 'Critical failure'}`,
      sub: `Affected node: ${incident?.node ?? '—'}`,
    },
    [PHASES.RECOVERING]: {
      cls: 'recovering',
      icon: '🔄',
      title: 'Self-healing protocol active',
      sub: 'Rebalancing replicas and verifying health probes…',
    },
  };

  const banner = isFailing || phase === PHASES.RECOVERING ? simBanner[phase] : fleetBanner;

  const latencySec =
    latestDiagnosis?.latency_ms != null ? (latestDiagnosis.latency_ms / 1000).toFixed(2) : null;

  return (
    <div className="fade-in">
      <div className={`status-banner ${banner.cls}`}>
        <span className="banner-icon">{banner.icon}</span>
        <div>
          <div className="banner-title">{banner.title}</div>
          <div className="banner-sub">{banner.sub}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="live-indicator" title="Live telemetry">
            <span className={`live-dot ${wsConnected === false ? '' : ''}`} />
            LIVE
          </span>
          <span
            className={`badge ${
              anyFleetCritical || isFailing
                ? 'badge-critical'
                : anyFleetRecovering || phase === PHASES.RECOVERING
                  ? 'badge-healing'
                  : 'badge-healthy'
            }`}
          >
            {anyFleetCritical || isFailing
              ? 'Critical'
              : anyFleetRecovering || phase === PHASES.RECOVERING
                ? 'Recovering'
                : 'Healthy'}
          </span>
        </div>
      </div>

      <p className="section-label slide-up">
        Fleet summary{' '}
        <span className="live-indicator" style={{ fontSize: '0.58rem' }}>
          <span className="live-dot" />
          WS
        </span>
      </p>
      <div className="grid-4 slide-up delay-1">
        {[
          { label: 'Total servers', value: servers?.length ?? 0, cls: 'stat-card-accent', color: 'var(--accent)' },
          { label: 'Healthy', value: healthyCount, cls: 'stat-card-success', color: 'var(--success)' },
          {
            label: recoveringCount ? 'Critical / recovering' : 'Critical',
            value: recoveringCount ? `${criticalCount} / ${recoveringCount}` : criticalCount,
            cls: criticalCount > 0 || recoveringCount > 0 ? 'stat-card-danger' : '',
            color:
              criticalCount > 0 || recoveringCount > 0 ? 'var(--danger)' : 'var(--text-secondary)',
          },
          {
            label: 'Avg CPU',
            value: avgCpu !== null ? `${avgCpu}%` : stats?.cpuUsage ?? '—',
            cls: avgCpu > 80 ? 'stat-card-warning' : 'stat-card-success',
            color: avgCpu > 80 ? 'var(--warning)' : 'var(--success)',
          },
        ].map(({ label, value, cls, color }) => (
          <div key={label} className={`card stat-card ${cls}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 slide-up delay-2" style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div className="card-header">Live cluster metrics</div>
          <MetricBar label="CPU usage" value={parseFloat(stats?.cpuUsage) || avgCpu || 0} />
          <MetricBar label="Memory usage" value={parseFloat(stats?.memoryUsage) || 0} />
          <div className="card-divider" />
          <div className="stat-row">
            <span className="stat-row-label">Uptime</span>
            <span className="stat-row-value">{stats?.uptime ?? '—'}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row-label">Heal events</span>
            <span className="stat-row-value text-heal">{stats?.healingEvents ?? '—'}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            AI diagnosis (live) <span className="badge badge-info">Metrics</span>
          </div>
          {latestDiagnosis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Model: <span style={{ color: 'var(--accent)' }}>{latestDiagnosis.model}</span>
                {latencySec != null && (
                  <>
                    {' '}
                    · Generated in <strong>{latencySec}s</strong>
                  </>
                )}
              </p>
              <div>
                <span className="section-label" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  Root cause
                </span>
                <p style={{ lineHeight: 1.65 }}>{latestDiagnosis.root_cause}</p>
              </div>
              <div>
                <span className="section-label" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  Action
                </span>
                <p style={{ color: 'var(--success)', lineHeight: 1.65 }}>
                  {latestDiagnosis.action_label || latestDiagnosis.action}
                  {latestDiagnosis.action_detail ? ` — ${latestDiagnosis.action_detail}` : ''}
                </p>
              </div>
              <div>
                <span className="section-label" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  Confidence
                </span>
                <div className="confidence-wrap">
                  <div className="confidence-meta">
                    <span className="confidence-label">Model confidence</span>
                    <span className="confidence-value">{latestDiagnosis.confidence}%</span>
                  </div>
                  <div className="confidence-track">
                    <div className="confidence-fill" style={{ width: `${latestDiagnosis.confidence}%` }} />
                  </div>
                </div>
              </div>
              <div className="explanation-block">
                <strong>Explanation</strong>
                <p style={{ marginTop: '0.35rem', lineHeight: 1.7 }}>{latestDiagnosis.explanation}</p>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.65 }}>
              When a node crosses CPU &gt; 85% or emits error logs, the backend runs Gemini or OpenAI, stores the
              diagnosis, and streams updates here.
            </p>
          )}
        </div>
      </div>

      {timeline?.length > 0 && (
        <>
          <p className="section-label slide-up">Incident timeline</p>
          <div className="card slide-up" style={{ marginBottom: '1.25rem' }}>
            <div className="timeline-steps">
              {timeline.map((step, i) => (
                <div key={step.key} className="timeline-step">
                  <div className="timeline-dot-wrap">
                    <span className={`timeline-dot ${step.done ? 'done' : ''}`} />
                    {i < timeline.length - 1 && <span className="timeline-line" />}
                  </div>
                  <div>
                    <div className="timeline-label">{step.label}</div>
                    <div className="timeline-time text-mono">
                      {step.at ? new Date(step.at).toLocaleTimeString() : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="section-label slide-up">Registered servers</p>
      {!servers?.length ? (
        <div className="empty-state" style={{ marginBottom: '1.5rem' }}>
          <div className="empty-icon">🖥️</div>
          <p>No servers registered yet. Start the agent on Lightsail.</p>
        </div>
      ) : (
        <div className="grid-server-cards slide-up delay-1" style={{ marginBottom: '1.5rem' }}>
          {servers.map((s, i) => (
            <ServerFleetCard key={s.id} s={s} index={i} linkToDetail />
          ))}
        </div>
      )}

      <div className="grid-2 slide-up delay-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            Failure simulator <span className="badge badge-warning">Sandbox</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.65 }}>
            Inject a synthetic cluster incident and watch the AI panel via WebSocket (demo only).
          </p>
          <div className="failure-type-grid">
            {FAILURE_TYPES.map((ft) => (
              <button
                key={ft.id}
                type="button"
                className={`failure-type-btn ${selectedType === ft.id ? 'selected' : ''}`}
                onClick={() => setType(ft.id)}
                disabled={isFailing}
              >
                <span className="btn-icon">{ft.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.72rem' }}>{ft.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={triggerSimulated}
            disabled={isFailing}
            className={`btn btn-lg ${isFailing ? 'btn-ghost' : 'btn-danger'}`}
            style={{ width: '100%' }}
          >
            {phase === PHASES.SIMULATING
              ? '⏳ Running AI diagnosis…'
              : isFailing
                ? '🔄 Healing in progress…'
                : `⚡ Trigger ${FAILURE_TYPES.find((f) => f.id === selectedType)?.label}`}
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            Real failure trigger <span className="badge badge-critical">Lightsail</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.65 }}>
            Queues a command for the monitoring agent: CPU stress or a safe child crash (stderr).
          </p>
          <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Target server
          </label>
          <select
            className="field-input"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            value={triggerServerId}
            onChange={(e) => setTriggerServerId(e.target.value)}
          >
            {(servers || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
          <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Failure type
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              ['cpu_spike', 'CPU spike'],
              ['process_crash', 'Process crash'],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`btn btn-sm ${triggerType === val ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTriggerType(val)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={triggerRealFailure}
            disabled={tfLoading || !servers?.length}
            className="btn btn-lg btn-danger"
            style={{ width: '100%' }}
          >
            {tfLoading ? '⏳ Queuing…' : '🔥 Trigger real failure'}
          </button>
        </div>
      </div>

      {isFailing && diag && (
        <>
          <p className="section-label slide-up">AI incident analysis (simulated)</p>
          <div className="grid-3 slide-up">
            <div className="card card-danger">
              <div className="card-header" style={{ color: 'var(--danger)' }}>
                {diag.failure_icon} Alert details <span className="badge badge-critical">Investigating</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: '0.5rem' }}>{diag.node}</div>
              <span className="badge badge-critical" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
                {diag.failure_label}
              </span>
              <div className="log-console">
                {visibleLogs.length === 0 && <span className="loading-text">Streaming logs…</span>}
                {visibleLogs.map((l, i) => (
                  <div key={i} className={getLogClass(l)}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div className="card card-warning">
              <div className="card-header" style={{ color: 'var(--warning)' }}>
                🧠 Root cause{' '}
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-tertiary)',
                    textTransform: 'none',
                    letterSpacing: 0,
                  }}
                >
                  via {diag.ai_source}
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', lineHeight: 1.75, marginBottom: '0.875rem' }}>
                {diag.root_cause}
              </p>
              <div className="explanation-block">
                <strong>Why this action?</strong> Cross-referenced failure patterns for the highest-confidence
                remediation.
              </div>
            </div>
            <div className="card card-success">
              <div className="card-header" style={{ color: 'var(--success)' }}>
                ⚡ Remediation <span className="badge badge-healthy">Executing</span>
              </div>
              <p style={{ color: 'var(--success)', lineHeight: 1.75 }}>{diag.action}</p>
              <div className="confidence-wrap">
                <div className="confidence-meta">
                  <span className="confidence-label">AI confidence</span>
                  <span className="confidence-value">{diag.confidence}%</span>
                </div>
                <div className="confidence-track">
                  <div className="confidence-fill" style={{ width: `${diag.confidence}%` }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {phase === PHASES.RECOVERING && !anyFleetRecovering && (
        <div className="card card-healing slide-up" style={{ marginBottom: '1.5rem' }}>
          <div className="recovery-panel">
            <div className="spin" style={{ fontSize: '2rem' }}>
              🔄
            </div>
            <strong style={{ color: 'var(--healing)' }}>Self-healing in progress</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 340 }}>
              Synthetic incident closing — fleet metrics still live.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
