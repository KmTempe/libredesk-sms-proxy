
const request = require('supertest');
const { createTestDb, createTestApp } = require('../setup');

describe('Logs API', () => {
  let app;
  let db;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);

    // Seed some log entries
    const insertLog = db.prepare(`
      INSERT INTO logs (event_type, conversation_uuid, reference_number, contact_phone, sms_body, status, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 15; i++) {
      const status = i % 3 === 0 ? 'error' : (i % 2 === 0 ? 'skipped' : 'sent');
      insertLog.run('resolved', `uuid-${i}`, `${i}`, `+3069000000${String(i).padStart(2, '0')}`, `Test SMS ${i}`, status, status === 'error' ? 'test error' : null);
    }
  });

  afterEach(() => {
    try { db.close(); } catch (e) {}
  });

  // --- Pagination ---

  it('GET /api/logs should return default pagination (page 1, limit 50)', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(50);
    expect(res.body.pagination.total).toBe(15);
    expect(res.body.data.length).toBe(15);
  });

  it('GET /api/logs?page=2&limit=10 should return correct offset', async () => {
    const res = await request(app).get('/api/logs?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5); // 15 total, page 2 with limit 10 = 5 remaining
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('GET /api/logs?page=1&limit=5 should return exactly 5 items', async () => {
    const res = await request(app).get('/api/logs?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
  });

  // --- Filtering ---

  it('GET /api/logs?status=sent should filter by sent status', async () => {
    const res = await request(app).get('/api/logs?status=sent');
    expect(res.status).toBe(200);
    expect(res.body.data.every(log => log.status === 'sent')).toBe(true);
  });

  it('GET /api/logs?status=error should filter by error status', async () => {
    const res = await request(app).get('/api/logs?status=error');
    expect(res.status).toBe(200);
    expect(res.body.data.every(log => log.status === 'error')).toBe(true);
    expect(res.body.data.length).toBe(5); // Every 3rd entry is error
  });

  it('GET /api/logs?status=all should return all logs', async () => {
    const res = await request(app).get('/api/logs?status=all');
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(15);
  });

  // --- DELETE ---

  it('DELETE /api/logs should clear all logs', async () => {
    const res = await request(app).delete('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const count = db.prepare('SELECT COUNT(*) as count FROM logs').get();
    expect(count.count).toBe(0);
  });

  // --- SQL Injection ---

  it('GET /api/logs SQL injection in status filter should not execute', async () => {
    const res = await request(app).get("/api/logs?status=sent'; DROP TABLE logs;--");
    expect(res.status).toBe(200);

    // logs table should still exist
    const count = db.prepare('SELECT COUNT(*) as count FROM logs').get();
    expect(count.count).toBe(15);
  });

  it('GET /api/logs SQL injection in page param should be handled safely', async () => {
    const res = await request(app).get('/api/logs?page=1;DROP TABLE logs&limit=10');
    expect(res.status).toBe(200);

    // logs table should still exist
    const count = db.prepare('SELECT COUNT(*) as count FROM logs').get();
    expect(count.count).toBe(15);
  });

  // --- Edge cases ---

  it('GET /api/logs with negative page should default to sane value', async () => {
    const res = await request(app).get('/api/logs?page=-1&limit=10');
    expect(res.status).toBe(200);
    // parseInt('-1') = -1, offset = (-1-1)*10 = -20, SQLite treats negative offset as 0
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/logs with very large limit should not crash', async () => {
    const res = await request(app).get('/api/logs?limit=999999');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(15);
  });
});
