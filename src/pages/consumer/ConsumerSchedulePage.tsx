// src/pages/consumer/ConsumerSchedulePage.tsx
// Screen 2: Consumer Neighborhood Timetable (Phase 2)
// Calls locked contract GET /api/v1/consumer/schedules with consumer's area_code, date filter, and local timezone handling

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { consumerService } from '../../api/consumerService';
import { ConsumerScheduleItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { Calendar, Clock, MapPin, Filter, Info } from 'lucide-react';

export const ConsumerSchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ConsumerScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const areaCode = user?.area_code || '600001';

  useEffect(() => {
    async function fetchSchedules() {
      setIsLoading(true);
      try {
        const res = await consumerService.getSchedules(areaCode);
        setSchedules(res.content || []);
      } catch (err) {
        console.error('Failed to load consumer schedules:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSchedules();
  }, [areaCode]);

  const filtered = schedules.filter((s) => {
    if (dateFilter && s.scheduled_date !== dateFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6" data-testid="consumer-schedule-page">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Neighborhood Waste Collection Timetable</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Showing official collection shifts for Ward <strong className="text-gray-900">{areaCode}</strong>
            </span>
          </p>
        </div>

        {/* Timezone Indicator */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-[11px] text-emerald-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            Operational Timezone: <strong>Asia/Kolkata (IST, UTC+05:30)</strong>
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <Filter className="w-4 h-4 text-gray-400" />
          <span>Filter Timetable:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              data-testid="schedule-date-filter"
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="schedule-status-filter"
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {(dateFilter || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setDateFilter('');
                setStatusFilter('ALL');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Schedules Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden" data-testid="schedules-table-container">
        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading neighborhood schedules..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No collection schedules found"
              description={`There are currently no matching collection schedules scheduled for Ward ${areaCode}. Please check back later or contact your municipal supervisor.`}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="consumer-schedules-table">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Time Window</th>
                  <th className="py-3 px-4">Ward / Area</th>
                  <th className="py-3 px-4">Shift Status</th>
                  <th className="py-3 px-4">Collection Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/75 transition-colors" data-testid={`schedule-row-${item.id}`}>
                    <td className="py-3.5 px-4 font-bold text-gray-900">{item.scheduled_date}</td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      {item.start_time} - {item.end_time}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">Ward {areaCode}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      Standard municipal wet & dry segregated garbage collection. Please keep bins accessible.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contract & Guidance Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Locked Backend Contract: GET /api/v1/consumer/schedules</div>
          <div className="text-[11px] text-blue-700 mt-0.5">
            Returns root pagination with strictly area-filtered neighborhood schedules. If an agent does not arrive within the designated window, you may report a Missed Pickup via Support.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsumerSchedulePage;
