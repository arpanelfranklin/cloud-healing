'use strict';

const { supabase, isSupabaseReady } = require('./supabase');
const { getMemLatestDiagnosis } = require('./liveState');

const STALE_MS = 30_000;

function withOnlineStatus(server) {
  const age = Date.now() - new Date(server.last_seen).getTime();
  if (age > STALE_MS && server.status !== 'critical') {
    return { ...server, status: 'offline' };
  }
  return server;
}

async function fetchServersSnapshot() {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase
    .from('servers')
    .select('*')
    .order('last_seen', { ascending: false });
  if (error) return [];
  return (data || []).map(withOnlineStatus);
}

async function fetchLatestAiDiagnosis(serverId) {
  if (!isSupabaseReady()) return getMemLatestDiagnosis();
  let q = supabase.from('ai_diagnoses').select('*').order('created_at', { ascending: false }).limit(1);
  if (serverId) q = q.eq('server_id', serverId);
  const { data, error } = await q;
  if (error || !data?.length) return null;
  return data[0];
}

/**
 * @param {string} [serverId] - optional filter for latest diagnosis
 * @param {() => any | null} [getSimulatedIncident] - active sandbox incident
 */
async function getDashboardSnapshot(serverId, getSimulatedIncident) {
  const [servers, latest_diagnosis] = await Promise.all([
    fetchServersSnapshot(),
    fetchLatestAiDiagnosis(serverId || null),
  ]);
  return {
    servers,
    latest_diagnosis,
    simulated_incident: typeof getSimulatedIncident === 'function' ? getSimulatedIncident() : null,
  };
}

module.exports = { getDashboardSnapshot, fetchServersSnapshot, fetchLatestAiDiagnosis, withOnlineStatus };
