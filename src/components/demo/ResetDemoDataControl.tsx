// src/components/demo/ResetDemoDataControl.tsx
// Demo-only control to reset mock state to deterministic seed
// Hidden strictly in production builds (Rule 5 & Phase 0 requirements)

import React, { useState } from 'react';
import { ENABLE_DEMO_TOOLS, IS_DEMO } from '../../lib/env';
import { resetDemoData } from '../../api/mockStore';

interface ResetDemoDataControlProps {
  onReset?: () => void;
  className?: string;
}

export const ResetDemoDataControl: React.FC<ResetDemoDataControlProps> = ({ onReset, className = '' }) => {
  // Never expose this control in live production mode or when demo tools are disabled
  if (!IS_DEMO || !ENABLE_DEMO_TOOLS) {
    return null;
  }

  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleReset = () => {
    setIsResetting(true);
    try {
      resetDemoData();
      setResetMessage('Reset successful');
      if (onReset) onReset();
      setTimeout(() => setResetMessage(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to reset demo data:', err);
      setResetMessage('Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} data-testid="demo-reset-container">
      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        data-testid="reset-demo-data-btn"
        className="px-3 py-1.5 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
      >
        {isResetting ? 'Resetting...' : '🔄 Reset Demo Data'}
      </button>
      {resetMessage && (
        <span data-testid="reset-demo-status" className="text-xs text-amber-800 font-medium animate-fade-in">
          {resetMessage}
        </span>
      )}
    </div>
  );
};

export default ResetDemoDataControl;
