require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const wsLib   = require('./lib/ws');

const incidentRoutes = require('./routes/incidents');
const serverRoutes   = require('./routes/servers');
const metricsRoutes  = require('./routes/metrics');
const commandRoutes  = require('./routes/commands');
const triggerRoutes  = require('./routes/trigger');

const app  = express();
const PORT = process.env.PORT || 8000;

// ── CORS (restrict to FRONTEND_URL in production) ──────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3000']
  : true;                                              // allow all in dev

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────
app.use('/api',          incidentRoutes); // /api/simulate, /api/latest, /api/stats, /api/history, /api/failure-types
app.use('/api',          triggerRoutes);  // /api/trigger-failure
app.use('/api/servers',  serverRoutes);   // /api/servers, /api/servers/:id, /api/servers/register-server
app.use('/api/metrics',  metricsRoutes);  // POST /api/metrics  (ingest), GET /api/metrics/:server_id (history)
app.use('/api/commands', commandRoutes);  // GET|POST /api/commands/:server_id, POST /api/commands/:server_id/ack

// Optional top-level aliases (same handlers as /api/*)
function forwardTo(router, mountBase, innerPath) {
  return (req, res, next) => {
    const prevUrl = req.url;
    const prevBase = req.baseUrl;
    req.url = innerPath;
    req.baseUrl = mountBase;
    router.handle(req, res, (err) => {
      req.url = prevUrl;
      req.baseUrl = prevBase;
      next(err);
    });
  };
}
app.post('/register-server', forwardTo(serverRoutes, '/api/servers', '/register-server'));
app.post('/metrics', forwardTo(metricsRoutes, '/api/metrics', '/'));
app.get('/servers', forwardTo(serverRoutes, '/api/servers', '/'));
app.get('/latest', forwardTo(incidentRoutes, '/api', '/latest'));

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Global error handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── HTTP + WebSocket server ────────────────────────────────────
const server = http.createServer(app);
wsLib.init(server);

server.listen(PORT, () => {
  console.log(`🚀 SelfHeal API running on port ${PORT}`);
  console.log(`   Supabase:  ${process.env.SUPABASE_URL   ? '✅ connected'  : '⚠️  mock mode'}`);
  const geminiOn = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  console.log(`   Gemini:    ${geminiOn ? '✅ configured' : '⚠️  not set'}`);
  console.log(`   OpenAI:    ${process.env.OPENAI_API_KEY  ? '✅ configured' : '⚠️  not set'}`);
  console.log(`   WebSocket: ✅ ws://localhost:${PORT}`);
});
