// src/pages/consumer/ConsumerPickupRequestsPage.tsx
// Screen 4: Manual On-Demand Waste Pickup Requests (Phase 2)
// Form submission to POST /api/v1/requests, listing existing requests with status tracking (PENDING, CLAIMED, ASSIGNED, COMPLETED)

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { consumerService } from '../../api/consumerService';
import { ManualPickupRequestItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/layout/LoadingEmptyError';
import { Truck, PlusCircle, Calendar, MapPin, Tag, CheckCircle2 } from 'lucide-react';

const WASTE_CATEGORIES = [
  { value: 'BULK', label: 'Bulk Waste (Furniture, Mattresses, Crates)' },
  { value: 'ELECTRONIC', label: 'E-Waste (Appliances, Cables, Electronics)' },
  { value: 'HAZARDOUS', label: 'Hazardous Waste (Paints, Chemicals, Batteries)' },
  { value: 'RECYCLABLE', label: 'Heavy Recyclables (Cardboard, Scrap Metal)' },
  { value: 'GENERAL', label: 'General / Overflow Debris' },
] as const;

export const ConsumerPickupRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ManualPickupRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [wasteType, setWasteType] = useState<'BULK' | 'ELECTRONIC' | 'HAZARDOUS' | 'RECYCLABLE' | 'GENERAL'>('BULK');
  const [preferredDate, setPreferredDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [address, setAddress] = useState('14/B Sunrise Ave, Harbour Zone');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function fetchRequests() {
      setIsLoading(true);
      try {
        const list = await consumerService.getPickupRequests();
        setRequests(list);
      } catch (err) {
        console.error('Failed to load pickup requests:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRequests();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!preferredDate) {
      setError('Please select a preferred pickup date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await consumerService.createPickupRequest({
        waste_type: wasteType,
        preferred_date: preferredDate,
        address: address.trim() || 'Resident Premises',
        notes: notes.trim(),
      });

      setRequests((prev) => [created, ...prev]);
      setSuccessMsg(`Pickup request ${created.id} submitted successfully! Status: PENDING.`);
      setNotes('');
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit pickup request.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="consumer-pickup-requests-page">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Special & Bulk Waste Pickup Requests</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Request on-demand collection for heavy, bulky, electronic, or hazardous household items.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setSuccessMsg(null);
            setError(null);
          }}
          data-testid="toggle-request-form-btn"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{showForm ? 'Cancel Request' : 'New Pickup Request'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-center gap-2" data-testid="request-success-alert">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Creation Form Modal/Card */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-300 shadow-sm" data-testid="pickup-request-form">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Book On-Demand Special Pickup</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Waste Classification <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <select
                    value={wasteType}
                    onChange={(e) => setWasteType(e.target.value as typeof wasteType)}
                    data-testid="request-waste-type"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {WASTE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preferred Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Preferred Pickup Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    data-testid="request-preferred-date"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Premises Pickup Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address for vehicle access"
                  data-testid="request-address"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Item Description & Access Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Broken refrigerator and 3 packing crates placed near main gate"
                data-testid="request-notes"
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
                data-testid="submit-request-btn"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Pickup Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests History List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden" data-testid="pickup-requests-list">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Your Household Pickup Requests ({requests.length})
          </h2>
          <span className="text-[11px] text-gray-400">Section 4 // TODO_BACKEND_SATHEESH</span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading pickup requests..." />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No pickup requests yet"
              description="You have not scheduled any special or bulk waste pickups. Click 'New Pickup Request' above to request service."
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((req) => (
              <div key={req.id} className="p-5 hover:bg-gray-50/60 transition-colors" data-testid={`pickup-request-row-${req.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">{req.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">
                        {req.waste_type}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700">
                      <strong>Address:</strong> {req.address}
                    </p>

                    {req.notes && (
                      <p className="text-xs text-gray-500 italic">
                        &quot;{req.notes}&quot;
                      </p>
                    )}

                    <div className="text-[11px] text-gray-400 flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>Preferred: {req.preferred_date}</span>
                      </span>
                      {req.claimed_by_agent_name && (
                        <span>Assigned Agent: {req.claimed_by_agent_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      data-testid={`request-status-${req.id}`}
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        req.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'CLAIMED' || req.status === 'ASSIGNED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status}
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

export default ConsumerPickupRequestsPage;
