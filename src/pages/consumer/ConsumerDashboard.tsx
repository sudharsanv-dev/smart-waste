// src/pages/consumer/ConsumerDashboard.tsx
// Screen 1: Consumer Dashboard Overview (Phase 2)
// Dues in INR, next collection, recent collections, and quick actions from shared state

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { consumerService } from '../../api/consumerService';
import { ConsumerDashboardResponse } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { QrCode, Calendar, CreditCard, Clock, Truck, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export const ConsumerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ConsumerDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const res = await consumerService.getDashboard();
        setData(res);
      } catch (err) {
        console.error('Failed to load consumer dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, [user]);

  if (isLoading) {
    return <LoadingSpinner label="Loading dashboard data..." />;
  }

  const pendingAmount = data?.pending_amount ?? 0;
  const nextSchedule = data?.next_schedule;
  const recentPickups = data?.recent_pickups || [];
  const qrPayload = data?.qr_payload || user?.qr_payload || 'GPC-QR-CONS-DEFAULT';

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
          Ward: <span className="font-semibold">{user?.area_code || '600001'}</span> • GreenPulse City Smart Sanitation
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Collection Card */}
        <div data-testid="pickup-timetable-card" className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Next Scheduled Collection</span>
              {nextSchedule ? (
                <>
                  <div className="text-base font-bold text-gray-900 mt-0.5" data-testid="next-pickup-date">
                    {nextSchedule.scheduled_date}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {nextSchedule.start_time} - {nextSchedule.end_time}
                    </span>
                  </div>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                    {nextSchedule.status}
                  </span>
                </>
              ) : (
                <div className="text-xs text-gray-500 mt-2">
                  No upcoming collections scheduled for your ward.
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50">
            <Link
              to="/consumer/schedule"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>View full timetable</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Waste Dues Card */}
        <div data-testid="consumer-dues-card" className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              pendingAmount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Outstanding Waste Dues</span>
              <div className="text-2xl font-bold text-gray-900 mt-0.5" data-testid="consumer-pending-dues">
                ₹{pendingAmount.toFixed(2)}
              </div>
              {pendingAmount > 0 ? (
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full">
                  Due by {data?.due_date || 'Nov 30, 2026'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>All Dues Cleared</span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50">
            <Link
              to="/consumer/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>{pendingAmount > 0 ? 'Pay now' : 'View payment history'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* QR Code Quick Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Household QR Token</span>
              <div className="text-xs font-mono font-bold text-gray-900 mt-1 break-all" data-testid="consumer-qr-token">
                {qrPayload}
              </div>
              <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-800 rounded-full">
                Ready for Agent Scan
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50">
            <Link
              to="/consumer/qr"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span>Display fullscreen QR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/consumer/payments"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 hover:shadow-xs transition-all text-center flex flex-col items-center gap-2"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800">Pay Waste Dues</span>
        </Link>

        <Link
          to="/consumer/schedule"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 hover:shadow-xs transition-all text-center flex flex-col items-center gap-2"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800">Neighborhood Timetable</span>
        </Link>

        <Link
          to="/consumer/requests"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 hover:shadow-xs transition-all text-center flex flex-col items-center gap-2"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800">Request Pickup</span>
        </Link>

        <Link
          to="/consumer/support"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 hover:shadow-xs transition-all text-center flex flex-col items-center gap-2"
        >
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800">Help & Support</span>
        </Link>
      </div>

      {/* Recent Collections Feed */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-600" />
          <span>Recent Waste Collections for Your Household</span>
        </h2>

        {recentPickups.length === 0 ? (
          <EmptyState
            title="No past collections recorded"
            description="Your household has no recorded pickup events yet. Once an agent scans your QR code during collection, records will appear here."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {recentPickups.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    Collection on {item.date}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Agent: {item.agent_name || 'Sanitation Agent'} • Weight: {item.waste_weight_kg ? `${item.waste_weight_kg} kg` : 'Standard'}
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsumerDashboard;
