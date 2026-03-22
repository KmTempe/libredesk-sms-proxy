const { getSetting } = require('../config');
const jwtManager = require('./jwtManager');

/**
 * Validates basic phone format. Must start with + and have 8 to 15 digits.
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const regex = /^\+[0-9]{8,15}$/;
  return regex.test(String(phone).trim());
}

/**
 * Sends an SMS via SMSGate using the correct authentication strategy.
 * @param {Object} params 
 * @param {string} params.phoneNumber
 * @param {string} params.text
 * @returns {Object} JSON response from SMSGate
 */
async function sendSMS({ phoneNumber, text }) {
  if (!isValidPhone(phoneNumber)) {
    throw new Error('invalid_phone_format');
  }

  const url = getSetting('smsgate_url');
  const user = getSetting('smsgate_user');
  const pass = getSetting('smsgate_pass');

  if (!url || !user || !pass) {
    throw new Error('SMSGate configuration is incomplete');
  }

  const isCloudMode = url.includes('api.sms-gate.app');
  let authHeader = '';

  // Cloud: JWT preferred (with Basic fallback). Local: Basic Auth only.
  if (isCloudMode) {
    try {
      const token = await jwtManager.getToken();
      authHeader = `Bearer ${token}`;
    } catch (err) {
      console.warn('JWT failed, falling back to Basic Auth for cloud mode', err.message);
      const credentials = Buffer.from(`${user}:${pass}`).toString('base64');
      authHeader = `Basic ${credentials}`;
    }
  } else {
    const credentials = Buffer.from(`${user}:${pass}`).toString('base64');
    authHeader = `Basic ${credentials}`;
  }

  // Cloud API base is https://api.sms-gate.app/3rdparty/v1 → endpoint: /messages
  // Local API base is http://<ip>:8080 → endpoint: /message (no 3rdparty prefix)
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = isCloudMode ? `${baseUrl}/3rdparty/v1/messages` : `${baseUrl}/message`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({
      phoneNumbers: [phoneNumber],
      textMessage: { text },
      priority: 100,
      ttl: 3600
    })
  });

  if (!response.ok) {
    let errorText = '';
    try {
      const errorData = await response.json();
      errorText = JSON.stringify(errorData);
    } catch (e) {
      errorText = response.statusText;
    }
    throw new Error(`SMSGate error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

module.exports = {
  isValidPhone,
  sendSMS
};
