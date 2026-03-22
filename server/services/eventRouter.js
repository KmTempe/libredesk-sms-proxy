const db = require('../db');
const { getSetting } = require('../config');
const { renderTemplate } = require('./templateEngine');
const { sendSMS, isValidPhone } = require('./smsService');

// Normalize tag name to kebab-case
const normalizeTag = (tag) => {
  if (!tag) return '';
  return String(tag).toLowerCase().replace(/\s+/g, '-');
};

/**
 * Logs an event indicating SMS was processed.
 */
function logEvent(data) {
  const { eventType, uuid, ref, phone, smsBody, rawResponse, status, reason } = data;
  const insertLog = db.prepare(`
    INSERT INTO logs (event_type, conversation_uuid, reference_number, contact_phone, sms_body, smsgate_response, status, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLog.run(
    eventType,
    uuid || null,
    ref || null,
    phone || null,
    smsBody || null,
    rawResponse ? JSON.stringify(rawResponse) : null,
    status,
    reason || null
  );
}

/**
 * Checks if a webhook is a duplicate based on the conversation UUID, trigger type, and deduplication window.
 */
function isDuplicate(uuid, triggerType) {
  if (!uuid || !triggerType) return false;

  const dedupKey = triggerType === 'resolved' ? 'sms_dedup_resolved' : 'sms_dedup_waiting';
  const dedupSeconds = parseInt(getSetting(dedupKey) || '0', 10);

  if (dedupSeconds <= 0) return false;

  const row = db.prepare(`
    SELECT created_at FROM logs 
    WHERE conversation_uuid = ? AND event_type = ? AND status = 'sent'
    ORDER BY created_at DESC LIMIT 1
  `).get(uuid, triggerType);

  if (!row) return false;

  const lastSentTime = new Date(row.created_at + 'Z').getTime(); // Ensure UTC context
  const currentTime = Date.now();

  const diffSeconds = (currentTime - lastSentTime) / 1000;
  return diffSeconds < dedupSeconds;
}

/**
 * Main Webhook Processing Logic
 */
async function handleLibredeskWebhook(event, body) {
  const payloadData = body.payload || {};
  const conversation = payloadData.conversation || {};
  let phone = conversation.contact?.phone_number;
  const ref = conversation.reference_number;
  const uuid = payloadData.conversation_uuid;
  const tags = Array.isArray(conversation.tags) ? conversation.tags : [];

  if (phone) {
    phone = String(phone).trim();
    if (!phone.startsWith('+')) {
      phone = `+30${phone}`;
    }
  }

  if (!phone || !isValidPhone(phone)) {
    logEvent({
      eventType: 'skipped',
      uuid, ref, phone,
      status: 'error',
      reason: 'invalid_phone_format'
    });
    return;
  }

  // Rule 1: Resolved status → send resolved template with reply text
  // Rule 2: Closed status  → send waiting template
  let triggerType = null;
  let smsBody = null;
  const newStatus = (payloadData.new_status || '').toLowerCase();

  if (event === 'conversation.status_changed' && newStatus === 'resolved') {
    triggerType = 'resolved';
    const template = getSetting('template_resolved') || 'Your issue #{ref} is resolved. {message}';

    // last_message can be a LibreDesk activity string like "User marked conversation as Resolved"
    // If it looks like an activity entry, discard it and use a clean fallback.
    const rawMessage = (conversation.last_message || '').trim();
    const isActivityMessage = /marked the conversation|marked as|closed the|assigned to|reopened/i.test(rawMessage);
    const messageText = (!rawMessage || isActivityMessage)
      ? `Resolved by l7feeders — Ref #${ref}`
      : rawMessage;

    smsBody = renderTemplate(template, { ref, message: messageText });
  }

  // Rule 3: Tags updated OR Status changed → check for waiting-on-third-party tag
  const hasWaitingTag = tags.some(t => {
    const n = normalizeTag(t);
    return n === 'waiting-on-3rd-party' || n === 'waiting-on-third-party';
  });
  
  const isTagEvent = event === 'conversation.tags_changed' || event === 'conversation.tags_updated' || event === 'conversation.updated';

  if ((event === 'conversation.status_changed' || isTagEvent) && hasWaitingTag) {
    triggerType = 'waiting';
    const template = getSetting('template_waiting') || 'Reminder: Issue #{ref} is waiting on a 3rd party.';
    smsBody = renderTemplate(template, { ref });
  }

  if (!triggerType) {
    // Event not relevant — no logging needed to avoid noise.
    return;
  }

  // Deduplication check
  if (isDuplicate(uuid, triggerType)) {
    logEvent({
      eventType: triggerType,
      uuid, ref, phone, smsBody,
      status: 'skipped',
      reason: 'duplicate'
    });
    return;
  }

  // Send SMS
  try {
    const result = await sendSMS({ phoneNumber: phone, text: smsBody });
    logEvent({
      eventType: triggerType,
      uuid, ref, phone, smsBody,
      rawResponse: result,
      status: 'sent'
    });
  } catch (err) {
    console.error(`Error sending SMS via SMSGate for ${uuid}:`, err.message);
    logEvent({
      eventType: triggerType,
      uuid, ref, phone, smsBody,
      status: 'error',
      reason: err.message
    });
  }
}

module.exports = {
  handleLibredeskWebhook
};
