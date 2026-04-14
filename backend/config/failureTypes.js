// Failure type registry — defines each simulated incident scenario
const FAILURE_TYPES = {
  HIGH_CPU: {
    id: 'HIGH_CPU',
    label: 'High CPU Utilization',
    icon: '🔥',
    metrics: { cpuUsage: '97%', memoryUsage: '61%', activeNodes: 141, failedNodes: 1, uptime: '99.21%' },
    logLines: [
      '[WARN]  CPU throttling detected on worker thread pool',
      '[ERROR] Request queue depth exceeded threshold: 2847 pending',
      '[CRIT]  Scheduler starvation — processes waiting > 30s',
    ],
  },
  HIGH_ERROR_RATE: {
    id: 'HIGH_ERROR_RATE',
    label: 'High Error Rate',
    icon: '💥',
    metrics: { cpuUsage: '68%', memoryUsage: '72%', activeNodes: 140, failedNodes: 2, uptime: '97.80%' },
    logLines: [
      '[ERROR] HTTP 500 rate spiked to 34% of total requests',
      '[ERROR] DB connection pool exhausted — refusing new connections',
      '[CRIT]  Circuit breaker tripped on payment-service dependency',
    ],
  },
  MEMORY_LEAK: {
    id: 'MEMORY_LEAK',
    label: 'Memory Leak Detected',
    icon: '💾',
    metrics: { cpuUsage: '55%', memoryUsage: '98%', activeNodes: 141, failedNodes: 1, uptime: '98.95%' },
    logLines: [
      '[WARN]  Heap usage at 91% — GC overhead threshold exceeded',
      '[ERROR] OOM kill triggered on replica pod ap-south-1a-worker-3',
      '[CRIT]  Memory pressure causing cascading container restarts',
    ],
  },
};

module.exports = FAILURE_TYPES;
