const Database = require('better-sqlite3');
const path = require('path');

/**
 * Creates a fresh in-memory SQLite database with the same schema
 * as the production db.js. Completely isolated — never touches real data.
 */
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jwt_tokens (
      id          TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      event_type       TEXT NOT NULL,
      conversation_uuid TEXT,
      reference_number  TEXT,
      contact_phone    TEXT,
      sms_body         TEXT,
      smsgate_response TEXT,
      status           TEXT NOT NULL,
      reason           TEXT
    );
  `);

  // Seed default settings (mirrors db.js defaults)
  const defaultSettings = {
    smsgate_url: 'http://192.168.1.100:8080',
    smsgate_user: 'testuser',
    smsgate_pass: 'testpass',
    smsgate_mode: 'local',
    libredesk_secret: '',
    template_resolved: 'Το αίτημά σας #{ref} επιλύθηκε. {message}',
    template_waiting: 'Υπενθύμιση: Το αίτημά σας #{ref} αναμένει τρίτο μέρος.',
    sms_dedup_resolved: '86400',
    sms_dedup_waiting: '3600'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  return db;
}

/**
 * Creates a mock Express app with the test DB injected.
 * This overrides `require('../db')` so all modules use
 * the in-memory database instead.
 */
function createTestApp(testDb) {
  // Override the db module cache so all requires get our test DB
  const dbModulePath = require.resolve('../server/db');
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: testDb
  };

  // Clear cached modules that depend on db
  const modulesToClear = [
    '../server/config',
    '../server/services/eventRouter',
    '../server/services/jwtManager',
    '../server/services/smsService',
    '../server/services/templateEngine',
    '../server/routes/settings',
    '../server/routes/logs',
    '../server/routes/webhook',
    '../server/routes/smsgate',
    '../server/middleware/webhookAuth',
    '../server/middleware/allowlist',
  ];
  
  for (const mod of modulesToClear) {
    try {
      const resolved = require.resolve(mod);
      delete require.cache[resolved];
    } catch (e) {
      // Module not yet loaded, that's fine
    }
  }

  // Now require express and build the app fresh
  const express = require('express');
  const cors = require('cors');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // Mount routes (they will now use the test DB)
  app.use('/webhooks/smsgate', require('../server/routes/webhook'));
  app.use('/api/settings', require('../server/routes/settings'));
  app.use('/api/logs', require('../server/routes/logs'));
  app.use('/api/smsgate', require('../server/routes/smsgate'));

  // Test webhook replay (always enabled in test mode)
  const fsModule = require('fs');
  app.post('/api/test/send-webhook', (req, res, next) => {
    try {
      const { type } = req.body;
      const { handleLibredeskWebhook } = require('../server/services/eventRouter');
      const payloadPath = path.join(__dirname, 'mock-payloads', `${type}.json`);
      if (!fsModule.existsSync(payloadPath)) {
        return res.status(400).json({ status: 'error', message: 'Unknown mock type' });
      }
      const mockData = JSON.parse(fsModule.readFileSync(payloadPath, 'utf-8'));
      handleLibredeskWebhook(mockData.event, mockData.payload).catch(console.error);
      res.json({ status: 'success', message: `Mock ${type} webhook dispatched` });
    } catch (err) {
      next(err);
    }
  });

  // Global error handler
  app.use((err, req, res, next) => {
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  });

  return app;
}

module.exports = { createTestDb, createTestApp };
