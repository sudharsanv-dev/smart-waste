// src/pages/agent/AgentSupportPage.tsx
// Screen 6: Agent Operational Support Desk & Grievance Dispatch (Phase 3)
// Allows collection agents to log route obstructions, vehicle breakdowns, and safety incidents

import React, { useEffect, useState } from 'react';
import { agentService } from '../../api/agentService';
import { SupportTicketItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { HelpCircle, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';

export const AgentSupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState('Vehicle Breakdown');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await agentService.getSupportTickets();
      setTickets(res.content || []);
    } catch (err) {
      console.error('Failed to load agent support tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const newTkt = await agentService.createSupportTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
      });

      setSuccessMessage(`Operational ticket ${newTkt.ticket_id} created successfully.`);
      setSubject('');
      setDescription('');
      fetchTickets();
    } catch (err: unknown) {
      console.error('Failed to submit ticket:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="agent-support-page">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Agent Field Operations Support Desk</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Report field obstructions, equipment malfunctions, or hazardous materials encountered on route.
          </p>
        </div>
      </div>

      {successMessage && (
        <div
          data-testid="agent-ticket-success-banner"
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-950 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Ticket Creation Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-gray-900">Log New Field Operational Grievance</h2>
          </div>
          <span className="text-[10px] text-gray-400 font-semibold uppercase">
            POST /api/v1/support/tickets
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Incident Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="agent-ticket-category"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Vehicle Breakdown">Vehicle Breakdown / Hydraulic Failure</option>
                <option value="Route Obstruction">Route Obstruction / Road Closure</option>
                <option value="Bin Damage / Overflow">Overflowing Community Bin / Structural Damage</option>
                <option value="Hazardous Waste">Unreported Hazardous Material Encountered</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Brief Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="agent-ticket-subject"
                placeholder="e.g. Hydraulic compactor jam on Vehicle 4042"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
              Incident Description & Location Details
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="agent-ticket-description"
              placeholder="Provide exact landmark, severity, and immediate actions taken..."
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-agent-ticket-btn"
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" label="Submitting..." />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Operational Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Operational Tickets */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Operational Grievance History ({tickets.length})
          </h2>
          <span className="text-[11px] text-gray-400">Agent Field Log</span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading operational tickets..." />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No operational tickets"
              description="No field incident reports or operational tickets have been logged by this agent account."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="agent-tickets-table">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((t) => (
                  <tr key={t.ticket_id} className="hover:bg-gray-50/75 transition-colors" data-testid={`ticket-row-${t.ticket_id}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{t.ticket_id}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">{t.category}</td>
                    <td className="py-3.5 px-4 text-gray-700">{t.subject}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          t.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">{new Date(t.created_at).toLocaleDateString()}</td>
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

export default AgentSupportPage;
