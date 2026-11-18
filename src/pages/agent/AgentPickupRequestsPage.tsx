// src/pages/agent/AgentPickupRequestsPage.tsx
// Screen 4: Agent On-Demand Pickup Request Claims (Phase 3)
// Proves Phase 3 Exit Gate: Atomic, conflict-aware PENDING -> CLAIMED transition; returns 409 when already claimed

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { agentService } from '../../api/agentService';
import { ManualPickupRequestItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { Truck, CheckCircle2, AlertCircle, Clock, MapPin, User, PackageCheck } from 'lucide-react';

export const AgentPickupRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ManualPickupRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CLAIMED'>('ALL');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await agentService.getPickupRequests({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setRequests(res.content || []);
    } catch (err: unknown) {
      console.error('Failed to load pickup requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleClaim = async (requestId: string) => {
    setClaimingId(requestId);
    setConflictError(null);
    setClaimSuccess(null);

    try {
      await agentService.claimPickupRequest(requestId);
      setClaimSuccess(`Successfully claimed request ${requestId}! You are now assigned as the primary collection agent.`);
      // Refresh list to update UI
      await fetchRequests();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj.response?.data?.message || errObj.message || 'Failed to claim request.';
      setConflictError(msg);
      // Refresh to show latest owner
      fetchRequests();
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="agent-requests-page">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">On-Demand Pickup Request Claims</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Browse and claim resident special waste collection requests in your assigned sector.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          {(['ALL', 'PENDING', 'CLAIMED'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              data-testid={`filter-${filter.toLowerCase()}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === filter ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {filter === 'ALL' ? 'All Requests' : filter === 'PENDING' ? 'Available' : 'Claimed'}
            </button>
          ))}
        </div>
      </div>

      {/* Success Notification Banner */}
      {claimSuccess && (
        <div
          data-testid="claim-success-banner"
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{claimSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setClaimSuccess(null)}
            className="text-xs text-emerald-700 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Concurrency Conflict Banner (409 Conflict) */}
      {conflictError && (
        <div
          data-testid="claim-conflict-banner"
          className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-950 text-xs flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{conflictError}</span>
          </div>
          <button
            type="button"
            onClick={() => setConflictError(null)}
            className="text-xs text-rose-700 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Sector Requests ({requests.length})
          </h2>
          <span className="text-[11px] text-gray-400">Atomic Conflict Verification</span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading pickup requests..." />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No pickup requests found"
              description="There are currently no on-demand pickup requests matching your filter criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="agent-requests-table">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Waste Category</th>
                  <th className="py-3 px-4">Resident & Address</th>
                  <th className="py-3 px-4">Preferred Date</th>
                  <th className="py-3 px-4">Status & Assignment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/75 transition-colors" data-testid={`request-row-${item.id}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{item.id}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-800">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        <span>{item.waste_type}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-bold text-gray-900 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.consumer_name}</span>
                      </div>
                      <div className="text-gray-500 text-[11px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span>{item.address} (Ward {item.area_code})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.preferred_date}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        data-testid={`request-status-${item.id}`}
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          item.status === 'CLAIMED'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.claimed_by_agent_name && (
                        <div className="text-[10px] text-blue-800 mt-1 font-medium" data-testid={`request-owner-${item.id}`}>
                          Claimed by: {item.claimed_by_agent_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.status === 'PENDING' ? (
                        <button
                          type="button"
                          disabled={claimingId === item.id}
                          onClick={() => handleClaim(item.id)}
                          data-testid={`claim-request-${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
                        >
                          {claimingId === item.id ? (
                            <LoadingSpinner size="sm" label="Claiming..." />
                          ) : (
                            <>
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Claim Request</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">
                          {item.claimed_by_agent_id === user?.user_id ? 'Claimed by you' : 'Claimed'}
                        </span>
                      )}
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

export default AgentPickupRequestsPage;
