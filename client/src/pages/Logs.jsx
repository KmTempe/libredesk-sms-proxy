import { useState, useEffect } from 'react';
import { Filter, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs(page, statusFilter);
  }, [page, statusFilter]);

  const fetchLogs = async (currentPage, currentFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?page=${currentPage}&limit=50&status=${currentFilter}`);
      const json = await res.json();
      setLogs(json.data || []);
      setPagination(json.pagination || { totalPages: 1, total: 0 });
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear ALL logs? This cannot be undone.')) return;
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setPage(1);
      fetchLogs(1, statusFilter);
    } catch (e) {
      console.error('Failed to clear logs', e);
    }
  };

  const handleFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Logs</h2>
          <p className="text-sm text-gray-500">View and filter previous SMS notification events.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3" />
            <select
              value={statusFilter}
              onChange={handleFilterChange}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="skipped">Skipped</option>
              <option value="error">Error</option>
            </select>
          </div>
          <button
            onClick={clearLogs}
            className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All Logs
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMS Body</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500">No logs found matching criteria.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at + 'Z').toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{log.reference_number || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.contact_phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.status === 'sent' && <span className="inline-flex px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">Sent</span>}
                      {log.status === 'error' && (
                        <span className="inline-flex px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold" title={log.reason}>
                          Error
                        </span>
                      )}
                      {log.status === 'skipped' && (
                        <span className="inline-flex px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold" title={log.reason}>
                          Skipped
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {log.status === 'error' && <span className="text-red-600 font-medium">{log.reason || '-'}</span>}
                      {log.status === 'skipped' && <span className="text-yellow-600 font-medium">{log.reason || '-'}</span>}
                      {log.status === 'sent' && <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.sms_body}>
                      {log.sms_body || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.smsgate_response}>
                      {log.smsgate_response || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{pagination.totalPages}</span>
                {' '} ({pagination.total} total logs)
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages || pagination.totalPages === 0}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
