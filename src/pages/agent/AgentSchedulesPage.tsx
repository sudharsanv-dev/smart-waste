// src/pages/agent/AgentSchedulesPage.tsx
// Screen 2: Agent Assigned Routes & Timetable (Phase 3)
// Calls locked contract GET /api/v1/agent/schedules with JWT ownership, date filters, and editable route notes

import React, { useEffect, useState } from 'react';
import { agentService } from '../../api/agentService';
import { AgentScheduleItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { Calendar, Clock, MapPin, Edit3, Save, CheckCircle } from 'lucide-react';
import { IS_DEMO } from '../../lib/env';

export const AgentSchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<AgentScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('2026-11-15');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [routeNotes, setRouteNotes] = useState<string>(() => {
    return localStorage.getItem('agent_route_notes') || 'Start shift at 07:00 AM at North Gate depot. Prioritize commercial establishments on Sunrise Avenue first.';
  });
  const [savedNotesMessage, setSavedNotesMessage] = useState(false);

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const res = await agentService.getSchedules({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setSchedules(res.content || []);
    } catch (err) {
      console.error('Failed to load agent schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [startDate, endDate]);

  const handleSaveNotes = () => {
    localStorage.setItem('agent_route_notes', routeNotes);
    setSavedNotesMessage(true);
    setTimeout(() => setSavedNotesMessage(false), 3000);
  };

  return (
    <div className="space-y-6" data-testid="agent-schedules-page">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Assigned Shift Routes & Schedule</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Filtered strictly to JWT agent ownership. Showing designated collection shifts.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-testid="agent-sched-start-date"
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-testid="agent-sched-end-date"
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Assigned Shifts ({schedules.length})
          </h2>
          <span className="text-[11px] text-gray-400">Locked Contract: GET /api/v1/agent/schedules</span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading assigned shifts..." />
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No shift assignments found"
              description="No collection shifts are assigned to your agent account for the selected date range."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="agent-schedules-table">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Shift ID</th>
                  <th className="py-3 px-4">Ward / Area</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Time Window</th>
                  <th className="py-3 px-4">Shift Status</th>
                  <th className="py-3 px-4">Route Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/75 transition-colors" data-testid={`agent-sched-row-${item.id}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{item.id.slice(0, 12)}...</td>
                    <td className="py-3.5 px-4 font-bold text-blue-900">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ward {item.area_code}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{item.scheduled_date}</td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.start_time} - {item.end_time}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">Curbside Segregated Collection</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editable Route Notes Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900">Field Route Notes & Daily Log</h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            // TODO_BACKEND_SATHEESH (Demo Storage)
          </span>
        </div>

        <p className="text-xs text-gray-500">
          Personal notes for traffic diversions, commercial pickups, or vehicle fueling. Real route write operations remain blocked until backend confirms them.
        </p>

        <textarea
          rows={3}
          value={routeNotes}
          disabled={!IS_DEMO}
          onChange={(e) => setRouteNotes(e.target.value)}
          data-testid="agent-route-notes-input"
          className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter operational notes for your route shift..."
        />

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {IS_DEMO ? 'Saved to local demo store.' : 'Route notes editing disabled in live production mode.'}
          </span>
          <button
            type="button"
            onClick={handleSaveNotes}
            data-testid="save-route-notes-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Notes</span>
          </button>
        </div>

        {savedNotesMessage && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Route notes saved successfully.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSchedulesPage;
