'use client';
/**
 * RealtimeContext — WebSocket + periodic /api/latest reconciliation.
 *
 * WS: init, servers:update, events:update, incident:*, diagnosis:new, stats:update
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import BACKEND_URL, { getWsBaseUrl } from '@/lib/config';

const Ctx = createContext(null);
const RECONNECT_MS = 3000;
const POLL_MS = 5000;

export function RealtimeProvider({ children }) {
  const [servers, setServers] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const [latestDiagnosis, setLatestDiagnosis] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const retryTimer = useRef(null);
  const mountedRef = useRef(true);
  const notifId = useRef(0);
  const prevServersRef = useRef([]);

  const pushNotification = useCallback((msg, type = 'info') => {
    const id = ++notifId.current;
    setNotifications((prev) => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5500);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket(getWsBaseUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setWsConnected(true);
      };

      ws.onmessage = ({ data: raw }) => {
        if (!mountedRef.current) return;
        try {
          const { event, data } = JSON.parse(raw);
          switch (event) {
            case 'init':
              if (data.servers) setServers(data.servers);
              if (data.events) setEvents(data.events);
              if (data.stats) setStats(data.stats);
              break;

            case 'servers:update':
              setServers(data || []);
              break;

            case 'events:update':
              if (data) setEvents(data);
              break;

            case 'incident:new':
              setActiveIncident(data);
              setEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)]);
              break;

            case 'incident:update':
              setActiveIncident((prev) => (prev?.id === data.id ? null : prev));
              setEvents((prev) => prev.map((e) => (e.id === data.id ? { ...e, ...data } : e)));
              break;

            case 'stats:update':
              setStats(data);
              break;

            case 'diagnosis:new':
              setLatestDiagnosis(data);
              setTimeline([
                {
                  key: 'detected',
                  label: 'Issue detected',
                  done: true,
                  at: data.created_at || new Date().toISOString(),
                },
                {
                  key: 'ai',
                  label: 'AI analyzed',
                  done: true,
                  at: data.created_at || new Date().toISOString(),
                },
                {
                  key: 'action',
                  label: 'Action executed',
                  done: true,
                  at: data.resolved_at || new Date().toISOString(),
                },
                {
                  key: 'recovery',
                  label: 'Recovery complete',
                  done: true,
                  at: data.resolved_at || new Date().toISOString(),
                },
              ]);
              pushNotification('Recovery pipeline finished', 'success');
              break;

            default:
              break;
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsConnected(false);
        retryTimer.current = setTimeout(connect, RECONNECT_MS);
      };

      ws.onerror = () => ws.close();
    } catch {
      /* ignore */
    }
  }, [pushNotification]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    const prev = prevServersRef.current;
    if (!prev.length) {
      prevServersRef.current = servers;
      return;
    }
    servers.forEach((ns) => {
      const old = prev.find((ps) => ps.id === ns.id);
      if (old && old.status !== ns.status) {
        if (ns.status === 'critical') {
          pushNotification(`CPU spike or errors — ${ns.name}`, 'danger');
        } else if (ns.status === 'recovering') {
          pushNotification(`AI analyzing — ${ns.name}`, 'info');
        } else if (old.status === 'critical' && ns.status === 'healthy') {
          pushNotification(`Recovery successful — ${ns.name}`, 'success');
        }
      }
    });
    prevServersRef.current = servers;
  }, [servers, pushNotification]);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/latest`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.latest_diagnosis) setLatestDiagnosis(j.latest_diagnosis);
        const wsOpen = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
        if (!wsOpen && Array.isArray(j.servers) && j.servers.length) {
          setServers(j.servers);
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const removeServer = useCallback((id) => setServers((prev) => prev.filter((s) => s.id !== id)), []);

  return (
    <Ctx.Provider
      value={{
        servers,
        events,
        stats,
        activeIncident,
        latestDiagnosis,
        timeline,
        notifications,
        pushNotification,
        wsConnected,
        setServers,
        removeServer,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useRealtime = () => useContext(Ctx);
