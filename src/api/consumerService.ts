// src/api/consumerService.ts
// Service layer for Consumer Portal modules (Registration, Dashboard, Timetable, Payments, Requests, Tickets)
// Connects to locked contracts and Section 4 gap services (TODO_BACKEND_SATHEESH)

import { backendGapService, isBackendUnavailable } from './backendGapService';
import { scheduleService } from './scheduleService';
import {
  ConsumerRegisterRequest,
  ConsumerRegisterResponse,
  ConsumerDashboardResponse,
  ConsumerScheduleItem,
  PaymentHistoryItem,
  VerifyPaymentResponse,
  ManualPickupRequestItem,
  CreatePickupRequestPayload,
  SupportTicketItem,
  CreateSupportTicketRequest,
} from '../types/contracts';

export const consumerService = {
  // 1. Consumer Registration (Section 4 // TODO_BACKEND_SATHEESH)
  async register(data: ConsumerRegisterRequest): Promise<ConsumerRegisterResponse> {
    const res = await backendGapService.registerConsumer(data);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 2. Consumer Dashboard (Section 4 // TODO_BACKEND_SATHEESH)
  async getDashboard(): Promise<ConsumerDashboardResponse> {
    const res = await backendGapService.getConsumerDashboard();
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 3. Timetable / Schedules (Section 3 Locked Contract GET /api/v1/consumer/schedules)
  async getSchedules(
    paramsOrArea: string | { area_code: string; start_date?: string; end_date?: string; page?: number; size?: number },
    legacyPage?: number,
    legacySize?: number
  ): Promise<{
    content: ConsumerScheduleItem[];
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
  }> {
    if (typeof paramsOrArea === 'string') {
      return scheduleService.getConsumerSchedules({
        area_code: paramsOrArea,
        page: legacyPage ?? 0,
        size: legacySize ?? 20,
      });
    }
    return scheduleService.getConsumerSchedules(paramsOrArea);
  },

  // 4. Payments History & Verify (Section 4 // TODO_BACKEND_SATHEESH)
  async getPaymentHistory(params?: { status?: string }): Promise<PaymentHistoryItem[]> {
    const res = await backendGapService.getPaymentHistory(params);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res.content || [];
  },

  async createPaymentOrder(params: number | { amount?: number; invoice_id?: string }) {
    const payload = typeof params === 'number' ? { amount: params } : params;
    const res = await backendGapService.createPaymentOrder(payload);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  async verifyPayment(orderId: string, paymentId: string, signature: string, invoiceId?: string): Promise<VerifyPaymentResponse> {
    const res = await backendGapService.verifyPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      invoice_id: invoiceId,
    });
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 5. Manual Pickup Requests (Section 4 // TODO_BACKEND_SATHEESH)
  async getPickupRequests(): Promise<ManualPickupRequestItem[]> {
    const res = await backendGapService.getPickupRequests();
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res.content || [];
  },

  async createPickupRequest(payload: CreatePickupRequestPayload): Promise<ManualPickupRequestItem> {
    const res = await backendGapService.createPickupRequest(payload);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 6. Support Tickets (Section 4 // TODO_BACKEND_SATHEESH)
  async getSupportTickets(): Promise<SupportTicketItem[]> {
    const res = await backendGapService.getSupportTickets();
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res.content || [];
  },

  async createSupportTicket(payload: CreateSupportTicketRequest): Promise<SupportTicketItem> {
    const res = await backendGapService.createSupportTicket(payload);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },
};
