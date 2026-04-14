const { Router } = require('express');

const router = Router();

const ALLOWED = ['restart_service', 'scale_up', 'kill_process', 'stress_cpu', 'process_crash'];

/**
 * In-memory command queue.
 * Maps server_id → pending command object (one at a time per server).
 */
const commandQueue = new Map();

function enqueueCommand(server_id, command, dispatched_by = 'dashboard') {
  if (!server_id || !ALLOWED.includes(command)) {
    throw new Error(`Invalid command. Must be one of: ${ALLOWED.join(', ')}`);
  }
  const entry = {
    command,
    dispatched_by: dispatched_by || 'dashboard',
    queued_at: new Date().toISOString(),
    status: 'pending',
  };
  commandQueue.set(server_id, entry);
  console.log(`[Commands] Queued "${command}" for server ${server_id}`);
  return entry;
}

// ── POST /api/commands/:server_id ─────────────────────────────────────────
router.post('/:server_id', (req, res) => {
  const { server_id } = req.params;
  const { command, dispatched_by } = req.body;
  try {
    enqueueCommand(server_id, command, dispatched_by);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const entry = commandQueue.get(server_id);
  res.json({ queued: true, ...entry });
});

// ── GET /api/commands/:server_id ──────────────────────────────────────────
router.get('/:server_id', (req, res) => {
  const { server_id } = req.params;
  const pending = commandQueue.get(server_id);

  if (!pending || pending.status !== 'pending') {
    return res.json({ command: null });
  }

  commandQueue.set(server_id, { ...pending, status: 'dispatched' });
  res.json(pending);
});

// ── POST /api/commands/:server_id/ack ─────────────────────────────────────
router.post('/:server_id/ack', (req, res) => {
  const { server_id } = req.params;
  const { result, executed_at } = req.body;

  const existing = commandQueue.get(server_id);
  if (existing) {
    commandQueue.set(server_id, {
      ...existing,
      status: 'acknowledged',
      result: result || 'success',
      executed_at: executed_at || new Date().toISOString(),
    });
  }

  console.log(`[Commands] ACK from ${server_id}: ${result || 'success'}`);
  res.json({ acknowledged: true });
});

// ── GET /api/commands ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const all = [];
  for (const [server_id, cmd] of commandQueue.entries()) {
    all.push({ server_id, ...cmd });
  }
  res.json(all);
});

router.enqueueCommand = enqueueCommand;

module.exports = router;
