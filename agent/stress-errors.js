#!/usr/bin/env node
/**
 * SelfHeal — Error Log Stress Test
 *
 * Injects ERROR and CRIT-level logs via the metrics endpoint.
 * The AI engine will detect the error pattern and trigger healing.
 *
 * Usage:
 *   node stress-errors.js <server_id> <backend_url>
 *   node stress-errors.js srv-001 http://your-backend:8000
 *
 *   Or use env vars:
 *   SERVER_ID=srv-001 BACKEND_URL=http://... node stress-errors.js
 */

'use strict';

const SERVER_ID   = process.argv[2] || process.env.SERVER_ID;
const BACKEND_URL = process.argv[3] || process.env.BACKEND_URL || 'http://localhost:8000';
const ROUNDS      = Number(process.argv[4] || process.env.ROUNDS || 5);

if (!SERVER_ID) {
  console.error('❌ Usage: node stress-errors.js <server_id> [backend_url]');
  console.error('   Or:   SERVER_ID=srv-001 node stress-errors.js');
  process.exit(1);
}

const ERROR_LOGS = [
  '[ERROR] DB connection pool exhausted — refusing new connections',
  '[CRIT]  OOM kill triggered on replica pod — restarting',
  '[ERROR] Upstream API timeout after 30000ms — circuit breaker OPEN',
  '[CRIT]  Heap memory at 98% — GC overhead limit exceeded',
  '[ERROR] Health check failed 3 times — pod marked unhealthy',
  '[CRIT]  Kernel: Out of memory — Kill process score 950 pid 1234',
  '[ERROR] HTTP 500 rate: 42% of last 1000 requests',
];

async function injectErrorMetrics(round) {
  const log = ERROR_LOGS[round % ERROR_LOGS.length];
  const payload = {
    server_id: SERVER_ID,
    cpu:    20 + Math.floor(Math.random() * 30), // moderate CPU — errors are the trigger
    memory: 65 + Math.floor(Math.random() * 20),
    uptime: Math.floor(os.uptime()),
    logs:   log,
  };

  console.log(`[Round ${round + 1}/${ROUNDS}] Injecting → ${log}`);

  try {
    const res = await fetch(`${BACKEND_URL}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.healing?.triggered) {
      console.log(`✅ HEALING TRIGGERED!`);
      console.log(`   Action:     ${data.healing.action_label}`);
      console.log(`   Root cause: ${data.healing.root_cause}`);
      console.log(`   Confidence: ${data.healing.confidence}%`);
    } else {
      console.log(`   Status: ${data.status || 'sent'}`);
    }
  } catch (err) {
    console.error(`   ❌ Failed: ${err.message}`);
  }
}

const os = require('os');

async function main() {
  console.log('');
  console.log('💥 SelfHeal — Error Log Stress Test');
  console.log(`   Server ID:  ${SERVER_ID}`);
  console.log(`   Backend:    ${BACKEND_URL}`);
  console.log(`   Rounds:     ${ROUNDS}`);
  console.log('');

  for (let i = 0; i < ROUNDS; i++) {
    await injectErrorMetrics(i);
    if (i < ROUNDS - 1) await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n✅ Error stress test complete.');
}

main();
