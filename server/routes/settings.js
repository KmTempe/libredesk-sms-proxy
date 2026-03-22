const express = require('express');
const router = express.Router();
const config = require('../config');

// GET /api/settings
router.get('/', (req, res, next) => {
  try {
    const settings = config.getAllSettings();
    // Inject testphone from .env if present
    settings.testphone = process.env.testphone || '';

    // Mask smsgate_pass
    if (settings.smsgate_pass) {
      settings.smsgate_pass = '****';
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings
router.post('/', (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      // Don't overwrite password if masked
      if (key === 'smsgate_pass' && value === '****') continue;
      config.setSetting(key, value);
    }
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
