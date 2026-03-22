import { useState, useEffect } from 'react';
import { Save, Key, Globe, Clock, Link as LinkIcon, Send } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [testPhone, setTestPhone] = useState('6900000000');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        if (data.testphone) setTestPhone(data.testphone);
      });
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const phone = encodeURIComponent(testPhone.trim());
      const res = await fetch(`/api/smsgate/test-connection?phone=${phone}`);
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, message: 'Request failed: ' + e.message });
    } finally {
      setTesting(false);
    }
  };

  const isCloud = (settings.smsgate_url || '').includes('api.sms-gate.app');
  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '3400'}/webhooks/smsgate`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div className="flex justify-between items-center bg-white p-4 shadow rounded-lg mb-6 sticky top-4 z-10 border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500">Configure connection and deduplication rules.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      {saveMessage && (
        <div className={`p-4 rounded-md shadow-sm ${saveMessage.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {saveMessage}
        </div>
      )}

      {/* SMSGate Connection */}
      <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center">
            <Globe className="w-5 h-5 text-gray-500 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">SMSGate Connection</h3>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isCloud ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
            Auto-detected: {isCloud ? 'CLOUD (JWT)' : 'LOCAL (Basic Auth)'}
          </span>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Server URL</label>
            <div className="mt-1">
              <input
                type="text"
                value={settings.smsgate_url || ''}
                onChange={e => handleChange('smsgate_url', e.target.value)}
                placeholder="http://192.168.1.100:8080 or https://api.sms-gate.app"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="mt-1">
                <input
                  type="text"
                  value={settings.smsgate_user || ''}
                  onChange={e => handleChange('smsgate_user', e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  value={settings.smsgate_pass || ''}
                  onChange={e => handleChange('smsgate_pass', e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                />
              </div>
            </div>
          </div>
          {/* Test Connection */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Test — Send Real SMS</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="6932980297 (auto-prefixed with +30)"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
              />
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Send className="w-4 h-4 mr-2" />
                {testing ? 'Sending...' : 'Test Connection'}
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 flex items-center gap-2 text-sm p-2 rounded-md ${
                testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <span>{testResult.ok ? '✅' : '❌'}</span>
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LibreDesk Webhook Settings */}
      <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex items-center">
          <LinkIcon className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">LibreDesk Webhook Configuration</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Setup Instructions for LibreDesk</h4>
            <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
              <li>URL: <span className="font-mono bg-blue-100 px-1 py-0.5 rounded">{webhookUrl}</span></li>
              <li>Events: <strong>conversation.status_changed</strong>, <strong>conversation.updated</strong></li>
            </ul>
          </div>
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Key className="w-4 h-4 mr-2" />
              Webhook Secret (HMAC-SHA256)
            </label>
            <div className="mt-1">
              <input
                type="text"
                value={settings.libredesk_secret || ''}
                onChange={e => handleChange('libredesk_secret', e.target.value)}
                placeholder="Leave blank to skip validation or paste your LibreDesk secret"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Deduplication Windows */}
      <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex items-center">
          <Clock className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">Deduplication Windows</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <p className="text-sm text-gray-500">Prevent spamming your users. Set cooldowns in seconds.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Resolved Trigger (seconds)</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  value={settings.sms_dedup_resolved || ''}
                  onChange={e => handleChange('sms_dedup_resolved', e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">sec</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">Default: 86400 (24h)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Waiting Trigger (seconds)</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  value={settings.sms_dedup_waiting || ''}
                  onChange={e => handleChange('sms_dedup_waiting', e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">sec</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">Default: 3600 (1h)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
