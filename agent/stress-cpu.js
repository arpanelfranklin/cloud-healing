#!/usr/bin/env node
/**
 * SelfHeal — CPU Stress Test
 *
 * Saturates all CPU cores using worker threads.
 * Runs for a fixed duration then exits cleanly.
 *
 * Usage:
 *   node stress-cpu.js            # 30s on all cores
 *   node stress-cpu.js 60 2       # 60s on 2 cores
 *   DURATION=45 node stress-cpu.js
 */

'use strict';

const { Worker, isMainThread, workerData } = require('worker_threads');
const os = require('os');

const DURATION_MS = Number(process.argv[2] || process.env.DURATION || 30) * 1000;
const CORES       = Number(process.argv[3] || process.env.CORES    || os.cpus().length);

if (!isMainThread) {
  // Worker: spin endlessly until parent signals stop
  const start = Date.now();
  while (Date.now() - start < workerData.duration) {
    Math.sqrt(Math.random() * 999999999); // pure CPU burn
  }
  process.exit(0);
}

// Main thread
console.log('');
console.log('🔥 SelfHeal CPU Stress Test');
console.log(`   Cores:    ${CORES} / ${os.cpus().length} available`);
console.log(`   Duration: ${DURATION_MS / 1000}s`);
console.log(`   Purpose:  Trigger high CPU (>85%) to fire AI healing`);
console.log('');

const workers = [];
for (let i = 0; i < CORES; i++) {
  const w = new Worker(__filename, { workerData: { duration: DURATION_MS } });
  workers.push(w);
  w.on('exit', () => {});
}

console.log(`⏳ Stressing ${CORES} core(s) for ${DURATION_MS / 1000}s... watch your dashboard!`);

setTimeout(() => {
  console.log('✅ Stress test complete. CPU returning to idle.');
  process.exit(0);
}, DURATION_MS + 2000);
