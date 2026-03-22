const express = require('express');
const router = express.Router();
const config = require('../config');
const { sendSMS } = require('../services/smsService');

// GET /api/smsgate/test-connection?phone=YOUR_PHONE_NUMBER
router.get('/test-connection', async (req, res, next) => {
  try {
    const url = config.getSetting('smsgate_url');
    if (!url) {
      return res.json({ ok: false, message: 'SMSGate URL not configured' });
    }

    const user = config.getSetting('smsgate_user');
    const pass = config.getSetting('smsgate_pass');
    if (!user || !pass) {
      return res.json({ ok: false, message: 'SMSGate credentials not configured' });
    }

    // Accept phone from query param, auto-prefix +30 if no country code
    let phone = (req.query.phone || '').trim();
    if (phone && !phone.startsWith('+')) {
      phone = '+30' + phone;
    }
    if (!phone) {
      return res.json({ ok: false, message: 'No test phone number provided. Pass ?phone=YOUR_PHONE_NUMBER' });
    }

    const isCloud = url.includes('api.sms-gate.app');
    const modeString = isCloud ? 'CLOUD MODE (JWT Auth)' : 'LOCAL MODE (Basic Auth)';
    const text = `LibreDesk SMS Proxy — test message. Mode: ${modeString}`;

    try {
      const start = Date.now();
      const result = await sendSMS({ phoneNumber: phone, text });
      const latency = Date.now() - start;
      res.json({
        ok: true,
        message: `Test SMS sent to ${phone} in ${latency}ms. Mode: ${modeString}`,
        smsgate_response: result
      });
    } catch (err) {
      res.json({ ok: false, message: `SMS send failed: ${err.message}` });
    }

  } catch (err) {
    next(err);
  }
});

module.exports = router;
