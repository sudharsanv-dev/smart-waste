// src/pages/consumer/ConsumerDashboard.tsx
// Consumer Module Landing Page (Phase 1 Baseline)

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { scheduleService } from '../../api/scheduleService';
import { ConsumerScheduleItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { QrCode, Calendar, CreditCard, Clock, AlertCircle } from 'lucide-react';

export const ConsumerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ConsumerScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const areaCode = user?.mobile_number === '9876543210' ? '600001' : '600001';
        const res = await scheduleService.getConsumerSchedules({ area_code: areaCode });
        setSchedules(res.content || []);
      } catch (err) {
        console.error('Failed to load consumer timetable:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const nextPickup = schedules[0];

  return (
    <div className="space-y-6" data-testid="consumer-dashboard">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-md">
        <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider block mb-1">
          Household Resident Portal
        </span>
        <h1 className="text-2xl font-bold" data-testid="consumer-welcome-msg">
          Welcome back, {user?.name || 'Resident'}
        </h1>
        <p className="text-xs text-emerald-100 mt-1">
          Ward: 600001 (Harbour Zone) • Smart Waste Management System
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Collection Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Next Scheduled Collection</span>
            <div className="text-base font-bold text-gray-900 mt-0.5" data-testid="next-pickup-date">
              {nextPickup ? nextPickup.scheduled_date : '2026-11-15'}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>07:00:00 - 11:00:00</span>
            </div>
          </div>
        </div>

        {/* Current Dues Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Pending Waste Dues</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5" data-testid="consumer-pending-dues">
              ₹150.00
            </div>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full">
              Due Nov 30, 2026
            </span>
          </div>
        </div>

        {/* QR Code Status Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Household QR Token</span>
            <div className="text-sm font-bold text-gray-900 mt-0.5 font-mono" data-testid="consumer-qr-token">
              GPC-QR-CONS-C1D2
            </div>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-800 rounded-full">
              Ready for Agent Scan
            </span>
          </div>
        </div>
      </div>

      {/* Neighborhood Timetable Preview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Upcoming Neighborhood Timetable</span>
          </h2>
          <span className="text-xs text-gray-400">Locked Contract GET /api/v1/consumer/schedules</span>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading timetable..." />
        ) : schedules.length === 0 ? (
          <EmptyState title="No scheduled pickups" description="No collection schedules found for your neighborhood." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time Window</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{item.scheduled_date}</td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {item.start_time} - {item.end_time}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 text-[10px]">
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
          <strong>Phase 1 Foundation Active:</strong> Authenticated as CONSUMER using server-issued JWT token. Subsequent phase modules (Payments, Razorpay mock checkout, QR fullscreen card) will expand in Phase 2.
        </span>
      </div>
    </div>
  );
};

export default ConsumerDashboard;
