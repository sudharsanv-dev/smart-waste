import React, { useState } from 'react';
import { APP_MODE, USE_MOCK_API, ENABLE_DEMO_TOOLS, OPERATIONAL_TIMEZONE } from './lib/env';
import { ResetDemoDataControl } from './components/demo/ResetDemoDataControl';

export const App: React.FC = () => {
  const [, setRefreshKey] = useState(0);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Smart Waste Management</h1>
        <p className="text-gray-600 text-sm mb-4">Phase 0 Contract Freeze & Environment Setup Verified</p>
        
        <div className="space-y-2 mb-4 text-xs text-left bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">Mode:</span>
            <span className="font-semibold text-gray-800" data-testid="app-mode">{APP_MODE}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">Mock API:</span>
            <span className="font-semibold text-gray-800" data-testid="mock-api">{USE_MOCK_API ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">Demo Tools:</span>
            <span className="font-semibold text-gray-800" data-testid="demo-tools">{ENABLE_DEMO_TOOLS ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">Timezone:</span>
            <span className="font-semibold text-gray-800" data-testid="timezone">{OPERATIONAL_TIMEZONE}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <span className="inline-block bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-semibold" data-testid="status-badge">
            {APP_MODE === 'demo' ? 'Demo Mode Ready' : 'Production Active'}
          </span>

          {/* Demo-only reset control (hidden strictly in production builds) */}
          <ResetDemoDataControl onReset={() => setRefreshKey((k) => k + 1)} className="mt-2" />
        </div>
      </div>
    </div>
  );
};

export default App;
