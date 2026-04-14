const { Router } = require('express');
const { supabase } = require('../lib/supabase');
const { getAIReasoning } = require('../lib/ai');
const FAILURE_TYPES = require('../config/failureTypes');
const { broadcast, broadcastServers, broadcastEvents } = require('../lib/ws');
const { getDashboardSnapshot } = require('../lib/dashboardSnapshot');

const router = Router();

// Active incident held in-memory (single node for now)
let activeIncident = null;

// GET /api/failure-types — expose available failure scenarios to the UI
router.get('/failure-types', (req, res) => {
  res.json(Object.values(FAILURE_TYPES).map(({ id, label, icon }) => ({ id, label, icon })));
});

// POST /api/simulate — Inject a failure, run AI inference, persist to Supabase
router.post('/simulate', async (req, res) => {
  if (activeIncident) {
    return res.status(400).json({ error: 'An incident is already active. Wait for recovery.' });
  }

  const nodes = ['us-east-1a-app-1', 'us-west-2b-db-1', 'eu-central-1-worker-pool', 'ap-south-1a-cache-2'];
  const failureKeys = Object.keys(FAILURE_TYPES);
  const failureType =
    req.body?.failureType && FAILURE_TYPES[req.body.failureType]
      ? req.body.failureType
      : failureKeys[Math.floor(Math.random() * failureKeys.length)];

  const node = nodes[Math.floor(Math.random() * nodes.length)];
  const failure = FAILURE_TYPES[failureType];
  const diagnosis = await getAIReasoning(node, failureType);

  // Persist to Supabase
  const { data, error } = await supabase
    .from('incidents')
    .insert([{
      node,
      type: 'ALERT',
      status: 'investigating',
      root_cause: diagnosis.root_cause,
      action: diagnosis.action,
      confidence: diagnosis.confidence,
    }])
    .select();

  if (error) console.error('[Supabase] incident insert error:', JSON.stringify(error));
  const incidentId = !error && data?.[0]?.id ? data[0].id : null;

  const newIncident = {
    id: incidentId || `local-${Date.now()}`,
    node,
    type: 'ALERT',
    status: 'investigating',
    failure_type: failureType,
    failure_label: failure.label,
    failure_icon: failure.icon,
    log_lines: failure.logLines,
    metrics: failure.metrics,
    root_cause: diagnosis.root_cause,
    action: diagnosis.action,
    confidence: diagnosis.confidence,
    ai_source: diagnosis.source,
    timestamp: new Date().toISOString(),
  };

  activeIncident = newIncident;
  broadcast('incident:new', newIncident);

  // Auto-heal after 8 seconds
  setTimeout(async () => {
    if (activeIncident?.id !== newIncident.id) return;
    if (incidentId) {
      await supabase
        .from('incidents')
        .update({ type: 'HEALING', status: 'resolved' })
        .eq('id', incidentId);
    }
    activeIncident = null;
    broadcast('incident:update', { id: incidentId, type: 'HEALING', status: 'resolved' });
    broadcastEvents();
  }, 8000);

  res.json(newIncident);
});

// GET /api/latest — Dashboard snapshot: servers, latest AI diagnosis, simulated incident
router.get('/latest', async (req, res) => {
  try {
    const snap = await getDashboardSnapshot(req.query.server_id, () => activeIncident);
    res.json({
      servers: snap.servers,
      latest_diagnosis: snap.latest_diagnosis,
      simulated_incident: snap.simulated_incident,
      latest: snap.simulated_incident,
    });
  } catch (e) {
    console.error('[API /latest]', e);
    res.status(500).json({ error: 'Failed to load latest snapshot' });
  }
});

// GET /api/stats — Cluster-level telemetry
router.get('/stats', async (req, res) => {
  const { data } = await supabase.from('incidents').select('id').eq('type', 'HEALING');
  const healingCount = data?.length || 0;
  const base = activeIncident?.metrics || {
    cpuUsage: '42%', memoryUsage: '68%', activeNodes: 142, failedNodes: 0, uptime: '99.98%',
  };
  res.json({ ...base, healingEvents: healingCount });
});

// GET /api/history — Full incident history from Supabase
router.get('/history', async (req, res) => {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);
  res.json(error ? [] : (data || []));
});

module.exports = router;
