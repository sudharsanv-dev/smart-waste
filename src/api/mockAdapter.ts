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
  ConsumerRegisterRequest,
  ConsumerRegisterResponse,
  ConsumerDashboardResponse,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaymentHistoryResponse,
  CreatePickupRequestPayload,
  ManualPickupRequestItem,
  ManualPickupRequestsResponse,
  CreateSupportTicketRequest,
  SupportTicketItem,
  SupportTicketsResponse,
  AdminDashboardKPIs,
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

  // =========================================================================
  // SECTION 4: PROPOSED BACKEND GAP-FILLER MOCK HANDLERS (TODO_BACKEND_SATHEESH)
  // =========================================================================

  // 1. Consumer Registration (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onPost('/api/v1/consumers/register').reply((config) => {
    let body: ConsumerRegisterRequest;
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    } catch {
      return [400, { success: false, message: 'Invalid JSON payload', statusCode: 400, data: null, errors: { error_code: 'INVALID_JSON' } }];
    }

    if (!body.name || !body.mobile_number || !body.password || !body.area_code) {
      return [400, { success: false, message: 'Missing required registration fields', statusCode: 400, data: null, errors: { error_code: 'VALIDATION_ERROR' } }];
    }

    const state = getStoreState();
    const existing = state.accounts.find((a) => a.mobile_number === body.mobile_number && a.role === 'CONSUMER');
    if (existing) {
      return [400, { success: false, message: 'Mobile number already registered', statusCode: 400, data: null, errors: { error_code: 'DUPLICATE_MOBILE' } }];
    }

    const newUserId = 'c-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const rawHex = Math.random().toString(16).substring(2, 10).toUpperCase() + Math.random().toString(16).substring(2, 10).toUpperCase();
    const opaqueQrPayload = `GPC-QR-CONS-${rawHex}`;

    const newAccount: DemoUserAccount = {
      user_id: newUserId,
      name: body.name,
      mobile_number: body.mobile_number,
      password: body.password,
      role: 'CONSUMER',
      area_code: body.area_code,
      qr_payload: opaqueQrPayload,
    };

    const newHousehold = {
      id: `hh-${Date.now().toString(36)}`,
      name: body.name,
      mobile_number: body.mobile_number,
      email: body.email || '',
      address: body.address || '',
      area_code: body.area_code,
      is_active: true,
      qr_payload: opaqueQrPayload,
      created_at: new Date().toISOString(),
    };

    setStoreState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      households: [...prev.households, newHousehold],
    }));

    const res: ConsumerRegisterResponse = {
      user_id: newUserId,
      qr_code_payload: opaqueQrPayload,
      area_code: body.area_code,
    };
    return [201, res];
  });

  // 2. Consumer Dashboard (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onGet('/api/v1/consumers/me/dashboard').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const userPayments = state.payments.filter((p) => p.consumer_id === account!.user_id);
    const unpaidPayments = userPayments.filter((p) => p.status === 'UNPAID');
    const pendingAmount = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);
    const dueDate = unpaidPayments[0]?.due_date || '2026-11-30';

    const nextSchedule = state.schedules.find(
      (s) => s.area_code === account!.area_code && (s.status === 'ASSIGNED' || s.status === 'IN_PROGRESS')
    );

    const isSeededJohn = account!.user_id === 'c1d2e3f4-a5b6-7890-1234-56789abcdef0';
    const recentPickups = isSeededJohn
      ? [
          {
            id: 'col-001',
            date: '2026-11-14',
            status: 'COLLECTED',
            agent_name: 'Ramesh Kumar',
            waste_weight_kg: 3.2,
          },
        ]
      : [];

    const res: ConsumerDashboardResponse = {
      pending_amount: pendingAmount,
      due_date: dueDate,
      next_schedule: nextSchedule || null,
      qr_payload: account!.qr_payload || 'GPC-QR-CONS-DEFAULT',
      recent_pickups: recentPickups,
    };
    return [200, res];
  });

  // 5. Payments: Create Order & Verify (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onPost('/api/v1/payments/create-order').reply((config) => {
    const { errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    let body: CreatePaymentOrderRequest;
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    } catch {
      body = { amount: 150 };
    }

    const res: CreatePaymentOrderResponse = {
      order_id: `order_rcptid_${Date.now()}`,
      amount: body.amount || 150,
      currency: 'INR',
      key_id: 'rzp_test_greenpulse_demo',
    };
    return [200, res];
  });

  // Payments Verify — Idempotent Single-Settlement Exit Gate
  mock.onPost('/api/v1/payments/verify').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    let body: VerifyPaymentRequest = { razorpay_order_id: '', razorpay_payment_id: '', razorpay_signature: '' };
    try {
      if (typeof config.data === 'string') {
        body = JSON.parse(config.data);
      } else if (config.data) {
        body = config.data;
      }
    } catch {
      // ignore
    }

    const state = getStoreState();
    const userPayments = state.payments.filter((p) => p.consumer_id === account!.user_id);
    const targetInvoice =
      (body.invoice_id ? userPayments.find((p) => p.invoice_id === body.invoice_id) : null) ||
      userPayments.find((p) => p.status === 'UNPAID') ||
      userPayments.find((p) => p.invoice_id === 'inv-2026-11-002') ||
      userPayments.find((p) => p.status === 'PAID');

    if (!targetInvoice) {
      return [404, { success: false, message: 'No invoice found for consumer', statusCode: 404, data: null, errors: { error_code: 'INVOICE_NOT_FOUND' } }];
    }

    const now = new Date().toISOString();

    // IDEMPOTENCY GUARD: If target invoice is already PAID, return existing receipt WITHOUT duplicating ledger records
    if (targetInvoice.status === 'PAID') {
      const res: VerifyPaymentResponse = {
        invoice_id: targetInvoice.invoice_id,
        status: 'PAID',
        paid_at: targetInvoice.paid_at || now,
      };
      return [200, res];
    }

    // Atomically settle the UNPAID invoice in the shared store
    setStoreState((prev) => ({
      ...prev,
      payments: prev.payments.map((p) =>
        p.id === targetInvoice.id
          ? {
              ...p,
              status: 'PAID',
              paid_at: now,
              payment_method: 'UPI / Razorpay Simulator',
            }
          : p
      ),
    }));

    const res: VerifyPaymentResponse = {
      invoice_id: targetInvoice.invoice_id,
      status: 'PAID',
      paid_at: now,
    };
    return [200, res];
  });

  // 6. Fee Collection History (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onGet('/api/v1/payments/history').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | undefined>;
    let userPayments = state.payments.filter((p) => p.consumer_id === account!.user_id);

    if (params.status) {
      userPayments = userPayments.filter((p) => p.status === params.status);
    }

    const res: PaymentHistoryResponse = {
      content: userPayments,
      page_number: 0,
      page_size: 20,
      total_elements: userPayments.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // 7. Manual Pickup Requests (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onGet('/api/v1/requests').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const userReqs = state.pickupRequests.filter((r) => r.consumer_id === account!.user_id);

    const res: ManualPickupRequestsResponse = {
      content: userReqs,
      page_number: 0,
      page_size: 20,
      total_elements: userReqs.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  mock.onPost('/api/v1/requests').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    let body: CreatePickupRequestPayload;
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    } catch {
      return [400, { success: false, message: 'Invalid JSON payload', statusCode: 400, data: null, errors: { error_code: 'INVALID_JSON' } }];
    }

    const newReq: ManualPickupRequestItem = {
      id: `req-${Date.now()}`,
      consumer_id: account!.user_id,
      consumer_name: account!.name,
      consumer_mobile: account!.mobile_number || '',
      area_code: account!.area_code || '600001',
      waste_type: body.waste_type,
      preferred_date: body.preferred_date,
      address: body.address || 'Registered Address',
      notes: body.notes || '',
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    setStoreState((prev) => ({
      ...prev,
      pickupRequests: [newReq, ...prev.pickupRequests],
    }));

    return [201, newReq];
  });

  // 8. Help & Support Tickets (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onGet('/api/v1/support/tickets').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const userTickets = state.tickets.filter((t) => t.user_id === account!.user_id);

    const res: SupportTicketsResponse = {
      content: userTickets,
      page_number: 0,
      page_size: 20,
      total_elements: userTickets.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  mock.onPost('/api/v1/support/tickets').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    let body: CreateSupportTicketRequest;
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    } catch {
      return [400, { success: false, message: 'Invalid JSON payload', statusCode: 400, data: null, errors: { error_code: 'INVALID_JSON' } }];
    }

    const now = new Date().toISOString();
    const newTkt: SupportTicketItem = {
      ticket_id: `tkt-${Date.now()}`,
      user_id: account!.user_id,
      user_name: account!.name,
      user_role: 'CONSUMER',
      subject: body.subject,
      category: body.category,
      description: body.description,
      status: 'OPEN',
      created_at: now,
      updated_at: now,
    };

    setStoreState((prev) => ({
      ...prev,
      tickets: [newTkt, ...prev.tickets],
    }));

    return [201, newTkt];
  });

  // 9. Admin Dashboard KPIs (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onGet('/api/v1/admin/dashboard').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    if (account?.role !== 'ADMIN') {
      return [403, { success: false, message: 'Access denied: Requires ADMIN role', statusCode: 403, data: null, errors: { error_code: 'FORBIDDEN' } }];
    }

    const state = getStoreState();
    const totalCollected = state.payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingFees = state.payments
      .filter((p) => p.status === 'UNPAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const coveredAreas = new Set(state.schedules.map((s) => s.area_code)).size;
    const pendingHouses = state.households.filter((h) => (h as unknown as { status?: string }).status === 'Pending Pickup' || !(h as unknown as { status?: string }).status).length;

    const res: AdminDashboardKPIs = {
      total_collected: totalCollected,
      pending_fees: pendingFees,
      covered_areas: coveredAreas,
      pending_houses: pendingHouses,
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
