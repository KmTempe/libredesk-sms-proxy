import { useState } from 'react';
import { LayoutDashboard, Settings as SettingsIcon, FileText, List, MessageSquare } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import Logs from './pages/Logs';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
    { name: 'Settings', id: 'settings', icon: SettingsIcon },
    { name: 'Templates', id: 'templates', icon: FileText },
    { name: 'Logs', id: 'logs', icon: List },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'settings': return <Settings />;
      case 'templates': return <Templates />;
      case 'logs': return <Logs />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <MessageSquare className="w-6 h-6 text-indigo-600 mr-2" />
          <h1 className="text-lg font-bold text-gray-900 leading-tight">LibreDesk SMS Proxy</h1>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-700' : 'text-gray-400'}`} />
                {item.name}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
