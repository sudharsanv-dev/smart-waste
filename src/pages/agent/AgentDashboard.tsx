// src/pages/agent/AgentDashboard.tsx
// Collection Agent Module Landing Page (Phase 1 Baseline)

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { scheduleService } from '../../api/scheduleService';
import { AgentScheduleItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { Truck, Calendar, Clock, Send, AlertCircle } from 'lucide-react';
import { notificationService } from '../../api/notificationService';

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<AgentScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifyStatus, setNotifyStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await scheduleService.getAgentSchedules({ start_date: '2026-11-15', end_date: '2026-11-30' });
        setSchedules(res.content || []);
      } catch (err) {
        console.error('Failed to load agent schedules:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleNotifyArrival = async () => {
    try {
      setNotifyStatus('Sending notification...');
      const res = await notificationService.sendAgentNotification({
        title: 'Agent Arriving Soon',
        body: 'Your waste collection agent is 5 minutes away.',
        target_user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
      });
      setNotifyStatus(`Dispatched: ${res.status} (ID: ${res.dispatch_id.slice(0, 12)}...)`);
      setTimeout(() => setNotifyStatus(null), 4000);
    } catch {
      setNotifyStatus('Failed to dispatch notification');
    }
  };

  return (
    <div className="space-y-6" data-testid="agent-dashboard">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md">
        <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider block mb-1">
          Field Collection Agent Portal
        </span>
        <h1 className="text-2xl font-bold" data-testid="agent-welcome-msg">
          Welcome back, {user?.name || 'Agent'}
        </h1>
        <p className="text-xs text-blue-200 mt-1">
          Vehicle: TN-01-WM-4042 • Assigned Wards: 600001, 600040
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Route */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Today's Assigned Route</span>
            <div className="text-base font-bold text-gray-900 mt-0.5" data-testid="agent-active-area">
              Ward 600001 (Harbour Zone)
            </div>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded-full">
              Route Active
            </span>
          </div>
        </div>

        {/* Assigned Shift Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Shift Window</span>
            <div className="text-base font-bold text-gray-900 mt-0.5">
              07:00:00 - 11:00:00
            </div>
            <span className="text-xs text-gray-500 block mt-0.5">Assigned Shift 1</span>
          </div>
        </div>

        {/* Quick Notify Arrival Action */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-500">Notify Household Arrival</span>
            <button
              type="button"
              onClick={handleNotifyArrival}
              data-testid="notify-arrival-btn"
              className="mt-2 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast "5 Mins Away"</span>
            </button>
            {notifyStatus && (
              <span className="text-[10px] text-blue-800 font-medium mt-1 block" data-testid="notify-status">
                {notifyStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Assigned Tasks Table */}
      <div data-testid="agent-routes-card" className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Assigned Shift Schedules (Root-Paginated)</span>
          </h2>
          <span className="text-xs text-gray-400">Locked Contract GET /api/v1/agent/schedules</span>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading assignments..." />
        ) : schedules.length === 0 ? (
          <EmptyState title="No assigned routes" description="You have no route assignments for today." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Schedule ID</th>
                  <th className="py-2.5 px-3">Area Code</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-mono text-gray-600">{item.id.slice(0, 8)}...</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{item.area_code}</td>
                    <td className="py-2.5 px-3 text-gray-600">{item.scheduled_date}</td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {item.start_time} - {item.end_time}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 text-[10px]">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Phase 1 Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-xs flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <span>
          <strong>Phase 1 Foundation Active:</strong> Authenticated as AGENT. QR scanning camera workflows and manual pickup request claiming will be fully wired in Phase 3.
        </span>
      </div>
    </div>
  );
};

export default AgentDashboard;
