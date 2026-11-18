// src/pages/auth/UnifiedLoginPage.tsx
// Unified Login Page supporting CONSUMER, AGENT, and ADMIN with exact Section 3.1 contracts

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole, AuthLoginRequest } from '../../types/contracts';
import { ENABLE_DEMO_TOOLS } from '../../lib/env';
import { ErrorState, LoadingSpinner } from '../../components/layout/LoadingEmptyError';
import { LogIn, Key, Phone, User, Zap } from 'lucide-react';

export const UnifiedLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<UserRole>('CONSUMER');
  const [mobileNumber, setMobileNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleRoleTabChange = (role: UserRole) => {
    setActiveTab(role);
    setErrorMessage(null);
    setPassword('');
    if (role === 'ADMIN') {
      setUsername('');
    } else {
      setMobileNumber('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    let payload: AuthLoginRequest;
    if (activeTab === 'ADMIN') {
      payload = {
        username: username.trim(),
        password,
        type: 'ADMIN',
      };
    } else if (activeTab === 'AGENT') {
      payload = {
        mobile_number: mobileNumber.trim(),
        password,
        type: 'AGENT',
      };
    } else {
      payload = {
        mobile_number: mobileNumber.trim(),
        password,
        type: 'CONSUMER',
      };
    }

    try {
      const authData = await login(payload);
      // Route strictly based on the server-returned role
      const targetPath =
        fromPath && fromPath !== '/login'
          ? fromPath
          : {
              CONSUMER: '/consumer',
              AGENT: '/agent',
              ADMIN: '/admin',
            }[authData.role];

      navigate(targetPath, { replace: true });
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : 'Invalid username/mobile number or password';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Login (visible only in demo mode when ENABLE_DEMO_TOOLS=true)
  const handleQuickDemoLogin = async (role: UserRole) => {
    setIsLoading(true);
    setErrorMessage(null);

    let payload: AuthLoginRequest;
    if (role === 'ADMIN') {
      payload = { username: 'admin', password: 'Admin@123', type: 'ADMIN' };
    } else if (role === 'AGENT') {
      payload = { mobile_number: '9876543210', password: 'Agent@123', type: 'AGENT' };
    } else {
      payload = { mobile_number: '9876543210', password: 'Consumer@123', type: 'CONSUMER' };
    }

    try {
      const authData = await login(payload);
      const targetPath = {
        CONSUMER: '/consumer',
        AGENT: '/agent',
        ADMIN: '/admin',
      }[authData.role];
      navigate(targetPath, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo login failed';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-6 text-white text-center">
          <div className="inline-flex w-12 h-12 rounded-xl bg-white/20 items-center justify-center text-2xl mb-2 backdrop-blur-xs">
            ♻️
          </div>
          <h1 className="text-xl font-bold tracking-tight">Smart Waste Management</h1>
          <p className="text-xs text-emerald-100 mt-1">GreenPulse City Municipality Portal</p>
        </div>

        {/* Role Selection Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50 p-1">
          {(['CONSUMER', 'AGENT', 'ADMIN'] as UserRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleTabChange(role)}
              data-testid={`tab-${role.toLowerCase()}`}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === role
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {role === 'CONSUMER' ? 'Resident' : role === 'AGENT' ? 'Field Agent' : 'Admin'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4">
              <ErrorState title="Authentication Failed" message={errorMessage} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            {activeTab === 'ADMIN' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="username-input">
                  Admin Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    id="username-input"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    data-testid="username-input"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="mobile-input">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    id="mobile-input"
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="10-digit mobile number"
                    data-testid="mobile-input"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="password-input">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  id="password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="password-input"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              data-testid="login-submit-btn"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" label="Signing in..." />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as {activeTab}</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login (Only in demo mode) */}
          {ENABLE_DEMO_TOOLS && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold mb-2">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Quick Demo Login (Demo Only):</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('CONSUMER')}
                  data-testid="quick-login-consumer"
                  className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-md transition-colors"
                >
                  Consumer
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('AGENT')}
                  data-testid="quick-login-agent"
                  className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold rounded-md transition-colors"
                >
                  Agent
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('ADMIN')}
                  data-testid="quick-login-admin"
                  className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold rounded-md transition-colors"
                >
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;
