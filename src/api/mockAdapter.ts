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
  registerPaymentOrder,
  getPaymentOrder,
  updatePaymentOrder,
} from './mockStore';
import { DemoUserAccount, StoredCollectionRecord } from './mockData';
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
  AgentScanQRRequest,
  AgentScanQRResponse,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaymentHistoryItem,
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
    const params = (config.params || {}) as Record<string, string | number | undefined>;
    const permittedArea = account.area_code;

    // Enforce permitted area: If consumer profile has no area or requests an unpermitted area, return empty content
    if (!permittedArea || (params.area_code && params.area_code !== permittedArea)) {
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
    if (params.start_date && typeof params.start_date === 'string') {
      filtered = filtered.filter((s) => s.scheduled_date >= (params.start_date as string));
    }
    if (params.end_date && typeof params.end_date === 'string') {
      filtered = filtered.filter((s) => s.scheduled_date <= (params.end_date as string));
    }

    // Sort by scheduled_date ASC, start_time ASC
    filtered.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.start_time.localeCompare(b.start_time));

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

    // Earliest eligible upcoming pickup using Asia/Kolkata timezone
    const nowIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const nowTimeIST = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    const permittedArea = account!.area_code;
    const eligibleUpcoming = permittedArea
      ? state.schedules
          .filter(
            (s) =>
              s.area_code === permittedArea &&
              (s.status === 'ASSIGNED' || s.status === 'IN_PROGRESS') &&
              (s.scheduled_date > nowIST || (s.scheduled_date === nowIST && s.end_time >= nowTimeIST))
          )
          .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.start_time.localeCompare(b.start_time))
      : [];

    const nextSchedule = eligibleUpcoming[0] || null;

    // Derive recent pickups strictly from stored collection records
    const userCollections = (state.collections || []).filter(
      (c) =>
        c.consumer_id === account!.user_id ||
        (account!.qr_payload && c.qr_payload === account!.qr_payload)
    );
    const recentPickups = userCollections.map((c) => ({
      id: c.id,
      date: c.date,
      status: c.status,
      agent_name: c.agent_name,
      waste_weight_kg: c.waste_weight_kg,
    }));

    const res: ConsumerDashboardResponse = {
      pending_amount: pendingAmount,
      due_date: dueDate,
      next_schedule: nextSchedule,
      qr_payload: account!.qr_payload || '',
      recent_pickups: recentPickups,
    };
    return [200, res];
  });

  // 4. Agent QR Scan Verification & Duplicate Prevention (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onPost('/api/v1/agent/collections/scan-qr').reply((config) => {
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

    let body: AgentScanQRRequest;
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    } catch {
      return [400, { success: false, message: 'Invalid payload', statusCode: 400, errors: { error_code: 'INVALID_PAYLOAD' } }];
    }

    if (!body.qr_payload) {
      return [
        400,
        {
          success: false,
          message: 'Missing required qr_payload',
          statusCode: 400,
          errors: { error_code: 'MISSING_QR_PAYLOAD' },
        },
      ];
    }

    const state = getStoreState();

    // Resolve target consumer and household strictly from the QR payload
    const targetConsumer = state.accounts.find((a) => a.qr_payload === body.qr_payload);
    const targetHousehold =
      state.households.find((h) => h.qr_payload === body.qr_payload) ||
      (targetConsumer ? state.households.find((h) => h.mobile_number === targetConsumer.mobile_number) : undefined);

    if (!targetConsumer && !targetHousehold) {
      return [
        404,
        {
          success: false,
          message: 'Household QR code not recognized or unregistered',
          statusCode: 404,
          errors: { error_code: 'HOUSEHOLD_NOT_FOUND' },
        },
      ];
    }

    // Validate identity: if consumer_id was provided, it must match the resolved household
    const resolvedConsumerId = targetConsumer?.user_id || targetHousehold?.id;
    if (body.consumer_id && resolvedConsumerId && body.consumer_id !== resolvedConsumerId && body.consumer_id !== targetHousehold?.id) {
      return [
        400,
        {
          success: false,
          message: 'Supplied consumer ID does not match the household resolved from QR token',
          statusCode: 400,
          errors: { error_code: 'IDENTITY_MISMATCH' },
        },
      ];
    }

    const targetArea = targetConsumer?.area_code || targetHousehold?.area_code || '';
    const assignedAreas = new Set([
      ...(account.assigned_area_codes || []),
      ...state.schedules.filter((s) => s.assigned_agent_id === account.user_id).map((s) => s.area_code),
      ...(account.area_code ? [account.area_code] : []),
    ]);

    if (!targetArea || !assignedAreas.has(targetArea)) {
      return [
        400,
        {
          success: false,
          message: `Target household area (Ward ${targetArea || 'unknown'}) is outside agent assigned routes`,
          statusCode: 400,
          errors: { error_code: 'OUTSIDE_ASSIGNED_ROUTE' },
        },
      ];
    }

    // Determine current date in Asia/Kolkata
    const todayIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const consumerUserId = targetConsumer?.user_id || targetHousehold?.id || 'unknown';

    // Duplicate Prevention: Check if already collected today for this household
    const existingCollection = (state.collections || []).find(
      (c) =>
        c.date === todayIST &&
        (c.qr_payload === body.qr_payload || (consumerUserId && c.consumer_id === consumerUserId))
    );

    if (existingCollection) {
      const res: AgentScanQRResponse = {
        collection_id: existingCollection.id,
        status: 'ALREADY_COLLECTED',
        timestamp: existingCollection.timestamp,
        message: 'Household waste collection already completed for today. Duplicate scan ignored.',
      };
      return [200, res];
    }

    const nowIso = new Date().toISOString();
    const newCollectionId = `col-${Date.now()}`;
    const newCollection: StoredCollectionRecord = {
      id: newCollectionId,
      consumer_id: consumerUserId,
      household_id: targetHousehold?.id || `hh-${consumerUserId}`,
      qr_payload: body.qr_payload,
      date: todayIST,
      timestamp: nowIso,
      status: 'COLLECTED',
      agent_id: account.user_id,
      agent_name: account.name,
      waste_weight_kg: Number(body.waste_weight_kg) || 3.5,
      notes: body.notes || 'Routine segregated waste collection',
    };

    setStoreState((prev) => ({
      ...prev,
      collections: [newCollection, ...(prev.collections || [])],
    }));

    const res: AgentScanQRResponse = {
      collection_id: newCollectionId,
      status: 'COLLECTED',
      timestamp: nowIso,
      message: 'Waste collection successfully recorded and credited.',
    };
    return [201, res];
  });

  // 5. Payments: Create Order & Verify (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onPost('/api/v1/payments/create-order').reply((config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    let body: CreatePaymentOrderRequest;
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    } catch {
      body = {};
    }

    const state = getStoreState();
    const userPayments = state.payments.filter((p) => p.consumer_id === account!.user_id);
    const unpaidInvoices = userPayments.filter((p) => p.status === 'UNPAID');

    let targetInvoice: PaymentHistoryItem | undefined;
    if (body.invoice_id) {
      targetInvoice = unpaidInvoices.find((p) => p.invoice_id === body.invoice_id);
      if (!targetInvoice) {
        return [
          404,
          {
            success: false,
            message: `Unpaid invoice "${body.invoice_id}" not found for signed-in consumer`,
            statusCode: 404,
            data: null,
            errors: { error_code: 'INVOICE_NOT_FOUND' },
          },
        ];
      }
    } else {
      if (unpaidInvoices.length === 1) {
        targetInvoice = unpaidInvoices[0];
      } else if (unpaidInvoices.length === 0) {
        return [
          404,
          {
            success: false,
            message: 'No unpaid invoices found for consumer',
            statusCode: 404,
            data: null,
            errors: { error_code: 'NO_UNPAID_INVOICES' },
          },
        ];
      } else {
        return [
          400,
          {
            success: false,
            message: 'Multiple unpaid invoices exist. Specific invoice_id must be provided.',
            statusCode: 400,
            data: null,
            errors: { error_code: 'INVOICE_REQUIRED' },
          },
        ];
      }
    }

    // Amount bound strictly to the unpaid invoice from the ledger
    const boundAmount = targetInvoice.amount;
    const orderId = `order_${targetInvoice.invoice_id}_${Date.now()}`;

    registerPaymentOrder({
      order_id: orderId,
      invoice_id: targetInvoice.invoice_id,
      consumer_id: account!.user_id,
      amount: boundAmount,
      currency: 'INR',
      key_id: 'rzp_test_greenpulse_demo',
      status: 'CREATED',
      receipt_id: `rcpt_${targetInvoice.invoice_id}`,
      created_at: new Date().toISOString(),
    });

    const res: CreatePaymentOrderResponse = {
      order_id: orderId,
      amount: boundAmount,
      currency: 'INR',
      key_id: 'rzp_test_greenpulse_demo',
      invoice_id: targetInvoice.invoice_id,
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

    // 1. Validate order exists and belongs to signed-in consumer
    const registeredOrder = getPaymentOrder(body.razorpay_order_id);
    if (!registeredOrder || registeredOrder.consumer_id !== account!.user_id) {
      return [
        400,
        {
          success: false,
          message: 'Order ID is invalid, missing, or belongs to another consumer. Balances unchanged.',
          statusCode: 400,
          data: null,
          errors: { error_code: 'INVALID_ORDER' },
        },
      ];
    }

    // 2. Validate invoice ID match if provided
    if (body.invoice_id && body.invoice_id !== registeredOrder.invoice_id) {
      return [
        400,
        {
          success: false,
          message: 'Invoice ID does not match the bound payment order. Balances unchanged.',
          statusCode: 400,
          data: null,
          errors: { error_code: 'INVOICE_MISMATCH' },
        },
      ];
    }

    const state = getStoreState();
    const targetInvoice = state.payments.find(
      (p) => p.invoice_id === registeredOrder.invoice_id && p.consumer_id === account!.user_id
    );

    if (!targetInvoice) {
      return [
        404,
        {
          success: false,
          message: 'Target invoice not found in ledger. Balances unchanged.',
          statusCode: 404,
          data: null,
          errors: { error_code: 'INVOICE_NOT_FOUND' },
        },
      ];
    }

    const now = new Date().toISOString();

    // 3. The invoice ledger is authoritative for simulated payment success
    // A retry must never return a paid receipt while the bound invoice is still unpaid.
    if (targetInvoice.status === 'PAID') {
      if (registeredOrder.status !== 'PAID') {
        updatePaymentOrder(registeredOrder.order_id, {
          status: 'PAID',
          paid_at: targetInvoice.paid_at || now,
        });
      }
      const res: VerifyPaymentResponse = {
        invoice_id: targetInvoice.invoice_id,
        status: 'PAID',
        paid_at: targetInvoice.paid_at || registeredOrder.paid_at || now,
      };
      return [200, res];
    }

    // 4. Atomically settle the UNPAID invoice in the shared store
    updatePaymentOrder(registeredOrder.order_id, {
      status: 'PAID',
      paid_at: now,
    });

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
    let records: PaymentHistoryItem[] = [];

    if (account!.role === 'CONSUMER') {
      records = state.payments.filter((p) => p.consumer_id === account!.user_id);
    } else if (account!.role === 'AGENT') {
      // Filtered strictly to agent-authorized records (routes assigned to this agent)
      const assignedAreas = new Set([
        ...(account!.assigned_area_codes || []),
        ...state.schedules.filter((s) => s.assigned_agent_id === account!.user_id).map((s) => s.area_code),
        ...(account!.area_code ? [account!.area_code] : []),
      ]);
      records = state.payments.filter((p) => assignedAreas.has(p.area_code));
    } else {
      records = state.payments;
    }

    if (params.status) {
      records = records.filter((p) => p.status === params.status);
    }
    if (params.start_date) {
      records = records.filter((p) => (p.paid_at || p.due_date || '') >= params.start_date!);
    }
    if (params.end_date) {
      records = records.filter((p) => (p.paid_at || p.due_date || '') <= params.end_date!);
    }

    const res: PaymentHistoryResponse = {
      content: records,
      page_number: 0,
      page_size: 20,
      total_elements: records.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // 7. Manual Pickup Requests & Claims (Section 4 // TODO_BACKEND_SATHEESH)
  mock.onGet('/api/v1/requests').reply(async (config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;

    const state = getStoreState();
    const params = (config.params || {}) as Record<string, string | undefined>;
    let reqs: ManualPickupRequestItem[] = [];

    // Support shared multi-context test fixture if exposed on window
    const sharedGet = typeof window !== 'undefined'
      ? (window as unknown as { __SHARED_GET_REQUESTS__?: () => Promise<ManualPickupRequestItem[]> | ManualPickupRequestItem[] }).__SHARED_GET_REQUESTS__
      : undefined;

    let sourceRequests = state.pickupRequests;
    if (typeof sharedGet === 'function') {
      try {
        const shared = await sharedGet();
        if (Array.isArray(shared)) {
          sourceRequests = shared;
        }
      } catch {
        // fallback to state
      }
    }

    if (account!.role === 'CONSUMER') {
      reqs = sourceRequests.filter((r) => r.consumer_id === account!.user_id);
    } else if (account!.role === 'AGENT') {
      const assignedAreas = new Set([
        ...(account!.assigned_area_codes || []),
        ...state.schedules.filter((s) => s.assigned_agent_id === account!.user_id).map((s) => s.area_code),
        ...(account!.area_code ? [account!.area_code] : []),
      ]);
      reqs = sourceRequests.filter((r) => assignedAreas.has(r.area_code));
    } else {
      reqs = sourceRequests;
    }

    if (params.status) {
      reqs = reqs.filter((r) => r.status === params.status);
    }

    const res: ManualPickupRequestsResponse = {
      content: reqs,
      page_number: 0,
      page_size: 20,
      total_elements: reqs.length,
      total_pages: 1,
      last: true,
    };
    return [200, res];
  });

  // Aligned claim path with PLAN.md Section 4: POST /api/v1/agent/requests/{id}/claim (supports legacy /api/v1/requests/{id}/claim too)
  mock.onPost(/\/api\/v1\/(?:agent\/)?requests\/[^/]+\/claim/).reply(async (config) => {
    const { account, errorResponse } = resolveAccount(config);
    if (errorResponse) return errorResponse;
    if (account?.role !== 'AGENT') {
      return [
        403,
        {
          success: false,
          message: 'Forbidden: Agent role required',
          statusCode: 403,
          errors: { error_code: 'FORBIDDEN' },
        },
      ];
    }

    const parts = config.url?.split('/') || [];
    const claimIdx = parts.indexOf('claim');
    const requestId = claimIdx > 0 ? parts[claimIdx - 1] : parts[parts.length - 2];

    // Delegate to shared multi-context test fixture if exposed
    const sharedClaim = typeof window !== 'undefined'
      ? (window as unknown as { __SHARED_CLAIM_FIXTURE__?: (id: string, agt: { user_id: string; name: string }) => Promise<{ status: number; data?: ManualPickupRequestItem; message?: string; errors?: unknown }> }).__SHARED_CLAIM_FIXTURE__
      : undefined;

    if (typeof sharedClaim === 'function') {
      const fixRes = await sharedClaim(requestId, { user_id: account.user_id, name: account.name });
      if (fixRes.status === 200 && fixRes.data) {
        setStoreState((prev) => ({
          ...prev,
          pickupRequests: prev.pickupRequests.map((r) => (r.id === requestId ? fixRes.data! : r)),
        }));
        return [200, fixRes.data];
      } else {
        return [
          fixRes.status,
          {
            success: false,
            message: fixRes.message,
            statusCode: fixRes.status,
            data: null,
            errors: fixRes.errors || { error_code: 'CONFLICT' },
          },
        ];
      }
    }

    const state = getStoreState();
    const target = state.pickupRequests.find((r) => r.id === requestId);

    if (!target) {
      return [
        404,
        {
          success: false,
          message: 'Pickup request not found',
          statusCode: 404,
          errors: { error_code: 'NOT_FOUND' },
        },
      ];
    }

    // Atomic conflict verification: Request MUST be PENDING
    if (target.status !== 'PENDING') {
      return [
        409,
        {
          success: false,
          message: `This request has already been claimed by another agent (${target.claimed_by_agent_name || 'claimed'}).`,
          statusCode: 409,
          data: null,
          errors: {
            error_code: 'CONFLICT',
            current_status: target.status,
            owner_id: target.claimed_by_agent_id,
          },
        },
      ];
    }

    const updated: ManualPickupRequestItem = {
      ...target,
      status: 'CLAIMED',
      claimed_by_agent_id: account.user_id,
      claimed_by_agent_name: account.name,
    };

    setStoreState((prev) => ({
      ...prev,
      pickupRequests: prev.pickupRequests.map((r) => (r.id === requestId ? updated : r)),
    }));

    return [200, updated];
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
      user_role: account!.role,
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
