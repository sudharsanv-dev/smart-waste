// src/api/agentService.ts
// Phase 3 Field Collection Agent Service
// Connects Agent screens to locked Section 3 and confirmed Section 4 endpoints

import { axiosClient } from './axiosClient';
import { scheduleService } from './scheduleService';
import { notificationService } from './notificationService';
import {
  AgentSchedulesResponse,
  AgentNotificationSendRequest,
  AgentNotificationSendResponse,
  AgentScanQRRequest,
  AgentScanQRResponse,
  ManualPickupRequestItem,
  ManualPickupRequestsResponse,
  PaymentHistoryResponse,
  CreateSupportTicketRequest,
  SupportTicketItem,
  SupportTicketsResponse,
} from '../types/contracts';

export const agentService = {
  // 1. Assigned Route Schedules (Locked Section 3.2 B)
  async getSchedules(params?: {
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    page?: number;
    size?: number;
  }): Promise<AgentSchedulesResponse> {
    return scheduleService.getAgentSchedules(params);
  },

  // 2. Task-Based Arrival Notification (Locked Section 3.3 C - 202 QUEUED)
  async sendArrivalNotification(body: AgentNotificationSendRequest): Promise<AgentNotificationSendResponse> {
    return notificationService.sendAgentNotification(body);
  },

  // 3. QR Scan Verification & Duplicate Prevention (Section 4 // TODO_BACKEND_SATHEESH)
  async scanCollectionQR(body: AgentScanQRRequest): Promise<AgentScanQRResponse> {
    const res = await axiosClient.post<AgentScanQRResponse>('/api/v1/agent/collections/scan-qr', body);
    return res.data;
  },

  // 4. Eligible Pickup Requests & Atomic Claiming (Section 4 // TODO_BACKEND_SATHEESH)
  async getPickupRequests(params?: { status?: string }): Promise<ManualPickupRequestsResponse> {
    const res = await axiosClient.get<ManualPickupRequestsResponse>('/api/v1/requests', { params });
    return res.data;
  },

  async claimPickupRequest(requestId: string): Promise<ManualPickupRequestItem> {
    const res = await axiosClient.post<ManualPickupRequestItem>(`/api/v1/requests/${requestId}/claim`);
    return res.data;
  },

  // 5. Authorized Fee Ledger for Assigned Sector (Section 4 // TODO_BACKEND_SATHEESH)
  async getPaymentHistory(params?: {
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaymentHistoryResponse> {
    const res = await axiosClient.get<PaymentHistoryResponse>('/api/v1/payments/history', { params });
    return res.data;
  },

  // 6. Operational Support Grievances (Section 4 // TODO_BACKEND_SATHEESH)
  async getSupportTickets(): Promise<SupportTicketsResponse> {
    const res = await axiosClient.get<SupportTicketsResponse>('/api/v1/support/tickets');
    return res.data;
  },

  async createSupportTicket(body: CreateSupportTicketRequest): Promise<SupportTicketItem> {
    const res = await axiosClient.post<SupportTicketItem>('/api/v1/support/tickets', body);
    return res.data;
  },
};
