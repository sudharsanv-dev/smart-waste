// src/pages/consumer/ConsumerPaymentsPage.tsx
// Screen 5: Consumer Payments, Invoices & Demo Receipts (Phase 2)
// Proves payment exit gate: idempotent double-click payment producing exactly one ledger entry and receipt

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { consumerService } from '../../api/consumerService';
import { PaymentHistoryItem } from '../../types/contracts';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/layout/LoadingEmptyError';
import { CreditCard, CheckCircle2, FileText, Download, X, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

export const ConsumerPaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentHistoryItem | null>(null);

  // Client-side mutex/ref to prevent double-dispatch in UI
  const paymentLockRef = useRef<boolean>(false);

  const fetchPayments = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const history = await consumerService.getPaymentHistory();
      setPayments(history);
      setIsLoaded(true);
    } catch (err: unknown) {
      console.error('Failed to load payment history:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load payment history.';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [user]);

  const unpaidInvoices = payments.filter((p) => p.status === 'UNPAID');
  const nextUnpaidInvoice = unpaidInvoices[0];
  const pendingAmount = unpaidInvoices.reduce((sum, p) => sum + p.amount, 0);

  // Single or double-click payment execution bound to specific invoice
  const handlePayInvoice = async (target?: PaymentHistoryItem) => {
    const targetToPay = target || nextUnpaidInvoice;
    if (!targetToPay) return;

    if (paymentLockRef.current) {
      console.warn('Payment execution already in flight. Suppressing duplicate trigger.');
      return;
    }

    paymentLockRef.current = true;
    setIsPaying(true);
    setError(null);

    try {
      // Step 1: Create simulated payment order bound to exact invoice_id and amount
      const order = await consumerService.createPaymentOrder({
        invoice_id: targetToPay.invoice_id,
        amount: targetToPay.amount,
      });

      // Step 2: Verify payment (backend enforces exact order ID and invoice_id)
      const verifyRes = await consumerService.verifyPayment(
        order.order_id,
        `pay_sim_${Date.now()}`,
        'simulated_razorpay_signature',
        targetToPay.invoice_id
      );

      // Refresh payments ledger from store
      const updatedList = await consumerService.getPaymentHistory();
      setPayments(updatedList);

      // Auto-open demo receipt for the settled invoice
      const paidItem = updatedList.find((p) => p.invoice_id === (verifyRes.invoice_id || targetToPay.invoice_id));
      if (paidItem) {
        setSelectedReceipt(paidItem);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment simulation failed.';
      setError(msg);
    } finally {
      setIsPaying(false);
      paymentLockRef.current = false;
    }
  };

  const handleDownloadReceipt = (receipt: PaymentHistoryItem) => {
    const receiptContent = `=====================================================
GREENPULSE CITY MUNICIPAL CORPORATION
Department of Solid Waste Management
Official Demo Receipt
=====================================================
Invoice ID:       ${receipt.invoice_id}
Status:           ${receipt.status}
Resident:         ${user?.name || receipt.consumer_name || 'Resident'}
Ward Area:        Ward ${receipt.area_code || user?.area_code || '600001'}
Settled Date:     ${receipt.paid_at || new Date().toISOString()}
Payment Method:   ${receipt.payment_method || 'UPI / Razorpay Simulator'}
Total Amount:     INR ${receipt.amount.toFixed(2)}
=====================================================
DISCLAIMER: DEMO RECEIPT ONLY FOR TESTING PURPOSES.
=====================================================`;

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt-${receipt.invoice_id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6" data-testid="consumer-payments-page">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Municipal Waste Management Fees & Invoices</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Pay household monthly sanitation fees and access official demo receipts.
          </p>
        </div>

        {/* Currency & Gateway Indicator */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-700">
          Payment Mode: <strong>Razorpay Simulator (Demo / INR)</strong>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Dues & Checkout Hero Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          data-testid="consumer-dues-card"
          className="md:col-span-2 bg-gradient-to-br from-slate-900 to-gray-800 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                GreenPulse City Corporation
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white">
                Monthly Sanitation Fee
              </span>
            </div>

            <div className="mt-4">
              <span className="text-xs text-gray-400">Total Outstanding Balance</span>
              {loadError ? (
                <div className="mt-2 p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center justify-between">
                  <span>Failed to load outstanding balance.</span>
                  <button
                    type="button"
                    data-testid="retry-payments-btn"
                    onClick={fetchPayments}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold"
                  >
                    Retry
                  </button>
                </div>
              ) : !isLoaded ? (
                <div className="py-4">
                  <LoadingSpinner size="sm" label="Loading outstanding balance..." />
                </div>
              ) : (
                <>
                  <div className="text-3xl font-extrabold text-white mt-1" data-testid="consumer-pending-dues">
                    ₹{pendingAmount.toFixed(2)}
                  </div>
                  {pendingAmount > 0 ? (
                    <div className="text-xs text-amber-300 flex items-center gap-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Invoice: {nextUnpaidInvoice?.invoice_id}
                        {unpaidInvoices.length > 1 ? ` (+${unpaidInvoices.length - 1} more)` : ''} • Due by Nov 30, 2026
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5 mt-1" data-testid="dues-cleared-badge">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All Dues Cleared • Account Current</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-gray-400">
              {pendingAmount > 0
                ? 'Clicking Pay will simulate instant payment verification via test adapter.'
                : 'All past invoices have been settled. Thank you for your timely payment!'}
            </span>

            {isLoaded && !loadError && pendingAmount > 0 && nextUnpaidInvoice && (
              <button
                type="button"
                disabled={isPaying}
                onClick={() => handlePayInvoice(nextUnpaidInvoice)}
                data-testid="pay-dues-btn"
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
              >
                {isPaying ? (
                  <LoadingSpinner size="sm" label="Processing..." />
                ) : (
                  <>
                    <span>Pay ₹{nextUnpaidInvoice.amount.toFixed(2)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* AutoPay Disclaimer Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">AutoPay Mandate Policy</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Recurring debits require a bank-verified e-mandate. AutoPay enrollment is intentionally disabled until a formal backend subscription contract exists.
            </p>
          </div>
          <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider pt-2 border-t border-gray-100">
            // TODO_BACKEND_SATHEESH
          </span>
        </div>
      </div>

      {/* Payment Ledger / History Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Household Fee Payment Ledger ({payments.length})
          </h2>
          <span className="text-[11px] text-gray-400">Single Source of Financial Truth</span>
        </div>

        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading payment ledger..." />
          </div>
        ) : loadError ? (
          <div className="p-8">
            <ErrorState message={loadError} onRetry={fetchPayments} />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No payment history found"
              description="Your account currently has no billing or payment records on file."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left" data-testid="payments-history-table">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Invoice ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Paid / Due Date</th>
                  <th className="py-3 px-4">Method / Note</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/75 transition-colors" data-testid={`payment-row-${item.invoice_id}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{item.invoice_id}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">₹{item.amount.toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        data-testid={`payment-status-${item.invoice_id}`}
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          item.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {item.paid_at ? new Date(item.paid_at).toLocaleDateString() : item.due_date || 'Pending'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {item.payment_method || (item.status === 'FAILED' ? 'Bank Declined (Simulated)' : 'UPI / Card')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.status === 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(item)}
                          data-testid={`view-receipt-${item.invoice_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      ) : item.status === 'UNPAID' ? (
                        <button
                          type="button"
                          disabled={isPaying}
                          onClick={() => handlePayInvoice(item)}
                          data-testid={`pay-invoice-${item.invoice_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay ₹{item.amount.toFixed(2)}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Demo Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            data-testid="payment-receipt"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4"
          >
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  ♻️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">GreenPulse City Municipal Corporation</h3>
                  <span className="text-[10px] text-gray-500 block">Department of Solid Waste Management</span>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-receipt-btn"
                onClick={() => setSelectedReceipt(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Disclaimer Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>DEMO RECEIPT:</strong> Generated for software test and hackathon simulation. Differentiated from a legally valid tax invoice; does not contain GSTIN, merchant legal credentials or tax components.
              </span>
            </div>

            {/* Receipt Details */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Number:</span>
                <span className="font-mono font-bold text-gray-900" data-testid="receipt-invoice-id">
                  {selectedReceipt.invoice_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Receipt Status:</span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                  {selectedReceipt.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resident / Household:</span>
                <span className="font-semibold text-gray-800">{user?.name || selectedReceipt.consumer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Service Ward:</span>
                <span className="font-semibold text-gray-800">Ward {selectedReceipt.area_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Date:</span>
                <span className="text-gray-800">
                  {selectedReceipt.paid_at ? new Date(selectedReceipt.paid_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method:</span>
                <span className="text-gray-800">{selectedReceipt.payment_method || 'UPI Simulator'}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
                <span className="text-gray-900">Total Settled Amount:</span>
                <span className="text-emerald-700" data-testid="receipt-amount">
                  ₹{selectedReceipt.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                data-testid="print-receipt-btn"
                className="px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadReceipt(selectedReceipt)}
                data-testid="download-receipt-btn"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Receipt (.txt)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsumerPaymentsPage;
