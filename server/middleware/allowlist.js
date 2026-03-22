/**
 * Allowlist middleware for port 3400.
 *
 * Only requests from localhost or from the trusted reverse-proxy domain
 * are allowed. Everything else receives a bare 404 — no body, no hints.
 *
 * Trusted sources:
 *  - Loopback (127.0.0.1, ::1) — internal calls
 *  - X-Forwarded-Host: *.your-domain.com — requests proxied through Nginx/Caddy
 *
 * To change the allowed domain, set ALLOWED_DOMAIN in .env
 */
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'localhost';

const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

function allowlist(req, res, next) {
  const ip = req.socket.remoteAddress || '';

  // Allow loopback connections (same machine / Docker internal)
  if (LOOPBACK.includes(ip)) {
    return next();
  }

  // Allow requests forwarded by the trusted reverse proxy.
  // Nginx/Caddy sets X-Forwarded-Host to the original public hostname.
  const forwardedHost = (req.headers['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase();
  if (forwardedHost === ALLOWED_DOMAIN || forwardedHost.endsWith(`.${ALLOWED_DOMAIN}`)) {
    return next();
  }

  // Block everything else — return a bare 404 with no information leak
  return res.status(404).end();
}

module.exports = allowlist;
