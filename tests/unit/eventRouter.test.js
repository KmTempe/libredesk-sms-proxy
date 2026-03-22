
const { createTestDb } = require('../setup');

describe('eventRouter', () => {
  let db;
  let handleLibredeskWebhook;
  let mockSendSMS;

  beforeEach(() => {
    vi.resetModules();

    db = createTestDb();

    // Inject test DB
    const dbModulePath = require.resolve('../../server/db');
    require.cache[dbModulePath] = {
      id: dbModulePath, filename: dbModulePath, loaded: true, exports: db
    };

    // Clear dependent module caches
    [
      '../../server/config',
      '../../server/services/templateEngine',
      '../../server/services/smsService',
      '../../server/services/eventRouter'
    ].forEach(mod => {
      try { delete require.cache[require.resolve(mod)]; } catch (e) {}
    });

    // Mock sendSMS
    mockSendSMS = vi.fn().mockResolvedValue({ id: 'mock-sms-id', state: 'Pending' });

    // We need to mock smsService before eventRouter loads it
    const smsServicePath = require.resolve('../../server/services/smsService');
    require.cache[smsServicePath] = {
      id: smsServicePath, filename: smsServicePath, loaded: true,
      exports: { sendSMS: mockSendSMS, isValidPhone: require('../../server/services/smsService').isValidPhone }
    };

    // Now clear eventRouter cache again so it picks up the mock
    try { delete require.cache[require.resolve('../../server/services/eventRouter')]; } catch (e) {}

    const eventRouter = require('../../server/services/eventRouter');
    handleLibredeskWebhook = eventRouter.handleLibredeskWebhook;
  });

  afterEach(() => {
    try { db.close(); } catch (e) {}
  });

  function makePayload(overrides = {}) {
    return {
      event: 'conversation.status_changed',
      payload: {
        conversation_uuid: 'test-uuid-001',
        new_status: 'Resolved',
        conversation: {
          reference_number: '100',
          status: 'Resolved',
          last_message: 'Your issue has been resolved.',
          tags: [],
          contact: {
            phone_number: '+306900000001',
            phone_number_country_code: 'GR'
          },
          ...overrides.conversation
        },
        ...overrides.payload
      }
    };
  }

  // --- Core routing tests ---

  it('should send SMS for resolved status', async () => {
    const { event, payload } = makePayload();
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).toHaveBeenCalledOnce();
    const call = mockSendSMS.mock.calls[0][0];
    expect(call.phoneNumber).toBe('+306900000001');
    expect(call.text).toContain('100');
  });

  it('should send SMS for waiting-on-3rd-party tag', async () => {
    const { event, payload } = makePayload({
      conversation: { tags: ['waiting-on-3rd-party'] }
    });
    await handleLibredeskWebhook(event, { payload });
    expect(mockSendSMS).toHaveBeenCalledOnce();
  });

  it('should send SMS for waiting-on-third-party (spelled out) tag', async () => {
    const { event, payload } = makePayload({
      conversation: { tags: ['waiting on third party'] } // test normalization
    });
    await handleLibredeskWebhook(event, { payload });
    expect(mockSendSMS).toHaveBeenCalledOnce();
  });

  it('should send SMS for conversation.updated if tag is present', async () => {
    const { payload } = makePayload({
      conversation: { tags: ['waiting-on-3rd-party'] }
    });
    await handleLibredeskWebhook('conversation.updated', { payload });
    expect(mockSendSMS).toHaveBeenCalledOnce();
  });

  it('should NOT send SMS for open status', async () => {
    const { event, payload } = makePayload({
      payload: { new_status: 'Open' },
      conversation: { status: 'Open' }
    });
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  // --- Phone validation ---

  it('should log error for missing phone number', async () => {
    const { event, payload } = makePayload({
      conversation: { contact: { phone_number: null } }
    });
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).not.toHaveBeenCalled();

    const logRow = db.prepare('SELECT * FROM logs WHERE status = ?').get('error');
    expect(logRow).toBeTruthy();
    expect(logRow.reason).toBe('invalid_phone_format');
  });

  it('should auto-prefix +30 for phone without + prefix', async () => {
    const { event, payload } = makePayload({
      conversation: { contact: { phone_number: '6900000001' } }
    });
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).toHaveBeenCalledOnce();
    expect(mockSendSMS.mock.calls[0][0].phoneNumber).toBe('+306900000001');
  });

  it('should reject phone with letters', async () => {
    const { event, payload } = makePayload({
      conversation: { contact: { phone_number: '+30abc1234' } }
    });
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  // --- Deduplication ---

  it('should skip duplicate resolved within dedup window', async () => {
    const { event, payload } = makePayload();

    // First call — should send
    await handleLibredeskWebhook(event, { payload });
    expect(mockSendSMS).toHaveBeenCalledOnce();

    mockSendSMS.mockClear();

    // Second call immediately — should be skipped
    await handleLibredeskWebhook(event, { payload });
    expect(mockSendSMS).not.toHaveBeenCalled();

    const dupeLog = db.prepare("SELECT * FROM logs WHERE reason = 'duplicate'").get();
    expect(dupeLog).toBeTruthy();
  });

  it('should send after dedup window expires', async () => {
    // Set dedup window to 1 second for test
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'sms_dedup_resolved'").run();

    const { event, payload } = makePayload();

    // First call
    await handleLibredeskWebhook(event, { payload });
    expect(mockSendSMS).toHaveBeenCalledOnce();

    // Move the log timestamp 2 seconds into the past
    db.prepare("UPDATE logs SET created_at = datetime('now', '-2 seconds')").run();

    mockSendSMS.mockClear();

    // Second call — should now send (window expired)
    await handleLibredeskWebhook(event, { payload });
    expect(mockSendSMS).toHaveBeenCalledOnce();
  });

  // --- Message processing ---

  it('should detect activity messages and use fallback', async () => {
    const { event, payload } = makePayload({
      conversation: { last_message: 'User marked the conversation as Resolved' }
    });
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).toHaveBeenCalledOnce();
    const smsText = mockSendSMS.mock.calls[0][0].text;
    // Should NOT contain the activity message
    expect(smsText).not.toContain('marked the conversation');
    // Should contain the fallback
    expect(smsText).toContain('100');
  });

  it('should handle empty last_message gracefully', async () => {
    const { event, payload } = makePayload({
      conversation: { last_message: '' }
    });
    await handleLibredeskWebhook(event, { payload });

    expect(mockSendSMS).toHaveBeenCalledOnce();
    // Should not crash, SMS body should still contain ref
    expect(mockSendSMS.mock.calls[0][0].text).toContain('100');
  });

  // --- Error handling ---

  it('should log error when sendSMS throws', async () => {
    mockSendSMS.mockRejectedValueOnce(new Error('Network timeout'));

    const { event, payload } = makePayload();
    await handleLibredeskWebhook(event, { payload });

    const errorLog = db.prepare("SELECT * FROM logs WHERE status = 'error' AND reason = 'Network timeout'").get();
    expect(errorLog).toBeTruthy();
  });
});
