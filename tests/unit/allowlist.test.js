

describe('allowlist middleware', () => {
  let allowlist;

  beforeEach(() => {
    vi.resetModules();
    // Set the env var for tests
    process.env.ALLOWED_DOMAIN = 'test-domain.com';
    allowlist = require('../../server/middleware/allowlist');
  });

  function createMockReqRes(remoteAddress, headers = {}) {
    const req = {
      socket: { remoteAddress },
      headers: { ...headers }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis()
    };
    const next = vi.fn();
    return { req, res, next };
  }

  // --- Loopback tests ---

  it('should allow requests from 127.0.0.1', () => {
    const { req, res, next } = createMockReqRes('127.0.0.1');
    allowlist(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow requests from ::1 (IPv6 loopback)', () => {
    const { req, res, next } = createMockReqRes('::1');
    allowlist(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow requests from ::ffff:127.0.0.1 (IPv4-mapped IPv6)', () => {
    const { req, res, next } = createMockReqRes('::ffff:127.0.0.1');
    allowlist(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // --- External IP tests ---

  it('should block requests from external IP without forwarded host', () => {
    const { req, res, next } = createMockReqRes('203.0.113.50');
    allowlist(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // --- X-Forwarded-Host tests ---

  it('should allow requests with matching X-Forwarded-Host', () => {
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': 'test-domain.com'
    });
    allowlist(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow requests with subdomain of allowed domain', () => {
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': 'api.test-domain.com'
    });
    allowlist(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block requests with unrelated domain', () => {
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': 'evil-domain.com'
    });
    allowlist(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  // --- Bypass attempt tests ---

  it('should block comma injection bypass (evil.com, test-domain.com)', () => {
    // The middleware takes only the first part before comma
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': 'evil.com, test-domain.com'
    });
    allowlist(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should block suffix-matching bypass (test-domain.com.evil.com)', () => {
    // endsWith('.test-domain.com') should not match 'test-domain.com.evil.com'
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': 'test-domain.com.evil.com'
    });
    allowlist(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle empty X-Forwarded-Host gracefully', () => {
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': ''
    });
    allowlist(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should be case-insensitive for X-Forwarded-Host', () => {
    const { req, res, next } = createMockReqRes('203.0.113.50', {
      'x-forwarded-host': 'TEST-DOMAIN.COM'
    });
    allowlist(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
