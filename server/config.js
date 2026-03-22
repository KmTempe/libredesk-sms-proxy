const db = require('./db');

/**
 * Gets a specific setting from the database.
 * @param {string} key 
 * @returns {string|null} String value of the setting or null if missing.
 */
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Updates or inserts a new setting.
 * @param {string} key 
 * @param {string} value 
 */
function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

/**
 * Returns all settings as a key-value object.
 * Identical to what gets stored in the DB.
 * NOTE: For API responses that require masking, mask the smsgate_pass downstream.
 */
function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

module.exports = {
  getSetting,
  setSetting,
  getAllSettings
};
