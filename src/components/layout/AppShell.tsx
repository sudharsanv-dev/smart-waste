// src/components/layout/AppShell.tsx
// Responsive application shell with role-aware navigation, notification drawer, and demo tools

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationDrawer } from '../notifications/NotificationDrawer';
import { ResetDemoDataControl } from '../demo/ResetDemoDataControl';
import { ENABLE_DEMO_TOOLS } from '../../lib/env';
import {
  Bell,
  LogOut,
  Calendar,
  LayoutDashboard,
  QrCode,
  CreditCard,
  Truck,
  Users,
  Settings,
  ShieldAlert,
} from 'lucide-react';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, logout, simulateExpiry } = useAuth();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = {
    CONSUMER: [
      { label: 'Dashboard', path: '/consumer', icon: LayoutDashboard },
      { label: 'Timetable', path: '/consumer/schedules', icon: Calendar },
      { label: 'Payments', path: '/consumer/payments', icon: CreditCard },
      { label: 'My QR', path: '/consumer/qr', icon: QrCode },
    ],
    AGENT: [
      { label: 'Assignments', path: '/agent', icon: LayoutDashboard },
      { label: 'Route', path: '/agent/schedules', icon: Calendar },
      { label: 'Scan QR', path: '/agent/scan', icon: QrCode },
      { label: 'Requests', path: '/agent/requests', icon: Truck },
    ],
    ADMIN: [
      { label: 'Overview', path: '/admin', icon: LayoutDashboard },
      { label: 'Schedules', path: '/admin/schedules', icon: Calendar },
      { label: 'Users', path: '/admin/customers', icon: Users },
      { label: 'Banking', path: '/admin/banking', icon: Settings },
    ],
  }[role || 'CONSUMER'] || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              ♻️
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm sm:text-base leading-tight block">
                SmartWaste
              </span>
              <span className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
                GreenPulse City
              </span>
            </div>
            <span
              data-testid="user-role-badge"
              className={`ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-800'
                  : role === 'AGENT'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {role}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/consumer' || item.path === '/agent' || item.path === '/admin'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Icons & Controls */}
          <div className="flex items-center gap-2">
            {ENABLE_DEMO_TOOLS && (
              <>
                <ResetDemoDataControl />
                <button
                  type="button"
                  onClick={simulateExpiry}
                  data-testid="simulate-expire-btn"
                  title="Simulate 401 Session Expiry"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Simulate 401</span>
                </button>
              </>
            )}

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotifOpen(true)}
              data-testid="notifications-bell-btn"
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg focus:outline-none"
              aria-label="Open notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span
                  data-testid="notifications-unread-badge"
                  className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white"
                />
              )}
            </button>

            {/* User Info & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <span className="text-xs font-semibold text-gray-700 hidden sm:inline-block" data-testid="user-display-name">
                {user?.name || user?.username}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                data-testid="logout-btn"
                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus:outline-none"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex justify-around py-2 px-1 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/consumer' || item.path === '/agent' || item.path === '/admin'}
              className={({ isActive }) =>
                `flex flex-col items-center py-1 px-3 text-[10px] font-medium rounded-lg ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Slide-over Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onUnreadCountChange={(c) => setUnreadCount(c)}
      />
    </div>
  );
};

export default AppShell;
