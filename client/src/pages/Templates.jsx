import { useState, useEffect } from 'react';
import { Save, FileText, Eye } from 'lucide-react';

export default function Templates() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Live preview state 
  const previewRef = '10042';
  const previewMessage = 'We have escalated this to the billing department.';

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data));
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
        body: JSON.stringify({
          template_resolved: settings.template_resolved,
          template_waiting: settings.template_waiting
        })
      });
      setSaveMessage('Templates saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveMessage('Failed to save templates.');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = (templateStr) => {
    if (!templateStr) return '';
    let res = templateStr.replace(/#?\{ref\}/g, previewRef);
    res = res.replace(/\{message\}/g, previewMessage);
    return res;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex justify-between items-center bg-white p-4 shadow rounded-lg mb-6 sticky top-4 z-10 border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SMS Templates</h2>
          <p className="text-sm text-gray-500">Customize the messages sent to contacts.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Templates'}
        </button>
      </div>

      {saveMessage && (
        <div className={`p-4 rounded-md shadow-sm ${saveMessage.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {saveMessage}
        </div>
      )}

      {/* Resolved Template */}
      <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex items-center">
          <FileText className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">Resolved Template</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message Body</label>
            <p className="text-xs text-gray-500 mb-2">
              Available variables: <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{`{ref}`}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{`{message}`}</code>
            </p>
            <textarea
              rows={5}
              value={settings.template_resolved ?? ''}
              onChange={e => handleChange('template_resolved', e.target.value)}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border"
              placeholder="Το αίτημά σας #{ref} επιλύθηκε. {message}"
            />
          </div>
          <div className="bg-gray-50 p-4 justify-between border-l border-gray-200 h-full">
            <h4 className="flex items-center text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
              <Eye className="w-4 h-4 mr-2" /> Live Preview
            </h4>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute top-0 right-0 -mt-2 -mr-2 flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-xs shadow">1</div>
              <p className="text-gray-800 break-words whitespace-pre-wrap font-sans text-sm">
                {renderPreview(settings.template_resolved) || <span className="text-gray-400 italic">Empty template</span>}
              </p>
            </div>
            <p className="mt-4 text-xs text-gray-400">Mock variables applied automatically for preview.</p>
          </div>
        </div>
      </div>

      {/* Waiting Template */}
      <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex items-center">
          <FileText className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">Waiting on 3rd Party Template</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message Body</label>
            <p className="text-xs text-gray-500 mb-2">
              Available variables: <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{`{ref}`}</code>
            </p>
            <textarea
              rows={5}
              value={settings.template_waiting ?? ''}
              onChange={e => handleChange('template_waiting', e.target.value)}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border"
              placeholder="Υπενθύμιση: Το αίτημά σας #{ref} αναμένει τρίτο μέρος."
            />
          </div>
          <div className="bg-gray-50 p-4 border-l border-gray-200 h-full">
            <h4 className="flex items-center text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
              <Eye className="w-4 h-4 mr-2" /> Live Preview
            </h4>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative">
              <div className="absolute top-0 right-0 -mt-2 -mr-2 flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-xs shadow">1</div>
              <p className="text-gray-800 break-words whitespace-pre-wrap font-sans text-sm">
                {renderPreview(settings.template_waiting) || <span className="text-gray-400 italic">Empty template</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
