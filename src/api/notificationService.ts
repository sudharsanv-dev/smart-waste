// src/api/notificationService.ts
// Locked Section 3.3 Push & In-App Notification Service

import { axiosClient } from './axiosClient';
import {
  DeviceTokenRequest,
  DeviceTokenResponse,
  AdminNotificationSendRequest,
  AdminNotificationSendResponse,
  AgentNotificationSendRequest,
  AgentNotificationSendResponse,
  NotificationsInboxResponse,
  NotificationMarkReadResponse,
} from '../types/contracts';

export const notificationService = {
  // A. Device Token Registration
  async registerDeviceToken(body: DeviceTokenRequest): Promise<DeviceTokenResponse> {
    const response = await axiosClient.post<DeviceTokenResponse>('/api/v1/notifications/device-token', body);
    return response.data;
  },

  // B. Admin API: Bulk / Location-Based Dispatch (202 Accepted)
  async sendAdminNotification(body: AdminNotificationSendRequest): Promise<AdminNotificationSendResponse> {
    const response = await axiosClient.post<AdminNotificationSendResponse>('/api/v1/admin/notifications/send', body);
    return response.data;
  },

  // C. Agent API: Task-Based Dispatch ("Notify Arrival" - 202 Accepted)
  async sendAgentNotification(body: AgentNotificationSendRequest): Promise<AgentNotificationSendResponse> {
    const response = await axiosClient.post<AgentNotificationSendResponse>('/api/v1/agent/notifications/send', body);
    return response.data;
  },

  // D. Fetch Notification History (Inbox - Root Pagination)
  async getNotifications(params?: { unread_only?: boolean; page?: number; size?: number }): Promise<NotificationsInboxResponse> {
    const response = await axiosClient.get<NotificationsInboxResponse>('/api/v1/notifications', { params });
    return response.data;
  },

  // E. Mark Notification as Read
  async markNotificationAsRead(notificationId: string): Promise<NotificationMarkReadResponse> {
    const response = await axiosClient.patch<NotificationMarkReadResponse>(`/api/v1/notifications/${notificationId}/read`);
    return response.data;
  },
};
