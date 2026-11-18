// src/pages/consumer/ConsumerSchedulePage.tsx
// Screen 2: Consumer Neighborhood Timetable (Phase 2)
// Calls locked contract GET /api/v1/consumer/schedules with consumer's area_code, date filter, pagination, and local timezone handling
// Implements page navigation, reset to page one on filter change, and unavailable state when ward is unassigned

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { consumerService } from '../../api/consumerService';
import { ConsumerScheduleItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { Calendar, Clock, MapPin, Filter, Info, ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';

export const ConsumerSchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ConsumerScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Authenticated profile data strictly without fallback
  const areaCode = user?.area_code;
  const isWardAvailable = Boolean(areaCode);

  const fetchSchedules = useCallback(async () => {
    if (!areaCode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await consumerService.getSchedules({
        area_code: areaCode,
        start_date: dateFilter || undefined,
        page,
        size: pageSize,
      });

      setSchedules(res.content || []);
      setTotalPages(res.total_pages || 1);
      setTotalElements(res.total_elements || 0);
    } catch (err) {
      console.error('Failed to load consumer schedules:', err);
      setError('Unable to load neighborhood schedules. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [areaCode, dateFilter, page, pageSize]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Handle filter changes: reset to page 1 (0-indexed)
  const handleDateChange = (val: string) => {
    setDateFilter(val);
    setPage(0);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handleResetFilters = () => {
    setDateFilter('');
    setStatusFilter('ALL');
    setPage(0);
  };

  // Client-side status filter applied if status is selected
  const displayedSchedules = statusFilter === 'ALL'
    ? schedules
    : schedules.filter((s) => s.status === statusFilter);

  // Unavailable Ward State
  if (!isWardAvailable) {
    return (
      <div className="space-y-6" data-testid="consumer-schedule-page">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">Neighborhood Waste Collection Timetable</h1>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-3" data-testid="ward-unavailable-state">
          <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-base font-bold text-amber-950">Ward Assignment Unavailable</h2>
          <p className="text-xs text-amber-800 leading-relaxed">
            Your household profile does not have an assigned operational ward. The neighborhood collection timetable cannot be loaded until a municipal ward is provisioned to your account.
          </p>
        </div>
      </div>
    );
  }

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

      {/* Error Banner with Working Retry */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 flex items-center justify-between gap-3" data-testid="schedules-error-banner">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchSchedules}
            data-testid="retry-schedules-btn"
            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-semibold rounded-lg text-xs transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

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
              onChange={(e) => handleDateChange(e.target.value)}
              data-testid="schedule-date-filter"
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
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
              onClick={handleResetFilters}
              data-testid="reset-filters-btn"
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden" data-testid="schedules-table-container">
        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading neighborhood schedules..." />
          </div>
        ) : displayedSchedules.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No collection schedules found"
              description={`There are currently no matching collection schedules scheduled for Ward ${areaCode}.`}
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
                {displayedSchedules.map((item) => (
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

        {/* Page Navigation Controls */}
        <div
          className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between text-xs"
          data-testid="schedule-pagination"
        >
          <span className="text-gray-500" data-testid="page-indicator">
            Page {page + 1} of {Math.max(1, totalPages)} ({totalElements} total entries)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0 || isLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              data-testid="prev-page-btn"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1 || isLoading}
              onClick={() => setPage((p) => p + 1)}
              data-testid="next-page-btn"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
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
