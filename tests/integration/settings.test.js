
const request = require('supertest');
const { createTestDb, createTestApp } = require('../setup');

describe('Settings API', () => {
  let app;
  let db;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  afterEach(() => {
    try { db.close(); } catch (e) {}
  });

  // --- CRUD ---

  it('GET /api/settings should return all settings with password masked', async () => {
    // Ensure password is set
    db.prepare("UPDATE settings SET value = 'realpassword' WHERE key = 'smsgate_pass'").run();

    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.smsgate_url).toBeDefined();
    expect(res.body.smsgate_pass).toBe('****');
  });

  it('POST /api/settings should update settings', async () => {
    const res = await request(app)
      .post('/api/settings')
      .send({ smsgate_url: 'http://10.0.0.1:9090' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const row = db.prepare("SELECT value FROM settings WHERE key = 'smsgate_url'").get();
    expect(row.value).toBe('http://10.0.0.1:9090');
  });

  it('POST /api/settings should NOT overwrite password when masked value is sent', async () => {
    db.prepare("UPDATE settings SET value = 'secretpass' WHERE key = 'smsgate_pass'").run();

    await request(app)
      .post('/api/settings')
      .send({ smsgate_pass: '****' });

    const row = db.prepare("SELECT value FROM settings WHERE key = 'smsgate_pass'").get();
    expect(row.value).toBe('secretpass');
  });

  it('POST /api/settings with empty body should not crash', async () => {
    const res = await request(app)
      .post('/api/settings')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  // --- SQL Injection ---

  it('POST /api/settings SQL injection in key should be stored as literal string', async () => {
    const maliciousKey = "'; DROP TABLE settings;--";
    const res = await request(app)
      .post('/api/settings')
      .send({ [maliciousKey]: 'test' });

    expect(res.status).toBe(200);

    // Verify settings table still exists
    const count = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    expect(count.count).toBeGreaterThan(0);

    // The malicious key should be stored literally
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(maliciousKey);
    expect(row.value).toBe('test');
  });

  it('POST /api/settings SQL injection in value should be stored as literal string', async () => {
    const res = await request(app)
      .post('/api/settings')
      .send({ smsgate_url: "http://evil.com'; DROP TABLE logs;--" });

    expect(res.status).toBe(200);

    // Verify logs table still exists
    const count = db.prepare('SELECT COUNT(*) as count FROM logs').get();
    expect(count.count).toBeDefined();
  });

  // --- XSS ---

  it('POST /api/settings XSS payload in template should be stored as-is', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const res = await request(app)
      .post('/api/settings')
      .send({ template_resolved: xssPayload });

    expect(res.status).toBe(200);

    const row = db.prepare("SELECT value FROM settings WHERE key = 'template_resolved'").get();
    expect(row.value).toBe(xssPayload);

    // GET should return it as-is (SMS context, no browser sanitization needed)
    const getRes = await request(app).get('/api/settings');
    expect(getRes.body.template_resolved).toBe(xssPayload);
  });

  // --- Prototype Pollution ---

  it('POST /api/settings should not pollute Object.prototype via __proto__', async () => {
    const res = await request(app)
      .post('/api/settings')
      .send(JSON.parse('{"__proto__": {"admin": true}}'));

    expect(res.status).toBe(200);
    // Verify Object.prototype was not polluted
    expect(({}).admin).toBeUndefined();
  });
});
