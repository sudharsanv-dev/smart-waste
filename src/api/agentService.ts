// src/api/agentService.ts
// Phase 3 Field Collection Agent Service
// Connects Agent screens to locked Section 3 contracts and provisional Section 4 backendGapService

import { scheduleService } from './scheduleService';
import { notificationService } from './notificationService';
import { backendGapService, isBackendUnavailable } from './backendGapService';
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
    const res = await backendGapService.scanCollectionQR(body);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 4. Eligible Pickup Requests & Atomic Claiming (Section 4 // TODO_BACKEND_SATHEESH)
  async getPickupRequests(params?: { status?: string }): Promise<ManualPickupRequestsResponse> {
    const res = await backendGapService.getPickupRequests(params);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  async claimPickupRequest(requestId: string): Promise<ManualPickupRequestItem> {
    const res = await backendGapService.claimPickupRequest(requestId);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 5. Authorized Fee Ledger for Assigned Sector (Section 4 // TODO_BACKEND_SATHEESH)
  async getPaymentHistory(params?: {
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaymentHistoryResponse> {
    const res = await backendGapService.getPaymentHistory(params);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  // 6. Operational Support Grievances (Section 4 // TODO_BACKEND_SATHEESH)
  async getSupportTickets(): Promise<SupportTicketsResponse> {
    const res = await backendGapService.getSupportTickets();
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },

  async createSupportTicket(body: CreateSupportTicketRequest): Promise<SupportTicketItem> {
    const res = await backendGapService.createSupportTicket(body);
    if (isBackendUnavailable(res)) {
      throw new Error(res.message);
    }
    return res;
  },
};
