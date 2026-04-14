const { OpenAI } = require('openai');
const FAILURE_TYPES = require('../config/failureTypes');

let openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

const ALLOW_AI_MOCK = process.env.ALLOW_AI_MOCK === 'true' || process.env.ALLOW_AI_MOCK === '1';

function geminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

// ── Mock fallbacks — used when OpenAI is unavailable (simulate flow) ───────
const MOCK_FALLBACKS = {
  HIGH_CPU: {
    root_cause: (node) => `Runaway cron job on ${node} consumed all CPU cycles, starving application threads.`,
    action: 'Identified and killed PID via process manager. Auto-scaled +2 replicas to absorb load.',
    confidence: 91,
  },
  HIGH_ERROR_RATE: {
    root_cause: (node) => `Upstream dependency timeout cascade on ${node} caused error rate to spike to 34%.`,
    action: 'Opened circuit breaker, retried with exponential backoff, rerouted traffic to healthy replicas.',
    confidence: 88,
  },
  MEMORY_LEAK: {
    root_cause: (node) => `Unbounded cache growth in ${node} exhausted heap, triggering OOM kill loop.`,
    action: 'Force-evicted pod, cleared in-memory cache, redeployed with memory limits & liveness probe.',
    confidence: 94,
  },
};

const METRICS_MOCK_FALLBACKS = {
  high_cpu: {
    root_cause: (s) => `CPU saturation on ${s} caused by runaway worker thread — scheduler starvation detected.`,
    action: 'kill_process',
    action_detail: 'Identified and terminated the offending PID. Verified thread pool health.',
    confidence: 89,
    explanation: (s) =>
      `Observed sustained CPU above the critical threshold on ${s}. This pattern usually indicates a tight loop or unthrottled batch job rather than organic traffic growth.`,
  },
  high_memory: {
    root_cause: (s) => `Memory leak in ${s} exhausted available heap — OOM kill loop triggered.`,
    action: 'restart_service',
    action_detail: 'Gracefully restarted service to flush heap. Applied memory limit enforcement.',
    confidence: 93,
    explanation: (s) =>
      `Memory pressure on ${s} crossed safe operating bounds. A controlled restart is the fastest way to restore steady-state while preserving data integrity.`,
  },
  error_logs: {
    root_cause: (s) => `Cascading error storm on ${s} — upstream dependency failure triggering 5xx responses.`,
    action: 'scale_up',
    action_detail: 'Provisioned +2 additional replicas to absorb load and rerouted ingress via load balancer.',
    confidence: 86,
    explanation: (s) =>
      `Log evidence on ${s} shows correlated fatal and error lines typical of dependency timeouts. Horizontal scale reduces blast radius while dependencies recover.`,
  },
  generic: {
    root_cause: (s) => `Critical threshold breach on ${s} — automated diagnostic triggered.`,
    action: 'restart_service',
    action_detail: 'Executed graceful service restart and confirmed health probe recovery.',
    confidence: 75,
    explanation: (s) =>
      `Automated triage on ${s} could not isolate a single subsystem; applying a conservative restart restores known-good runtime state.`,
  },
};

const ALLOWED_ACTIONS = ['restart_service', 'scale_up', 'kill_process'];

const CPU_CRITICAL = 85;

/** Priority: Gemini (Google AI Studio) → OpenAI */
function pickLlmCaller() {
  if (geminiApiKey()) return { id: 'gemini', call: callGeminiJson };
  if (process.env.OPENAI_API_KEY) return { id: 'openai', call: callOpenAiJson };
  return null;
}

function hasLlmProvider() {
  return pickLlmCaller() !== null;
}

function metricsMockKey(cpu, memory, logs) {
  const logsStr = (logs || '').toLowerCase();
  const hasErrorLog = /\b(error|critical|crit|fatal|exception|panic|oom|killed)\b/.test(logsStr);
  if (cpu > CPU_CRITICAL) return 'high_cpu';
  if (memory > 95) return 'high_memory';
  if (hasErrorLog) return 'error_logs';
  return 'generic';
}

function buildMetricsPrompt(serverName, cpu, memory, logs) {
  const triggerSummary = [
    cpu > CPU_CRITICAL ? `CPU at ${cpu}%` : null,
    memory > 95 ? `Memory at ${memory}%` : null,
    logs ? `Logs excerpt: "${String(logs).slice(0, 200)}"` : null,
  ]
    .filter(Boolean)
    .join('; ');

  return (
    `You are an expert SRE AI. A production server named "${serverName}" has crossed critical thresholds: ${triggerSummary}. ` +
    `Diagnose the issue and respond with a JSON object containing EXACTLY these 5 keys:\n` +
    `- "root_cause": string (1-2 sentence technical explanation)\n` +
    `- "action": one of EXACTLY these three strings: "restart_service", "scale_up", or "kill_process"\n` +
    `- "action_detail": string (what specifically was done or should be done to heal the server)\n` +
    `- "confidence": integer 0-100\n` +
    `- "explanation": string (2-4 sentences, plain English for an on-call engineer — why you believe this root cause and action)\n` +
    `Respond ONLY with raw JSON. No markdown, no code blocks.`
  );
}

function parseJsonFromLlmText(text) {
  const trimmed = String(text || '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('LLM response was not valid JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callOpenAiJson(prompt) {
  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.35,
    max_tokens: 512,
  });
  const raw = completion.choices[0]?.message?.content || '';
  return parseJsonFromLlmText(raw);
}

async function callGeminiJson(prompt) {
  const key = geminiApiKey();
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(key);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return parseJsonFromLlmText(raw);
  }
}

function sourceLabel(id) {
  if (id === 'gemini') return 'Google Gemini';
  return 'OpenAI';
}

function modelLabel(id) {
  if (id === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

/**
 * AI diagnosis for simulated failure scenarios.
 * @returns {{ source, root_cause, action, confidence }}
 */
async function getAIReasoning(nodeName, failureType) {
  const typeLabel = FAILURE_TYPES[failureType]?.label || 'Unknown failure';
  const prompt =
    `A cloud infrastructure node named "${nodeName}" has just experienced a "${typeLabel}" failure. ` +
    `As an expert SRE AI, provide a JSON response with exactly these 3 keys: ` +
    `"root_cause" (a concise, human-readable technical explanation in 1-2 sentences), ` +
    `"action" (the specific automated remediation action taken), ` +
    `and "confidence" (integer 0-100 representing your diagnosis confidence). ` +
    `Respond ONLY with raw JSON, no markdown code blocks.`;

  try {
    const picked = pickLlmCaller();
    if (!picked) throw new Error('No LLM configured');
    const parsed = await picked.call(prompt);
    return { source: sourceLabel(picked.id), ...parsed };
  } catch (err) {
    console.warn('[AI] LLM failed:', err.message, ALLOW_AI_MOCK ? '→ mock fallback' : '→ rethrow');
    if (!ALLOW_AI_MOCK) throw err;
    const fb = MOCK_FALLBACKS[failureType];
    return {
      source: 'Mock Fallback',
      root_cause: fb ? fb.root_cause(nodeName) : 'Unknown failure pattern detected.',
      action: fb ? fb.action : 'Running standard restart protocol.',
      confidence: fb ? fb.confidence : 70,
    };
  }
}

/**
 * AI diagnosis for metrics-triggered (real-server) alerts.
 * @returns {{ source, model, latency_ms, root_cause, action, action_detail, confidence, explanation }}
 */
async function getMetricsDiagnosis({ serverName, cpu, memory, logs }) {
  const t0 = Date.now();
  const prompt = buildMetricsPrompt(serverName, cpu, memory, logs);
  const mockKey = metricsMockKey(cpu, memory, logs);

  if (!hasLlmProvider()) {
    if (!ALLOW_AI_MOCK) {
      const err = new Error('NO_LLM_KEY');
      err.code = 'NO_LLM_KEY';
      throw err;
    }
    const fb = METRICS_MOCK_FALLBACKS[mockKey];
    const latency_ms = Date.now() - t0;
    return {
      source: 'Mock Fallback',
      model: 'none',
      latency_ms,
      root_cause: fb.root_cause(serverName),
      action: fb.action,
      action_detail: fb.action_detail,
      confidence: fb.confidence,
      explanation: typeof fb.explanation === 'function' ? fb.explanation(serverName) : fb.explanation,
    };
  }

  try {
    const picked = pickLlmCaller();
    const parsed = await picked.call(prompt);
    if (!ALLOWED_ACTIONS.includes(parsed.action)) parsed.action = 'restart_service';
    const latency_ms = Date.now() - t0;
    return {
      source: sourceLabel(picked.id),
      model: modelLabel(picked.id),
      latency_ms,
      root_cause: parsed.root_cause,
      action: parsed.action,
      action_detail: parsed.action_detail,
      confidence: Number(parsed.confidence) || 0,
      explanation: parsed.explanation || 'No explanation returned by the model.',
    };
  } catch (err) {
    console.warn('[AI:metrics] LLM failed:', err.message, ALLOW_AI_MOCK ? '→ mock fallback' : '→ rethrow');
    if (!ALLOW_AI_MOCK) throw err;
    const fb = METRICS_MOCK_FALLBACKS[mockKey];
    const latency_ms = Date.now() - t0;
    return {
      source: 'Mock Fallback',
      model: 'none',
      latency_ms,
      root_cause: fb.root_cause(serverName),
      action: fb.action,
      action_detail: fb.action_detail,
      confidence: fb.confidence,
      explanation: typeof fb.explanation === 'function' ? fb.explanation(serverName) : String(fb.explanation),
    };
  }
}

module.exports = {
  getAIReasoning,
  getMetricsDiagnosis,
  ALLOWED_ACTIONS,
  hasLlmProvider,
  CPU_CRITICAL,
  geminiApiKey,
};
