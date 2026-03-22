
const crypto = require('crypto');

describe('webhookAuth middleware', () => {
  let webhookAuth;
  let mockGetSetting;

  beforeEach(() => {
    vi.resetModules();

    // Create the mock getSetting function
    mockGetSetting = vi.fn();

    // Override config in the module cache BEFORE requiring webhookAuth
    const configPath = require.resolve('../../server/config');
    require.cache[configPath] = {
      id: configPath, filename: configPath, loaded: true,
      exports: { getSetting: mockGetSetting, setSetting: vi.fn(), getAllSettings: vi.fn() }
    };

    // Clear webhookAuth cache so it picks up our mocked config
    try { delete require.cache[require.resolve('../../server/middleware/webhookAuth')]; } catch (e) {}

    webhookAuth = require('../../server/middleware/webhookAuth');
  });

  function createMockReqRes(body, headers = {}) {
    const req = { body, headers: { ...headers } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    const next = vi.fn();
    return { req, res, next };
  }

  function generateSignature(secret, body) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    return 'sha256=' + hmac.digest('hex');
  }

  it('should call next() when no secret is configured', () => {
    mockGetSetting.mockReturnValue('');
    const { req, res, next } = createMockReqRes({ test: 'data' });

    webhookAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() with valid signature', () => {
    const secret = 'test-secret-123';
    const body = { event: 'conversation.status_changed', payload: {} };
    const signature = generateSignature(secret, body);

    mockGetSetting.mockReturnValue(secret);
    const { req, res, next } = createMockReqRes(body, {
      'x-libredesk-signature': signature
    });

    webhookAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 when signature header is missing', () => {
    mockGetSetting.mockReturnValue('my-secret');
    const { req, res, next } = createMockReqRes({ test: 'data' });

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when HMAC value is wrong', () => {
    const secret = 'correct-secret';
    const body = { event: 'test' };

    mockGetSetting.mockReturnValue(secret);
    const { req, res, next } = createMockReqRes(body, {
      'x-libredesk-signature': 'sha256=deadbeef0000000000000000000000000000000000000000000000000000abcd'
    });

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when body is tampered after signing', () => {
    const secret = 'tamper-secret';
    const originalBody = { event: 'conversation.status_changed', data: 'original' };
    const signature = generateSignature(secret, originalBody);

    const tamperedBody = { event: 'conversation.status_changed', data: 'tampered' };

    mockGetSetting.mockReturnValue(secret);
    const { req, res, next } = createMockReqRes(tamperedBody, {
      'x-libredesk-signature': signature
    });

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle signature without sha256= prefix by using raw value', () => {
    // When signature has no '=' at all, split('=') returns [rawString]
    // parts.length is 1, so providedSignature = signature (the full string)
    // This means the raw hex IS the provided signature — it should match
    const secret = 'prefix-test';
    const body = { event: 'test' };
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    const rawHex = hmac.digest('hex');

    mockGetSetting.mockReturnValue(secret);

    // However, hex strings can contain characters like 'a'-'f' but no '='.
    // split('=') on a pure hex string gives [hexString] with length 1.
    // So providedSignature = rawHex (the full string). This will match expectedSignature.
    // BUT: the middleware code does parts[1] when parts.length === 2.
    // For parts.length !== 2, it uses `signature` (the full header value).
    // So without prefix, providedSignature = rawHex, which matches expectedSignature.
    const { req, res, next } = createMockReqRes(body, {
      'x-libredesk-signature': rawHex
    });

    webhookAuth(req, res, next);

    // The hex digest won't contain '=' so split produces [hexString]
    // parts.length === 1, so providedSignature = signature = rawHex
    // This matches expectedSignature → should pass
    expect(next).toHaveBeenCalled();
  });

  it('should use timingSafeEqual (no timing side-channel)', () => {
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    const secret = 'timing-test';
    const body = { event: 'test' };
    const signature = generateSignature(secret, body);

    mockGetSetting.mockReturnValue(secret);
    const { req, res, next } = createMockReqRes(body, {
      'x-libredesk-signature': signature
    });

    webhookAuth(req, res, next);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
