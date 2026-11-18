// src/api/backendGapService.ts
// Proposed backend gap contracts (Section 4) with strict TODO_BACKEND_SATHEESH qualifiers

import { axiosClient } from './axiosClient';
import {
  ConsumerRegisterRequest,
  ConsumerRegisterResponse,
  ConsumerDashboardResponse,
  AgentScanQRRequest,
  AgentScanQRResponse,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaymentHistoryResponse,
  CreatePickupRequestPayload,
  ManualPickupRequestItem,
  CreateSupportTicketRequest,
  SupportTicketItem,
  AdminDashboardKPIs,
} from '../types/contracts';

export const backendGapService = {
  // 1. Consumer Registration // TODO_BACKEND_SATHEESH
  async registerConsumer(body: ConsumerRegisterRequest): Promise<ConsumerRegisterResponse> {
    const response = await axiosClient.post<ConsumerRegisterResponse>('/api/v1/consumers/register', body);
    return response.data;
  },

  // 2. Consumer Dashboard // TODO_BACKEND_SATHEESH
  async getConsumerDashboard(): Promise<ConsumerDashboardResponse> {
    const response = await axiosClient.get<ConsumerDashboardResponse>('/api/v1/consumers/me/dashboard');
    return response.data;
  },

  // 4. Agent QR Scan Verification // TODO_BACKEND_SATHEESH
  async scanCollectionQR(body: AgentScanQRRequest): Promise<AgentScanQRResponse> {
    const response = await axiosClient.post<AgentScanQRResponse>('/api/v1/agent/collections/scan-qr', body);
    return response.data;
  },

  // 5. Payments & Razorpay // TODO_BACKEND_SATHEESH
  async createPaymentOrder(body: CreatePaymentOrderRequest): Promise<CreatePaymentOrderResponse> {
    const response = await axiosClient.post<CreatePaymentOrderResponse>('/api/v1/payments/create-order', body);
    return response.data;
  },

  async verifyPayment(body: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const response = await axiosClient.post<VerifyPaymentResponse>('/api/v1/payments/verify', body);
    return response.data;
  },

  // 6. Fee Collection History // TODO_BACKEND_SATHEESH
  async getPaymentHistory(params?: { start_date?: string; end_date?: string; status?: string }): Promise<PaymentHistoryResponse> {
    const response = await axiosClient.get<PaymentHistoryResponse>('/api/v1/payments/history', { params });
    return response.data;
  },

  // 7. Manual Requests // TODO_BACKEND_SATHEESH
  async createPickupRequest(body: CreatePickupRequestPayload): Promise<ManualPickupRequestItem> {
    const response = await axiosClient.post<ManualPickupRequestItem>('/api/v1/requests', body);
    return response.data;
  },

  // 8. Support Tickets // TODO_BACKEND_SATHEESH
  async createSupportTicket(body: CreateSupportTicketRequest): Promise<SupportTicketItem> {
    const response = await axiosClient.post<SupportTicketItem>('/api/v1/support/tickets', body);
    return response.data;
  },

  // 9. Admin Dashboard KPIs // TODO_BACKEND_SATHEESH
  async getAdminDashboardKPIs(): Promise<AdminDashboardKPIs> {
    const response = await axiosClient.get<AdminDashboardKPIs>('/api/v1/admin/dashboard');
    return response.data;
  },
};
