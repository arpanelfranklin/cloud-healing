const { Router } = require('express');
const { supabase, isSupabaseReady } = require('../lib/supabase');
const commands = require('./commands');

const router = Router();

/**
 * POST /api/trigger-failure
 * Body: { server_id, type?: 'cpu_spike' | 'process_crash' }
 * Queues stress_cpu or process_crash for the Lightsail agent to execute.
 */
router.post('/trigger-failure', async (req, res) => {
  const { server_id, type } = req.body || {};
  if (!server_id) {
    return res.status(400).json({ error: 'server_id is required' });
  }

  const mode = type === 'process_crash' ? 'process_crash' : 'cpu_spike';
  const command = mode === 'process_crash' ? 'process_crash' : 'stress_cpu';

  if (isSupabaseReady()) {
    const { data, error } = await supabase.from('servers').select('id').eq('id', server_id).maybeSingle();
    if (error || !data) {
      return res.status(404).json({ error: 'Server not found' });
    }
  }

  try {
    commands.enqueueCommand(server_id, command, 'trigger-failure');
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  res.json({ queued: true, server_id, type: mode, command });
});

module.exports = router;
