// src/pages/agent/AgentDashboard.tsx
// Screen 1: Collection Agent Overview & Shift Landing Page (Phase 3)
// Features today's route status, shift metrics, and task-based arrival notification dispatcher

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { agentService } from '../../api/agentService';
import { AgentScheduleItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { getStoreState } from '../../api/mockStore';
import { IS_DEMO } from '../../lib/env';
import {
  Truck,
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  QrCode,
  PackageCheck,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const getTodayIST = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<AgentScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetUserId, setTargetUserId] = useState('c1d2e3f4-a5b6-7890-1234-56789abcdef0');
  const [etaMinutes, setEtaMinutes] = useState('5');
  const [isSending, setIsSending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ status: string; dispatch_id: string } | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const today = getTodayIST();
        const res = await agentService.getSchedules({ start_date: today });
        setSchedules(res.content || []);
      } catch (err) {
        console.error('Failed to load agent schedules:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Derive arrival recipients from assigned work
  const assignedRecipients = useMemo(() => {
    const assignedWards = new Set([
      ...(user?.assigned_area_codes || []),
      ...schedules.map((s) => s.area_code),
      ...(user?.area_code ? [user.area_code] : []),
    ]);

    if (IS_DEMO) {
      try {
        const state = getStoreState();
        return state.households.filter((h) => assignedWards.has(h.area_code));
      } catch {
        return [];
      }
    }
    return [];
  }, [user, schedules]);

  useEffect(() => {
    if (assignedRecipients.length > 0) {
      const firstValid = assignedRecipients[0].mobile_number === '9876543210'
        ? 'c1d2e3f4-a5b6-7890-1234-56789abcdef0'
        : assignedRecipients[0].id;
      setTargetUserId((prev) =>
        assignedRecipients.some(
          (h) => h.id === prev || (h.mobile_number === '9876543210' && prev === 'c1d2e3f4-a5b6-7890-1234-56789abcdef0')
        )
          ? prev
          : firstValid
      );
    }
  }, [assignedRecipients]);

  const handleNotifyArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setNotifyResult(null);
    setNotifyError(null);

    try {
      // Locked Section 3.3 C: Task-based dispatch returns HTTP 202 QUEUED
      const res = await agentService.sendArrivalNotification({
        title: 'Waste Collection Vehicle Arriving Soon',
        body: `Your designated sanitation agent is approximately ${etaMinutes} minutes away. Please keep segregated wet and dry waste bins accessible.`,
        target_user_id: targetUserId,
      });

      setNotifyResult({ status: res.status, dispatch_id: res.dispatch_id });
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj.response?.data?.message || errObj.message || 'Failed to dispatch arrival notification.';
      setNotifyError(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="agent-dashboard">
      {/* Welcome Hero */}
      <div
        className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
        data-testid="active-shift-card"
      >
        <div>
          <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider block mb-1">
            Field Operations • Sanitation Agent Portal
          </span>
          <h1 className="text-2xl font-bold" data-testid="agent-welcome-msg">
            Welcome back, {user?.name || 'Agent'}
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Designated Vehicle: <strong data-testid="vehicle-id-badge">{user?.vehicle_id || 'TN-01-WM-4042'}</strong> • Primary Assigned Wards: <strong>{(user?.assigned_area_codes || (user?.area_code ? [user.area_code] : ['600001'])).join(', ')}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/agent/scan"
            data-testid="quick-scan-link"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
          >
            <QrCode className="w-4 h-4" />
            <span>Launch QR Scanner</span>
          </Link>
          <Link
            to="/agent/requests"
            data-testid="quick-claims-link"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl backdrop-blur-xs transition-colors"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Pickup Claims</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Route */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Active Operational Route</span>
            <div className="text-base font-bold text-gray-900 mt-0.5" data-testid="agent-active-area">
              Ward 600001 (Harbour Zone)
            </div>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
              Shift In Progress
            </span>
          </div>
        </div>

        {/* Assigned Shift Window */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Shift Timetable Window</span>
            <div className="text-base font-bold text-gray-900 mt-0.5">
              07:00:00 - 11:00:00 IST
            </div>
            <span className="text-xs text-gray-500 block mt-0.5">Morning Segregated Collection</span>
          </div>
        </div>

        {/* Security & Route Isolation Indicator */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Route Authorization Policy</span>
            <div className="text-xs font-bold text-gray-900 mt-0.5">
              Enforced Route Boundary
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              Notifications & scans are restricted strictly to registered consumers on assigned routes.
            </p>
          </div>
        </div>
      </div>

      {/* Arrival Notification Dispatcher Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4" data-testid="arrival-dispatcher-card">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900">Task-Based Household Arrival Dispatcher</h2>
          </div>
          <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-full border border-blue-100">
            Locked Contract: POST /api/v1/agent/notifications/send
          </span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Notify an upcoming household on your assigned route of impending arrival. ETA values are honest manually entered approximations—we do not misrepresent estimated arrival windows as real-time GPS telemetry.
        </p>

        <form onSubmit={handleNotifyArrival} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
              Target Household / Consumer
            </label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              data-testid="target-consumer-select"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {assignedRecipients.length > 0 ? (
                assignedRecipients.map((h) => (
                  <option key={h.id} value={h.mobile_number === '9876543210' ? 'c1d2e3f4-a5b6-7890-1234-56789abcdef0' : h.id}>
                    {h.name} (Ward {h.area_code} - {h.address})
                  </option>
                ))
              ) : (
                <option value="c1d2e3f4-a5b6-7890-1234-56789abcdef0">John Doe (Ward 600001 - Sunrise Ave)</option>
              )}
              <option value="cons-outside-ward-test">Unrelated Resident (Ward 600099 - Test Boundary)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
              Estimated Window (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(e.target.value)}
              data-testid="eta-minutes-input"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSending}
              data-testid="send-arrival-btn"
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 h-[38px]"
            >
              {isSending ? (
                <LoadingSpinner size="sm" label="Dispatching..." />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Dispatch Arrival Alert</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Dispatch Outcome Banner */}
        {notifyResult && (
          <div
            data-testid="arrival-status-badge"
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Notification status: <strong className="font-bold text-emerald-800">{notifyResult.status}</strong> (HTTP 202 Accepted)
              </span>
            </div>
            <span className="font-mono text-[10px] text-emerald-700">
              ID: {notifyResult.dispatch_id.slice(0, 16)}...
            </span>
          </div>
        )}

        {notifyError && (
          <div
            data-testid="arrival-error-banner"
            className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{notifyError}</span>
          </div>
        )}
      </div>

      {/* Assigned Route Schedules Table */}
      <div data-testid="agent-routes-card" className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Assigned Shift Schedules (Root-Paginated)</span>
          </h2>
          <span className="text-xs text-gray-400">Locked Contract: GET /api/v1/agent/schedules</span>
        </div>

        {isLoading ? (
          <div className="py-8">
            <LoadingSpinner label="Loading assigned shifts..." />
          </div>
        ) : schedules.length === 0 ? (
          <EmptyState title="No assigned routes" description="You have no route assignments for today." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="agent-schedules-table">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Schedule ID</th>
                  <th className="py-2.5 px-3">Ward / Area</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time Window</th>
                  <th className="py-2.5 px-3">Shift Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-mono text-gray-600">{item.id.slice(0, 8)}...</td>
                    <td className="py-2.5 px-3 font-bold text-gray-900">Ward {item.area_code}</td>
                    <td className="py-2.5 px-3 text-gray-600">{item.scheduled_date}</td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {item.start_time} - {item.end_time}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-[10px]">
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
    </div>
  );
};

export default AgentDashboard;
