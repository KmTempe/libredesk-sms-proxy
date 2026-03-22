
const request = require('supertest');
const crypto = require('crypto');
const { createTestDb, createTestApp } = require('../setup');

describe('Webhook Route', () => {
  let app;
  let db;

  beforeEach(() => {
    vi.resetModules();
    db = createTestDb();
    app = createTestApp(db);
  });

  afterEach(() => {
    try { db.close(); } catch (e) {}
  });

  function makeResolvedPayload() {
    return {
      event: 'conversation.status_changed',
      timestamp: '2025-06-15T10:35:00Z',
      payload: {
        conversation_uuid: 'test-uuid-webhook-001',
        previous_status: 'Open',
        new_status: 'Resolved',
        conversation: {
          reference_number: '200',
          status: 'Resolved',
          last_message: 'Issue fixed.',
          tags: [],
          contact: {
            first_name: 'Test',
            last_name: 'User',
            phone_number: '+306900000099',
            phone_number_country_code: 'GR'
          }
        }
      }
    };
  }

  function generateSignature(secret, body) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    return 'sha256=' + hmac.digest('hex');
  }

  // --- Basic endpoint ---

  it('POST /webhooks/smsgate with valid payload should return 200', async () => {
    const payload = makeResolvedPayload();
    const res = await request(app)
      .post('/webhooks/smsgate')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /webhooks/smsgate with HMAC when secret is set should accept valid signature', async () => {
    const secret = 'webhook-test-secret';
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('libredesk_secret', ?)").run(secret);

    // Re-create app to pick up new secret
    app = createTestApp(db);

    const payload = makeResolvedPayload();
    const signature = generateSignature(secret, payload);

    const res = await request(app)
      .post('/webhooks/smsgate')
      .set('X-Libredesk-Signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /webhooks/smsgate with wrong HMAC should return 401', async () => {
    const secret = 'webhook-secret-wrong';
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('libredesk_secret', ?)").run(secret);
    app = createTestApp(db);

    const payload = makeResolvedPayload();

    const res = await request(app)
      .post('/webhooks/smsgate')
      .set('X-Libredesk-Signature', 'sha256=0000000000000000000000000000000000000000000000000000000000000000')
      .send(payload);

    expect(res.status).toBe(401);
  });

  it('POST /webhooks/smsgate with empty body should not crash', async () => {
    const res = await request(app)
      .post('/webhooks/smsgate')
      .send({});

    expect(res.status).toBe(200);
  });

  // --- Security: RCE attempt ---

  it('POST /webhooks/smsgate RCE attempt in event field should not execute code', async () => {
    const payload = {
      event: { toString: 'process.exit' },
      payload: {
        conversation_uuid: 'rce-test',
        conversation: {
          reference_number: '999',
          contact: { phone_number: '+306900000001' }
        }
      }
    };

    const res = await request(app)
      .post('/webhooks/smsgate')
      .send(payload);

    // Server should still be alive and respond (500 is fine as it's a fail-safe response to an invalid object)
    expect([200, 400, 500]).toContain(res.status);
  });

  // --- Security: Large body ---

  it('POST /webhooks/smsgate with very large body should be handled', async () => {
    const largePayload = {
      event: 'conversation.status_changed',
      payload: {
        conversation_uuid: 'large-test',
        new_status: 'Resolved',
        conversation: {
          reference_number: '1',
          last_message: 'X'.repeat(100000), // 100KB message
          tags: [],
          contact: { phone_number: '+306900000001' }
        }
      }
    };

    const res = await request(app)
      .post('/webhooks/smsgate')
      .send(largePayload);

    expect(res.status).toBe(200);
  });
});
