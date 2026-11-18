// src/api/mockAdapter.ts
// Demo-only Axios mock adapter registered ONLY when USE_MOCK_API && IS_DEMO are true
// Implements exact Section 3 Locked API Contracts with exact session identity resolution

import MockAdapter from 'axios-mock-adapter';
import { axiosClient } from './axiosClient';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';
import {
  getStoreState,
  setStoreState,
  registerDemoSession,
  getDemoSession,
  deleteDemoSession,
  DemoSessionRecord,
} from './mockStore';
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

// Helper to resolve the authenticated demo account strictly from registered sessions
function resolveAccount(config: { headers?: unknown }): {
  account?: DemoUserAccount;
  session?: DemoSessionRecord;
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
  // Resolve demo identity from an exact session issued by mock login (no text matching)
  const session = getDemoSession(token);
  if (!session) {
    return {
      errorResponse: [
        401,
        {
          success: false,
          message: 'Session has expired or is invalid',
          statusCode: 401,
          data: null,
          errors: { error_code: 'INVALID_SESSION' },
        },
      ],
    };
  }

  const state = getStoreState();
  const matched = state.accounts.find((a) => a.user_id === session.user_id);
  if (!matched) {
    return {
      errorResponse: [
        401,
        {
          success: false,
          message: 'Account not found for active session',
          statusCode: 401,
          data: null,
          errors: { error_code: 'INVALID_SESSION' },
        },
      ],
    };
  }

  return { account: matched, session };
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

    // Generate opaque session token bound to this account and expiry time
    const sessionToken = `demo_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresIn = 3600;
    registerDemoSession({
      token: sessionToken,
      user_id: account.user_id,
      role: account.role,
      expires_at: Date.now() + expiresIn * 1000,
    });

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
        access_token: sessionToken,
        refresh_token: `mock_refresh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        token_type: 'Bearer',
        expires_in: expiresIn,
      },
      errors: null,
    };

    return [200, successRes];
  });

  // Simulated 401 expiry endpoint for testing session expiration (demo only)
  mock.onPost('/api/v1/auth/simulate-expire').reply((config) => {
    const { session } = resolveAccount(config);
    if (session) {
      deleteDemoSession(session.token);
    }
    return [
      401,
      {
        success: false,
        message: 'Session has expired or token is invalid',
        statusCode: 401,
        data: null,
        errors: { error_code: 'TOKEN_EXPIRED' },
      },
    ];
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
  // A. Device Token Registration (Requires authenticated session)
  mock.onPost('/api/v1/notifications/device-token').reply((config) => {
    const { errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

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
          read_by: [],
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

    let body: AgentNotificationSendRequest;
    try {
      body = JSON.parse(config.data || '{}') as AgentNotificationSendRequest;
    } catch {
      return [400, { message: 'Invalid payload' }];
    }

    const state = getStoreState();

    // Validate that agent's arrival notification targets a consumer on their assigned route
    const targetConsumer =
      state.accounts.find((a) => a.user_id === body.target_user_id) ||
      state.households.find((h) => h.id === body.target_user_id);

    if (!targetConsumer) {
      return [
        404,
        {
          success: false,
          message: 'Target consumer not found',
          statusCode: 404,
          errors: { error_code: 'NOT_FOUND' },
        },
      ];
    }

    const targetArea = targetConsumer.area_code;
    const assignedAreas = new Set([
      ...(account.assigned_area_codes || []),
      ...state.schedules.filter((s) => s.assigned_agent_id === account.user_id).map((s) => s.area_code),
    ]);

    if (!targetArea || !assignedAreas.has(targetArea)) {
      return [
        400,
        {
          success: false,
          message: `Target consumer area (${targetArea || 'unknown'}) is outside agent assigned routes`,
          statusCode: 400,
          errors: { error_code: 'OUTSIDE_ASSIGNED_ROUTE' },
        },
      ];
    }

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
          target_user_id: body.target_user_id,
          read_by: [],
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

  // D. Notification Inbox (Personal inbox: addressed to user or matching audience)
  mock.onGet('/api/v1/notifications').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | boolean | undefined>;

    // Personal inbox contains only notifications addressed to the signed-in user or matching audience (applied to admins too)
    const filtered = state.notifications.filter((n) => {
      // Direct notification to this user
      if (n.target_user_id && n.target_user_id === account!.user_id) return true;
      // Broadcast to all
      if (n.target_type === 'ALL') return true;
      // Broadcast to user's role
      if (n.target_type === 'ROLE' && n.target_value === account!.role) return true;
      // Location broadcast to consumer's area
      if (n.target_type === 'PINCODE' && account!.role === 'CONSUMER' && n.target_value === account!.area_code) {
        return true;
      }
      return false;
    });

    // Account-specific read status for each recipient (preserving locked Section 3 response shape)
    const mapped = filtered.map((n) => {
      const isRead =
        (Array.isArray(n.read_by) && n.read_by.includes(account!.user_id)) ||
        (n.status === 'READ' && n.target_user_id === account!.user_id);
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        status: (isRead ? 'READ' : 'UNREAD') as 'UNREAD' | 'READ',
        created_at: n.created_at,
      };
    });

    const unreadOnly = params.unread_only === true || params.unread_only === 'true';
    const finalItems = unreadOnly ? mapped.filter((n) => n.status === 'UNREAD') : mapped;

    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.max(1, Number(params.size) || 20);
    const total = finalItems.length;
    const content = finalItems.slice(page * size, (page + 1) * size);

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

  // E. Mark Notification as Read (Updates read status specifically for this recipient)
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

    // Ownership check: must be addressed to this user or their matching audience
    const isRecipient =
      (existing.target_user_id && existing.target_user_id === account!.user_id) ||
      existing.target_type === 'ALL' ||
      (existing.target_type === 'ROLE' && existing.target_value === account!.role) ||
      (existing.target_type === 'PINCODE' && account!.role === 'CONSUMER' && existing.target_value === account!.area_code);

    if (!isRecipient) {
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

    // Update read status for this specific recipient
    setStoreState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => {
        if (n.id !== notifId) return n;
        const currentReadBy = Array.isArray(n.read_by) ? n.read_by : [];
        const nextReadBy = currentReadBy.includes(account!.user_id)
          ? currentReadBy
          : [...currentReadBy, account!.user_id];
        return {
          ...n,
          status: n.target_user_id === account!.user_id ? ('READ' as const) : n.status,
          read_by: nextReadBy,
        };
      }),
    }));

    const res: NotificationMarkReadResponse = {
      id: notifId,
      status: 'READ',
      updated_at: now,
    };
    return [200, res];
  });

  console.log('🔌 [mockAdapter] Axios mock adapter registered with exact session resolution.');
  return mock;
}

// Auto-initialize when in demo mode
if (IS_DEMO && USE_MOCK_API) {
  setupMockAdapter();
}
