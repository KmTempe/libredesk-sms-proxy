const express = require('express');
const router = express.Router();
const webhookAuth = require('../middleware/webhookAuth');
const { handleLibredeskWebhook } = require('../services/eventRouter');

router.post('/', webhookAuth, async (req, res, next) => {
  try {
    const payload = req.body;
    const event = payload.event;
    const payloadData = payload.payload || {};
    const uuid = payloadData.conversation_uuid || payload.conversation_uuid;
    
    console.log(`\n🔔 [WEBHOOK ARRIVED] Event: ${event || 'Unknown'}`);
    console.log(`📦 Payload UUID: ${uuid || 'N/A'}`);
    
    // Process asynchronously (don't block the response)
    handleLibredeskWebhook(event, payload).catch(err => {
      console.error('Error during webhook background processing:', err);
    });

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
