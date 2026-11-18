// src/api/mockAdapter.ts
// Demo-only Axios mock adapter registered ONLY when USE_MOCK_API && IS_DEMO are true
// Implements exact Section 3 Locked API Contracts and connects to persistent mockStore

import MockAdapter from 'axios-mock-adapter';
import { axiosClient } from './axiosClient';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';
import { getStoreState, setStoreState } from './mockStore';
import {
  AuthSuccessResponse,
  AuthErrorResponse,
  AdminSchedulesResponse,
  AgentSchedulesResponse,
  ConsumerSchedulesResponse,
  DeviceTokenResponse,
  AdminNotificationSendResponse,
  AgentNotificationSendResponse,
  NotificationsInboxResponse,
  NotificationMarkReadResponse,
  AuthLoginRequest,
  DeviceTokenRequest,
  AdminNotificationSendRequest,
  AgentNotificationSendRequest,
} from '../types/contracts';

let mock: MockAdapter | null = null;

export function setupMockAdapter(): MockAdapter | null {
  // STRICT SAFETY: Never register mock adapter in live production mode
  if (!IS_DEMO || !USE_MOCK_API) {
    if (mock) {
      mock.restore();
      mock = null;
    }
    return null;
  }

  if (mock) {
    return mock;
  }

  mock = new MockAdapter(axiosClient, { delayResponse: 100 });

  // -------------------------------------------------------------
  // 3.1 Common Authentication Contract (POST /api/v1/auth/login)
  // -------------------------------------------------------------
  mock.onPost('/api/v1/auth/login').reply((config) => {
    let req: AuthLoginRequest;
    try {
      req = JSON.parse(config.data) as AuthLoginRequest;
    } catch {
      const errRes: AuthErrorResponse = {
        success: false,
        message: 'Invalid request payload',
        statusCode: 400,
        data: null,
        errors: { error_code: 'INVALID_REQUEST' },
      };
      return [400, errRes];
    }

    const state = getStoreState();
    let account = null;

    if (req.type === 'CONSUMER') {
      account = state.accounts.find(
        (a) => a.role === 'CONSUMER' && a.mobile_number === req.mobile_number && a.password === req.password
      );
    } else if (req.type === 'ADMIN') {
      account = state.accounts.find(
        (a) => a.role === 'ADMIN' && a.username === req.username && a.password === req.password
      );
    } else if (req.type === 'AGENT') {
      account = state.accounts.find(
        (a) => a.role === 'AGENT' && a.mobile_number === req.mobile_number && a.password === req.password
      );
    }

    if (!account) {
      const errRes: AuthErrorResponse = {
        success: false,
        message: 'Invalid username/mobile number or password',
        statusCode: 401,
        data: null,
        errors: { error_code: 'INVALID_CREDENTIALS' },
      };
      return [401, errRes];
    }

    // Role is strictly returned by the server based on the matched account
    const successRes: AuthSuccessResponse = {
      success: true,
      message: `${account.role.charAt(0) + account.role.slice(1).toLowerCase()} login successful`,
      statusCode: 200,
      data: {
        user_id: account.user_id,
        name: account.name,
        username: account.username || (account.role === 'ADMIN' ? 'admin' : undefined),
        mobile_number: account.mobile_number,
        role: account.role,
        access_token: `mock_jwt_token_${account.role.toLowerCase()}_${Date.now()}`,
        refresh_token: `mock_refresh_token_${account.role.toLowerCase()}_${Date.now()}`,
        token_type: 'Bearer',
        expires_in: 3600,
      },
      errors: null,
    };

    return [200, successRes];
  });

  // Simulated 401 expiry endpoint for testing session expiration
  mock.onPost('/api/v1/auth/simulate-expire').reply(401, {
    success: false,
    message: 'Session has expired or token is invalid',
    statusCode: 401,
    data: null,
    errors: { error_code: 'TOKEN_EXPIRED' },
  });

  // -------------------------------------------------------------
  // 3.2 Scheduler Contract (Root Pagination)
  // -------------------------------------------------------------
  // A. Admin Schedules
  mock.onGet('/api/v1/admin/schedules').reply(() => {
    const state = getStoreState();
    const res: AdminSchedulesResponse = {
      content: state.schedules,
      page_number: 0,
      page_size: 20,
      total_elements: state.schedules.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // B. Agent Schedules
  mock.onGet('/api/v1/agent/schedules').reply(() => {
    const state = getStoreState();
    // Return all assigned schedules
    const content = state.schedules.map((s) => ({
      id: s.id,
      area_code: s.area_code,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
    }));

    const res: AgentSchedulesResponse = {
      content,
      page_number: 0,
      page_size: 20,
      total_elements: content.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // C. Consumer Schedules
  mock.onGet('/api/v1/consumer/schedules').reply((config) => {
    const state = getStoreState();
    const params = config.params || {};
    const areaCode = params.area_code || '600001';

    const filtered = state.schedules.filter((s) => !areaCode || s.area_code === areaCode);
    const content = filtered.map((s) => ({
      id: s.id,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
    }));

    const res: ConsumerSchedulesResponse = {
      content,
      page_number: 0,
      page_size: 10,
      total_elements: content.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // -------------------------------------------------------------
  // 3.3 Push & In-App Notification Contract
  // -------------------------------------------------------------
  // A. Device Token Registration
  mock.onPost('/api/v1/notifications/device-token').reply((config) => {
    const body = JSON.parse(config.data || '{}') as DeviceTokenRequest;
    if (!body.device_id || !body.token || body.platform !== 'ANDROID') {
      return [400, { message: 'Invalid device token registration payload' }];
    }
    const res: DeviceTokenResponse = {
      message: 'Device token registered successfully',
      updated_at: new Date().toISOString(),
    };
    return [200, res];
  });

  // B. Admin Bulk Notification Dispatch (202 Accepted)
  mock.onPost('/api/v1/admin/notifications/send').reply((config) => {
    const body = JSON.parse(config.data || '{}') as AdminNotificationSendRequest;
    const now = new Date().toISOString();
    const dispatchId = `disp-adm-${Date.now()}`;

    // Add to mockStore notifications
    setStoreState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: body.title,
          body: body.body,
          status: 'UNREAD',
          created_at: now,
        },
        ...prev.notifications,
      ],
    }));

    const res: AdminNotificationSendResponse = {
      dispatch_id: dispatchId,
      status: 'QUEUED',
      target_type: body.target_type,
      target_value: body.target_value,
      timestamp: now,
    };
    return [202, res];
  });

  // C. Agent Notification Dispatch (202 Accepted)
  mock.onPost('/api/v1/agent/notifications/send').reply((config) => {
    const body = JSON.parse(config.data || '{}') as AgentNotificationSendRequest;
    const now = new Date().toISOString();
    const dispatchId = `disp-agt-${Date.now()}`;

    setStoreState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: body.title,
          body: body.body,
          status: 'UNREAD',
          created_at: now,
        },
        ...prev.notifications,
      ],
    }));

    const res: AgentNotificationSendResponse = {
      dispatch_id: dispatchId,
      status: 'QUEUED',
      target_user_id: body.target_user_id,
      timestamp: now,
    };
    return [202, res];
  });

  // D. Notification Inbox (Root Pagination)
  mock.onGet('/api/v1/notifications').reply(() => {
    const state = getStoreState();
    const res: NotificationsInboxResponse = {
      content: state.notifications,
      page_number: 0,
      page_size: 20,
      total_elements: state.notifications.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // E. Mark Notification as Read
  mock.onPatch(/\/api\/v1\/notifications\/[^/]+\/read/).reply((config) => {
    const match = config.url?.match(/\/api\/v1\/notifications\/([^/]+)\/read/);
    const notifId = match ? match[1] : '';
    const now = new Date().toISOString();

    setStoreState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notifId ? { ...n, status: 'READ' } : n
      ),
    }));

    const res: NotificationMarkReadResponse = {
      id: notifId,
      status: 'READ',
      updated_at: now,
    };
    return [200, res];
  });

  console.log('🔌 [mockAdapter] Axios mock adapter registered for locked Section 3 endpoints.');
  return mock;
}

// Auto-initialize when in demo mode
if (IS_DEMO && USE_MOCK_API) {
  setupMockAdapter();
}
