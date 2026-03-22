const crypto = require('crypto');
const config = require('../config');

/**
 * Express middleware to verify LibreDesk webhook signature
 */
function webhookAuth(req, res, next) {
  const secret = config.getSetting('libredesk_secret') || process.env.LD_HOOKER_PASS;

  if (!secret) {
    // If no secret is configured, skip verification
    return next();
  }

  const signature = req.headers['x-libredesk-signature'];
  
  if (!signature) {
    console.log('🔴 [WEBHOOK BLOCKED] Missing X-Libredesk-Signature header. Clear your Webhook Secret in LibreDesk or add it to the Proxy settings.');
    return res.status(401).json({ error: 'Missing X-Libredesk-Signature header' });
  }

  // The signature from Header format: sha256=1234abcd
  const parts = signature.split('=');
  const providedSignature = parts.length === 2 ? parts[1] : signature;

  const rawBody = JSON.stringify(req.body);

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest('hex');

  // Using timingSafeEqual for security
  try {
    const a = Buffer.from(expectedSignature, 'ascii');
    const b = Buffer.from(providedSignature, 'ascii');
    
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.log('🔴 [WEBHOOK BLOCKED] Invalid signature mismatch. The secret in LibreDesk does not match your Proxy config.');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.log('🔴 [WEBHOOK BLOCKED] Invalid signature format.');
    return res.status(401).json({ error: 'Invalid signature format' });
  }

  next();
}

module.exports = webhookAuth;
