// src/pages/consumer/ConsumerSupportPage.tsx
// Screen 6: Resident Help, Complaints & Support Tickets (Phase 2)
// Form submission to POST /api/v1/support/tickets, listing existing tickets with status tracking (OPEN, IN_PROGRESS, RESOLVED)

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { consumerService } from '../../api/consumerService';
import { SupportTicketItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/layout/LoadingEmptyError';
import { HelpCircle, PlusCircle, CheckCircle2, Clock, Tag } from 'lucide-react';

const TICKET_CATEGORIES = [
  'Missed Pickup',
  'Billing Dispute',
  'Bin Replacement / Damage',
  'Agent Conduct',
  'Schedule Inquiry',
  'General Feedback',
];

export const ConsumerSupportPage: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    async function fetchTickets() {
      setIsLoading(true);
      try {
        const list = await consumerService.getSupportTickets();
        setTickets(list);
      } catch (err) {
        console.error('Failed to load support tickets:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!subject.trim() || !description.trim()) {
      setError('Please provide both a subject and a description for your inquiry.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await consumerService.createSupportTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
      });

      setTickets((prev) => [created, ...prev]);
      setSuccessMsg(`Support ticket ${created.ticket_id} created successfully! Status: OPEN.`);
      setSubject('');
      setDescription('');
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit support ticket.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="consumer-support-page">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Resident Grievance Redressal & Support</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Submit complaints, report missed pickups, or request sanitation assistance from municipal supervisors.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setSuccessMsg(null);
            setError(null);
          }}
          data-testid="toggle-ticket-form-btn"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{showForm ? 'Cancel Ticket' : 'Raise New Grievance'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-center gap-2" data-testid="ticket-success-alert">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Ticket Creation Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-300 shadow-sm" data-testid="support-ticket-form">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Open Support & Grievance Ticket</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Issue Category <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    data-testid="ticket-category"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Brief Summary / Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Wednesday morning garbage truck skipped our street"
                  data-testid="ticket-subject"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Detailed Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide specific details, gate numbers, bin locations, or timestamps..."
                data-testid="ticket-description"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="submit-ticket-btn"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Grievance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" data-testid="support-tickets-list">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Your Support Grievances ({tickets.length})
          </h2>
          <span className="text-[11px] text-gray-400">Section 4 // TODO_BACKEND_SATHEESH</span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading support tickets..." />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No support tickets opened"
              description="You have no active or historical support tickets. If you experience missed pickups or billing questions, click 'Raise New Grievance'."
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((tkt) => (
              <div key={tkt.ticket_id} className="p-5 hover:bg-gray-50/60 transition-colors" data-testid={`ticket-row-${tkt.ticket_id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">{tkt.ticket_id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                        {tkt.category}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-gray-900">{tkt.subject}</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">{tkt.description}</p>

                    <div className="text-[11px] text-gray-400 flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Opened: {new Date(tkt.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      data-testid={`ticket-status-${tkt.ticket_id}`}
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        tkt.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tkt.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tkt.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsumerSupportPage;
