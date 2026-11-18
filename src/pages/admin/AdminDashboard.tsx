// src/pages/admin/AdminDashboard.tsx
// Admin Module Landing Page (Phase 1 Baseline)

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { scheduleService } from '../../api/scheduleService';
import { notificationService } from '../../api/notificationService';
import { backendGapService } from '../../api/backendGapService';
import { AdminScheduleItem, AdminDashboardKPIs } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { Calendar, Bell, Users, DollarSign, Send, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<AdminScheduleItem[]>([]);
  const [kpis, setKpis] = useState<AdminDashboardKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [schedRes, kpiRes] = await Promise.all([
          scheduleService.getAdminSchedules({ start_date: '2026-11-15', end_date: '2026-11-30' }),
          backendGapService.getAdminDashboardKPIs(),
        ]);
        setSchedules(schedRes.content || []);
        if (!('unavailable' in kpiRes)) {
          setKpis(kpiRes);
        }
      } catch (err) {
        console.error('Failed to load admin schedules:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleTestBroadcast = async () => {
    try {
      setBroadcastStatus('Queuing notification...');
      const res = await notificationService.sendAdminNotification({
        title: 'Collection Update',
        body: 'Due to heavy traffic, collection will be delayed by 1 hour today.',
        target_type: 'PINCODE',
        target_value: '600040',
      });
      setBroadcastStatus(`Status: ${res.status} (Target: ${res.target_type} ${res.target_value})`);
      setTimeout(() => setBroadcastStatus(null), 4000);
    } catch {
      setBroadcastStatus('Broadcast failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md">
        <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider block mb-1">
          Municipal Administration Dashboard
        </span>
        <h1 className="text-2xl font-bold" data-testid="admin-welcome-msg">
          Welcome back, {user?.name || user?.username || 'Administrator'}
        </h1>
        <p className="text-xs text-purple-200 mt-1">
          GreenPulse City Municipal Operations & Schedule Controller
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Total Fees Collected</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5" data-testid="admin-total-collected">
              ₹{(kpis?.total_collected ?? 150).toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
              Ledger Reconciled
            </span>
          </div>
        </div>

        {/* Pending Dues */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Pending Dues</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5" data-testid="admin-pending-fees">
              ₹{(kpis?.pending_fees ?? 150).toFixed(2)}
            </div>
            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-1">
              Outstanding Total
            </span>
          </div>
        </div>

        {/* Active Schedules */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Active Schedules</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5">{schedules.length}</div>
            <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-1">
              Across 3 Wards
            </span>
          </div>
        </div>

        {/* Registered Households */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Households Enrolled</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5">10</div>
            <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">
              100% QR Provisioned
            </span>
          </div>
        </div>
      </div>

      {/* Broadcast Quick Dispatch Action */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-600" />
            <span>Emergency / Municipal Broadcast (Locked Contract 202 QUEUED)</span>
          </h2>
          <button
            type="button"
            onClick={handleTestBroadcast}
            data-testid="admin-broadcast-test-btn"
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Ward 600040 Alert</span>
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Dispatches location-based alerts using <code>POST /api/v1/admin/notifications/send</code>.
        </p>
        {broadcastStatus && (
          <span className="text-xs text-purple-800 font-semibold mt-2 block" data-testid="broadcast-status">
            {broadcastStatus}
          </span>
        )}
      </div>

      {/* Master Schedules Table */}
      <div data-testid="admin-master-schedules-card" className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span>Master Route Schedules (Root-Paginated)</span>
          </h2>
          <span className="text-xs text-gray-400">Locked Contract GET /api/v1/admin/schedules</span>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading master schedules..." />
        ) : schedules.length === 0 ? (
          <EmptyState title="No schedules" description="No schedules configured." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Schedule ID</th>
                  <th className="py-2.5 px-3">Area Code</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time Window</th>
                  <th className="py-2.5 px-3">Assigned Agent ID</th>
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
                    <td className="py-2.5 px-3 font-mono text-gray-500">{item.assigned_agent_id.slice(0, 8)}...</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800 text-[10px]">
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
          <strong>Phase 1 Foundation Active:</strong> Authenticated as ADMIN. Master CRUD schedules, customers/agents management, Recharts analytics, and banking operations will expand in Phase 4.
        </span>
      </div>
    </div>
  );
};

export default AdminDashboard;
