const { getSetting } = require('../config');
const db = require('../db');

class JWTManager {
  constructor() {
    this.token = null;
    this.expiresAt = null;
    this.initFromDb();
  }

  initFromDb() {
    // Restore the latest token from the local DB caching logic
    const row = db.prepare('SELECT access_token, expires_at FROM jwt_tokens ORDER BY created_at DESC LIMIT 1').get();
    if (row) {
      this.token = row.access_token;
      this.expiresAt = row.expires_at;
    }
  }

  saveToken(tokenData) {
    const stmt = db.prepare('INSERT INTO jwt_tokens (id, access_token, expires_at) VALUES (?, ?, ?)');
    stmt.run(Date.now().toString(), tokenData.access_token, tokenData.expires_at);
  }

  async getToken() {
    // Use existing token if valid and expires more than 60s from now
    if (this.token && this.expiresAt) {
      const expDate = new Date(this.expiresAt);
      if (expDate > new Date(Date.now() + 60000)) {
        return this.token;
      }
    }
    
    // Attempt refresh
    try {
      return await this.refreshToken();
    } catch (err) {
      console.error('Failed to refresh JWT token:', err.message);
      throw err;
    }
  }

  async refreshToken() {
    const url = getSetting('smsgate_url');
    const user = getSetting('smsgate_user');
    const pass = getSetting('smsgate_pass');

    const credentials = Buffer.from(`${user}:${pass}`).toString('base64');

    // Fetch API in Node.js >= 18
    const res = await fetch(`${url}/3rdparty/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        ttl: 3600,
        scopes: ['messages:send']
      })
    });

    if (!res.ok) {
      throw new Error(`JWT token generation failed with status: ${res.status}`);
    }

    const data = await res.json();
    this.token = data.access_token;
    this.expiresAt = data.expires_at;
    
    this.saveToken(data);
    return this.token;
  }
}

module.exports = new JWTManager();
