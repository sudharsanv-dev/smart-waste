// src/api/backendGapService.ts
// Proposed backend gap contracts (Section 4) with strict TODO_BACKEND_SATHEESH qualifiers
// Protected by demo-only guard: in live production mode, returns an explicit unavailable result
// before sending any network request to unconfirmed endpoints.

import { axiosClient } from './axiosClient';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';
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

export interface BackendUnavailableResult {
  success: false;
  unavailable: true;
  message: string;
  data: null;
}

export type GapServiceResponse<T> = T | BackendUnavailableResult;

export function isBackendUnavailable(result: unknown): result is BackendUnavailableResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'unavailable' in result &&
    (result as { unavailable: unknown }).unavailable === true
  );
}

function getUnavailableResult(endpointName: string): BackendUnavailableResult {
  return {
    success: false,
    unavailable: true,
    message: `Backend endpoint "${endpointName}" is unconfirmed and unavailable in live mode. Awaiting backend implementation. // TODO_BACKEND_SATHEESH`,
    data: null,
  };
}

export const backendGapService = {
  // 1. Consumer Registration // TODO_BACKEND_SATHEESH
  async registerConsumer(body: ConsumerRegisterRequest): Promise<GapServiceResponse<ConsumerRegisterResponse>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('POST /api/v1/consumers/register');
    }
    const response = await axiosClient.post<ConsumerRegisterResponse>('/api/v1/consumers/register', body);
    return response.data;
  },

  // 2. Consumer Dashboard // TODO_BACKEND_SATHEESH
  async getConsumerDashboard(): Promise<GapServiceResponse<ConsumerDashboardResponse>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('GET /api/v1/consumers/me/dashboard');
    }
    const response = await axiosClient.get<ConsumerDashboardResponse>('/api/v1/consumers/me/dashboard');
    return response.data;
  },

  // 4. Agent QR Scan Verification // TODO_BACKEND_SATHEESH
  async scanCollectionQR(body: AgentScanQRRequest): Promise<GapServiceResponse<AgentScanQRResponse>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('POST /api/v1/agent/collections/scan-qr');
    }
    const response = await axiosClient.post<AgentScanQRResponse>('/api/v1/agent/collections/scan-qr', body);
    return response.data;
  },

  // 5. Payments & Razorpay // TODO_BACKEND_SATHEESH
  async createPaymentOrder(body: CreatePaymentOrderRequest): Promise<GapServiceResponse<CreatePaymentOrderResponse>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('POST /api/v1/payments/create-order');
    }
    const response = await axiosClient.post<CreatePaymentOrderResponse>('/api/v1/payments/create-order', body);
    return response.data;
  },

  async verifyPayment(body: VerifyPaymentRequest): Promise<GapServiceResponse<VerifyPaymentResponse>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('POST /api/v1/payments/verify');
    }
    const response = await axiosClient.post<VerifyPaymentResponse>('/api/v1/payments/verify', body);
    return response.data;
  },

  // 6. Fee Collection History // TODO_BACKEND_SATHEESH
  async getPaymentHistory(params?: {
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<GapServiceResponse<PaymentHistoryResponse>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('GET /api/v1/payments/history');
    }
    const response = await axiosClient.get<PaymentHistoryResponse>('/api/v1/payments/history', { params });
    return response.data;
  },

  // 7. Manual Requests // TODO_BACKEND_SATHEESH
  async createPickupRequest(body: CreatePickupRequestPayload): Promise<GapServiceResponse<ManualPickupRequestItem>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('POST /api/v1/requests');
    }
    const response = await axiosClient.post<ManualPickupRequestItem>('/api/v1/requests', body);
    return response.data;
  },

  // 8. Support Tickets // TODO_BACKEND_SATHEESH
  async createSupportTicket(body: CreateSupportTicketRequest): Promise<GapServiceResponse<SupportTicketItem>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('POST /api/v1/support/tickets');
    }
    const response = await axiosClient.post<SupportTicketItem>('/api/v1/support/tickets', body);
    return response.data;
  },

  // 9. Admin Dashboard KPIs // TODO_BACKEND_SATHEESH
  async getAdminDashboardKPIs(): Promise<GapServiceResponse<AdminDashboardKPIs>> {
    if (!IS_DEMO || !USE_MOCK_API) {
      return getUnavailableResult('GET /api/v1/admin/dashboard');
    }
    const response = await axiosClient.get<AdminDashboardKPIs>('/api/v1/admin/dashboard');
    return response.data;
  },
};
