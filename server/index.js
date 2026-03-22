require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Initialize database connection and schemas
require('./db');

const app = express();
const PORT = process.env.PORT || 3400;
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'localhost';

// ── Security ────────────────────────────────────────────────────────────────

// Remove fingerprinting header
app.disable('x-powered-by');

// Trust the reverse-proxy so req.ip / X-Forwarded-* headers are accurate
app.set('trust proxy', 1);

// Domain allowlist — FIRST middleware, blocks everything not from localhost
// or forwarded through the trusted reverse-proxy domain.
const allowlist = require('./middleware/allowlist');
app.use(allowlist);

// CORS locked to the trusted domain (covers preflight requests)
app.use(cors({
  origin: [`https://${ALLOWED_DOMAIN}`, `http://localhost:${PORT}`],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Libredesk-Signature']
}));

// Body parsing
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────

// Webhook — public-facing (via reverse proxy), protected by HMAC signature
app.use('/webhooks/smsgate', require('./routes/webhook'));

// API routes — internal management (accessible only through reverse proxy / localhost)
app.use('/api/settings', require('./routes/settings'));
app.use('/api/logs',     require('./routes/logs'));
app.use('/api/smsgate',  require('./routes/smsgate'));

// Test payload replay (dev only)
if (process.env.NODE_ENV !== 'production') {
  const path = require('path');
  app.post('/api/test/send-webhook', (req, res, next) => {
    try {
      const { type } = req.body;
      const { handleLibredeskWebhook } = require('./services/eventRouter');
      const fs = require('fs');

      const payloadPath = path.join(__dirname, '..', 'tests', 'mock-payloads', `${type}.json`);
      if (!fs.existsSync(payloadPath)) {
        return res.status(400).json({ status: 'error', message: 'Unknown mock type' });
      }

      const mockData = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
      handleLibredeskWebhook(mockData.event, mockData.payload).catch(console.error);
      res.json({ status: 'success', message: `Mock ${type} webhook dispatched to router!` });
    } catch (err) {
      next(err);
    }
  });
}

// ── Catch-all: return bare 404 for any unknown route ────────────────────────
// No SPA serving on port 3400 — the UI is served by the reverse proxy only.
app.use((req, res) => res.status(404).end());

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`LibreDesk SMS Proxy listening on 127.0.0.1:${PORT} (webhook + API only)`);
  console.log(`Trusted domain: ${ALLOWED_DOMAIN}`);
});

