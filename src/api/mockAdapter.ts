// src/api/mockAdapter.ts
// Demo-only Axios mock adapter registered ONLY when USE_MOCK_API && IS_DEMO are true
// Implements exact Section 3 Locked API Contracts with session-based ownership enforcement

import MockAdapter from 'axios-mock-adapter';
import { axiosClient } from './axiosClient';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';
import { getStoreState, setStoreState } from './mockStore';
import { DemoUserAccount } from './mockData';
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

// Helper to resolve the authenticated demo account from the request Bearer token
function resolveAccount(config: { headers?: unknown }): {
  account?: DemoUserAccount;
  errorResponse?: [number, unknown];
} {
  const headers = (config.headers || {}) as Record<string, unknown>;
  const authHeader =
    (typeof (headers as { get?: (k: string) => unknown }).get === 'function'
      ? (headers as { get: (k: string) => unknown }).get('Authorization')
      : null) ||
    headers['Authorization'] ||
    headers['authorization'];

  if (!authHeader || typeof authHeader !== 'string') {
    return {
      errorResponse: [
        401,
        {
          success: false,
          message: 'Full authentication is required to access this resource',
          statusCode: 401,
          data: null,
          errors: { error_code: 'UNAUTHORIZED' },
        },
      ],
    };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return {
      errorResponse: [
        401,
        {
          success: false,
          message: 'Malformed Bearer token',
          statusCode: 401,
          data: null,
          errors: { error_code: 'INVALID_TOKEN' },
        },
      ],
    };
  }

  const token = parts[1];
  if (token === 'expired_token' || token.includes('expired')) {
    return {
      errorResponse: [
        401,
        {
          success: false,
          message: 'Session has expired or token is invalid',
          statusCode: 401,
          data: null,
          errors: { error_code: 'TOKEN_EXPIRED' },
        },
      ],
    };
  }

  const state = getStoreState();
  // Match account by user_id embedded in token, or fallback to role in token
  let matched = state.accounts.find((a) => token.includes(a.user_id));
  if (!matched) {
    if (token.includes('consumer')) matched = state.accounts.find((a) => a.role === 'CONSUMER');
    else if (token.includes('admin')) matched = state.accounts.find((a) => a.role === 'ADMIN');
    else if (token.includes('agent')) matched = state.accounts.find((a) => a.role === 'AGENT');
  }

  if (!matched) {
    return {
      errorResponse: [
        401,
        {
          success: false,
          message: 'Invalid session or account not found',
          statusCode: 401,
          data: null,
          errors: { error_code: 'INVALID_SESSION' },
        },
      ],
    };
  }

  return { account: matched };
}

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

  mock = new MockAdapter(axiosClient, { delayResponse: 50 });

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
    // Embed account user_id into token for deterministic session-ownership resolution
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
        access_token: `mock_jwt_${account.user_id}_${Date.now()}`,
        refresh_token: `mock_refresh_${account.user_id}_${Date.now()}`,
        token_type: 'Bearer',
        expires_in: 3600,
      },
      errors: null,
    };

    return [200, successRes];
  });

  // Simulated 401 expiry endpoint for testing session expiration (demo only)
  mock.onPost('/api/v1/auth/simulate-expire').reply(401, {
    success: false,
    message: 'Session has expired or token is invalid',
    statusCode: 401,
    data: null,
    errors: { error_code: 'TOKEN_EXPIRED' },
  });

  // -------------------------------------------------------------
  // 3.2 Scheduler Contract (Root Pagination & Ownership Enforcement)
  // -------------------------------------------------------------
  // A. Admin Schedules
  mock.onGet('/api/v1/admin/schedules').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;
    if (account?.role !== 'ADMIN') {
      return [
        403,
        {
          success: false,
          message: 'Forbidden: Admin role required',
          statusCode: 403,
          data: null,
          errors: { error_code: 'FORBIDDEN' },
        },
      ];
    }

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | undefined>;

    let filtered = state.schedules;
    if (params.area_code) {
      filtered = filtered.filter((s) => s.area_code === params.area_code);
    }
    if (params.assigned_agent_id) {
      filtered = filtered.filter((s) => s.assigned_agent_id === params.assigned_agent_id);
    }
    if (params.start_date) {
      filtered = filtered.filter((s) => s.scheduled_date >= params.start_date!);
    }
    if (params.end_date) {
      filtered = filtered.filter((s) => s.scheduled_date <= params.end_date!);
    }

    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.max(1, Number(params.size) || 20);
    const total = filtered.length;
    const content = filtered.slice(page * size, (page + 1) * size);

    const res: AdminSchedulesResponse = {
      content,
      page_number: page,
      page_size: size,
      total_elements: total,
      total_pages: Math.ceil(total / size) || 1,
      last: (page + 1) * size >= total,
    };
    return [200, res];
  });

  // B. Agent Schedules (Only assigned to the signed-in Agent)
  mock.onGet('/api/v1/agent/schedules').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;
    if (account?.role !== 'AGENT') {
      return [
        403,
        {
          success: false,
          message: 'Forbidden: Agent role required',
          statusCode: 403,
          data: null,
          errors: { error_code: 'FORBIDDEN' },
        },
      ];
    }

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | undefined>;

    // Enforce ownership: Agent sees ONLY their own assigned schedules
    let filtered = state.schedules.filter((s) => s.assigned_agent_id === account.user_id);

    if (params.start_date) {
      filtered = filtered.filter((s) => s.scheduled_date >= params.start_date!);
    }
    if (params.end_date) {
      filtered = filtered.filter((s) => s.scheduled_date <= params.end_date!);
    }
    if (params.start_time) {
      filtered = filtered.filter((s) => s.start_time >= params.start_time!);
    }
    if (params.end_time) {
      filtered = filtered.filter((s) => s.end_time <= params.end_time!);
    }

    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.max(1, Number(params.size) || 20);
    const total = filtered.length;
    const paged = filtered.slice(page * size, (page + 1) * size);

    const content = paged.map((s) => ({
      id: s.id,
      area_code: s.area_code,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
    }));

    const res: AgentSchedulesResponse = {
      content,
      page_number: page,
      page_size: size,
      total_elements: total,
      total_pages: Math.ceil(total / size) || 1,
      last: (page + 1) * size >= total,
    };
    return [200, res];
  });

  // C. Consumer Schedules (Permitted neighborhood timetable only)
  mock.onGet('/api/v1/consumer/schedules').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;
    if (account?.role !== 'CONSUMER') {
      return [
        403,
        {
          success: false,
          message: 'Forbidden: Consumer role required',
          statusCode: 403,
          data: null,
          errors: { error_code: 'FORBIDDEN' },
        },
      ];
    }

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | undefined>;
    const permittedArea = account.area_code || '600001';

    // Enforce permitted area: If consumer requests an unpermitted area, return empty content
    if (params.area_code && params.area_code !== permittedArea) {
      const res: ConsumerSchedulesResponse = {
        content: [],
        page_number: 0,
        page_size: Number(params.size) || 10,
        total_elements: 0,
        total_pages: 1,
        last: true,
      };
      return [200, res];
    }

    let filtered = state.schedules.filter((s) => s.area_code === permittedArea);
    if (params.start_date) {
      filtered = filtered.filter((s) => s.scheduled_date >= params.start_date!);
    }
    if (params.end_date) {
      filtered = filtered.filter((s) => s.scheduled_date <= params.end_date!);
    }

    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.max(1, Number(params.size) || 10);
    const total = filtered.length;
    const paged = filtered.slice(page * size, (page + 1) * size);

    const content = paged.map((s) => ({
      id: s.id,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
    }));

    const res: ConsumerSchedulesResponse = {
      content,
      page_number: page,
      page_size: size,
      total_elements: total,
      total_pages: Math.ceil(total / size) || 1,
      last: (page + 1) * size >= total,
    };
    return [200, res];
  });

  // -------------------------------------------------------------
  // 3.3 Push & In-App Notification Contract (Ownership & Filters)
  // -------------------------------------------------------------
  // A. Device Token Registration
  mock.onPost('/api/v1/notifications/device-token').reply((config) => {
    let body: DeviceTokenRequest;
    try {
      body = JSON.parse(config.data || '{}') as DeviceTokenRequest;
    } catch {
      return [400, { message: 'Invalid device token registration payload' }];
    }
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
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;
    if (account?.role !== 'ADMIN') {
      return [403, { message: 'Forbidden: Admin role required' }];
    }

    const body = JSON.parse(config.data || '{}') as AdminNotificationSendRequest;
    const now = new Date().toISOString();
    const dispatchId = `disp-adm-${Date.now()}`;

    setStoreState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: body.title,
          body: body.body,
          status: 'UNREAD',
          created_at: now,
          target_type: body.target_type,
          target_value: body.target_value,
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
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;
    if (account?.role !== 'AGENT') {
      return [403, { message: 'Forbidden: Agent role required' }];
    }

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
          recipient_id: body.target_user_id,
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

  // D. Notification Inbox (Filtered by Recipient Ownership)
  mock.onGet('/api/v1/notifications').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | boolean | undefined>;

    // Ownership: users only see notifications targeted to them or broadcast to their group
    let filtered = state.notifications.filter((n) => {
      if (account!.role === 'ADMIN') return true;
      if (n.recipient_id && n.recipient_id === account!.user_id) return true;
      if (n.target_type === 'ALL') return true;
      if (n.target_type === 'ROLE' && n.target_value === account!.role) return true;
      if (n.target_type === 'PINCODE' && n.target_value === account!.area_code) return true;
      if (!n.recipient_id && !n.target_type && account!.role === 'CONSUMER') return true;
      return false;
    });

    if (params.unread_only === true || params.unread_only === 'true') {
      filtered = filtered.filter((n) => n.status === 'UNREAD');
    }

    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.max(1, Number(params.size) || 20);
    const total = filtered.length;
    const paged = filtered.slice(page * size, (page + 1) * size);

    // Strip internal recipient/target tracking to preserve exact Section 3.3 wire contract
    const content = paged.map(({ id, title, body, status, created_at }) => ({
      id,
      title,
      body,
      status,
      created_at,
    }));

    const res: NotificationsInboxResponse = {
      content,
      page_number: page,
      page_size: size,
      total_elements: total,
      total_pages: Math.ceil(total / size) || 1,
      last: (page + 1) * size >= total,
    };
    return [200, res];
  });

  // E. Mark Notification as Read (Enforces recipient ownership)
  mock.onPatch(/\/api\/v1\/notifications\/[^/]+\/read/).reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const match = config.url?.match(/\/api\/v1\/notifications\/([^/]+)\/read/);
    const notifId = match ? match[1] : '';
    const now = new Date().toISOString();

    const state = getStoreState();
    const existing = state.notifications.find((n) => n.id === notifId);

    if (!existing) {
      return [
        404,
        {
          success: false,
          message: 'Notification not found',
          statusCode: 404,
          data: null,
          errors: { error_code: 'NOT_FOUND' },
        },
      ];
    }

    // Ownership check: Mark-read should update only an existing notification owned by that recipient
    const isOwner =
      account!.role === 'ADMIN' ||
      (existing.recipient_id && existing.recipient_id === account!.user_id) ||
      existing.target_type === 'ALL' ||
      (existing.target_type === 'ROLE' && existing.target_value === account!.role) ||
      (existing.target_type === 'PINCODE' && existing.target_value === account!.area_code) ||
      (!existing.recipient_id && !existing.target_type && account!.role === 'CONSUMER');

    if (!isOwner) {
      return [
        403,
        {
          success: false,
          message: 'Forbidden: You do not have permission to modify this notification',
          statusCode: 403,
          data: null,
          errors: { error_code: 'FORBIDDEN' },
        },
      ];
    }

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

  console.log('🔌 [mockAdapter] Axios mock adapter registered with ownership enforcement.');
  return mock;
}

// Auto-initialize when in demo mode
if (IS_DEMO && USE_MOCK_API) {
  setupMockAdapter();
}
