// src/pages/agent/AgentFeeHistoryPage.tsx
// Screen 5: Agent Sector Fee Collection Ledger (Phase 3)
// Filtered strictly to agent-authorized route records (Ward 600001, 600040)

import React, { useEffect, useState } from 'react';
import { agentService } from '../../api/agentService';
import { PaymentHistoryItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState } from '../../components/layout/LoadingEmptyError';
import { CreditCard, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

export const AgentFeeHistoryPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await agentService.getPaymentHistory({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        });
        setPayments(res.content || []);
      } catch (err) {
        console.error('Failed to load agent payment ledger:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [statusFilter]);

  const totalCollected = payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingDues = payments
    .filter((p) => p.status === 'UNPAID')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6" data-testid="agent-payments-page">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Sector Sanitation Fee Collection Ledger</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Displaying fee collection records for households along your assigned operational routes.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          {(['ALL', 'PAID', 'UNPAID'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              data-testid={`fee-filter-${filter.toLowerCase()}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === filter ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {filter === 'ALL' ? 'All Invoices' : filter === 'PAID' ? 'Collected' : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Collected in Sector</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-0.5" data-testid="agent-sector-collected">
              ₹{totalCollected.toFixed(2)}
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">Settled by residents</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Pending Dues in Sector</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-0.5" data-testid="agent-sector-pending">
              ₹{pendingDues.toFixed(2)}
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">Outstanding monthly sanitation fee</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Sector Invoices ({payments.length})
          </h2>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Authorized Field Route Scope</span>
          </span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading sector payment history..." />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No fee records found"
              description="No fee collection records match the filter for your assigned route."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="agent-payments-table">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Invoice ID</th>
                  <th className="py-3 px-4">Resident</th>
                  <th className="py-3 px-4">Ward</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Settled / Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/75 transition-colors" data-testid={`agent-payment-row-${item.invoice_id}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{item.invoice_id}</td>
                    <td className="py-3.5 px-4 font-medium text-gray-800">{item.consumer_name}</td>
                    <td className="py-3.5 px-4 text-gray-600">Ward {item.area_code}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">₹{item.amount.toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          item.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {item.paid_at ? new Date(item.paid_at).toLocaleDateString() : item.due_date || 'Pending'}
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

export default AgentFeeHistoryPage;
