'use strict';
/**
 * lib/ws.js — WebSocket server hub
 *
 * Single source of truth for all real-time broadcasts.
 * Attach to the HTTP server via init(httpServer).
 *
 * Events emitted to clients:
 *   init            → initial data snapshot on connection
 *   servers:update  → whenever server list/status changes
 *   incident:new    → a new incident was created
 *   incident:update → an incident was updated (e.g. resolved)
 *   stats:update    → aggregate stats changed
 *   diagnosis:new   → latest metrics-based LLM diagnosis (payload for dashboard)
 */

const { WebSocketServer, WebSocket } = require('ws');
const { supabase, isSupabaseReady }  = require('./supabase');

const STALE_MS         = 30_000;  // 30s without a heartbeat → offline
const STALE_CHECK_MS   = 12_000;  // run stale check every 12s

let wss = null;

// ── Status helpers ────────────────────────────────────────────────────────
function withOnlineStatus(server) {
  const age = Date.now() - new Date(server.last_seen).getTime();
  if (age > STALE_MS && server.status !== 'critical') {
    return { ...server, status: 'offline' };
  }
  return server;
}

// ── Supabase fetchers ─────────────────────────────────────────────────────
async function fetchServers() {
  if (!isSupabaseReady()) return [];
  const { data } = await supabase
    .from('servers')
    .select('*')
    .order('last_seen', { ascending: false });
  return (data || []).map(withOnlineStatus);
}

async function fetchEvents() {
  if (!isSupabaseReady()) return [];
  const { data } = await supabase
    .from('incidents')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);
  return data || [];
}

async function fetchStats() {
  if (!isSupabaseReady()) return null;
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('type', 'HEALING');
  return { healingEvents: data?.length || 0 };
}

// ── Send to one client ────────────────────────────────────────────────────
function sendTo(ws, event, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data, ts: Date.now() }));
  }
}

// ── Broadcast to all connected clients ───────────────────────────────────
function broadcast(event, data) {
  if (!wss) return;
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ── Convenience: pull fresh server list and broadcast ────────────────────
async function broadcastServers() {
  try {
    broadcast('servers:update', await fetchServers());
  } catch (_) {}
}

// ── Convenience: pull fresh incident list and broadcast ──────────────────
async function broadcastEvents() {
  try {
    broadcast('events:update', await fetchEvents());
  } catch (_) {}
}

// ── Send full snapshot to a newly connected client ───────────────────────
async function sendSnapshot(ws) {
  try {
    const [servers, events, stats] = await Promise.all([
      fetchServers(), fetchEvents(), fetchStats(),
    ]);
    sendTo(ws, 'init', { servers, events, stats });
  } catch (_) {}
}

// ── Initialize ────────────────────────────────────────────────────────────
function init(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log(`[WS] Client connected  — active: ${wss.clients.size}`);
    sendSnapshot(ws);                               // immediate data on connect
    ws.on('close', () =>
      console.log(`[WS] Client disconnected — active: ${wss.clients.size}`)
    );
    ws.on('error', () => {});
  });

  // Periodic stale-server check — only broadcasts if something changed
  let prevStatuses = {};
  setInterval(async () => {
    if (!wss.clients.size || !isSupabaseReady()) return;
    try {
      const servers = await fetchServers();
      const changed = servers.some(s => prevStatuses[s.id] !== s.status);
      if (changed) {
        broadcast('servers:update', servers);
        servers.forEach(s => { prevStatuses[s.id] = s.status; });
      }
    } catch (_) {}
  }, STALE_CHECK_MS);

  console.log('[WS] WebSocket hub ready on same port as HTTP');
  return wss;
}

module.exports = { init, broadcast, broadcastServers, broadcastEvents };
