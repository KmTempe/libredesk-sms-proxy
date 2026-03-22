const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'proxy.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Migrations
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jwt_tokens (
      id          TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      event_type       TEXT NOT NULL,   -- "resolved" | "waiting" | "skipped" | "error"
      conversation_uuid TEXT,
      reference_number  TEXT,
      contact_phone    TEXT,
      sms_body         TEXT,
      smsgate_response TEXT,            -- JSON string of API response
      status           TEXT NOT NULL,   -- "sent" | "skipped" | "error"
      reason           TEXT             -- reason for skip/error
    );
  `);

  // Seed default settings
  const defaultSettings = {
    smsgate_url: "http://192.168.1.100:8080",
    smsgate_user: "",
    smsgate_pass: "",
    smsgate_mode: "local",
    libredesk_secret: "",
    template_resolved: "Το αίτημά σας #{ref} επιλύθηκε. {message}",
    template_waiting: "Υπενθύμιση: Το αίτημά σας #{ref} αναμένει τρίτο μέρος.",
    sms_dedup_resolved: "86400",
    sms_dedup_waiting: "3600"
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  
  const seed = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      insertSetting.run(key, value);
    }
  });

  seed(defaultSettings);
};

initDb();

module.exports = db;
