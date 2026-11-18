import React from 'react';

export const App: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Smart Waste Management</h1>
        <p className="text-gray-600 text-sm mb-4">Phase 0 Contract Freeze & Environment Setup Verified</p>
        <span className="inline-block bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-semibold">
          Demo Mode Ready
        </span>
      </div>
    </div>
  );
};

export default App;
