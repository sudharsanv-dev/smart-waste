// src/types/contracts.ts
// Strict TypeScript types for Section 3 (LOCKED) and Section 4 (PROPOSED TODO_BACKEND_SATHEESH)

// ==========================================
// SECTION 3: LOCKED BACKEND CONTRACTS
// ==========================================

export type UserRole = 'CONSUMER' | 'ADMIN' | 'AGENT';

export type ConsumerLoginRequest = {
  mobile_number: string;
  password: string;
  type: 'CONSUMER';
};

export type AdminLoginRequest = {
  username: string;
  password: string;
  type: 'ADMIN';
};

export type AgentLoginRequest = {
  mobile_number: string;
  password: string;
  type: 'AGENT';
};

export type AuthLoginRequest =
  | ConsumerLoginRequest
  | AdminLoginRequest
  | AgentLoginRequest;

export interface AuthSuccessData {
  user_id: string;
  name?: string;
  username?: string;
  mobile_number?: string;
  role: UserRole;
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AuthSuccessResponse {
  success: true;
  message: string;
  statusCode: 200;
  data: AuthSuccessData;
  errors: null;
}

export interface AuthErrorResponse {
  success: false;
  message: string;
  statusCode: 400 | 401 | 403 | 500;
  data: null;
  errors: {
    error_code: string;
  };
}

export type AuthLoginResponse = AuthSuccessResponse | AuthErrorResponse;

// Scheduler Section 3.2
export type ScheduleStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AdminScheduleItem {
  id: string;
  area_code: string;
  scheduled_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  assigned_agent_id: string;
  status: ScheduleStatus;
}

export interface AdminSchedulesResponse {
  content: AdminScheduleItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

export interface AgentScheduleItem {
  id: string;
  area_code: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
}

export interface AgentSchedulesResponse {
  content: AgentScheduleItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

export interface ConsumerScheduleItem {
  id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
}

export interface ConsumerSchedulesResponse {
  content: ConsumerScheduleItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

// Push & Notifications Section 3.3
export interface DeviceTokenRequest {
  device_id: string;
  token: string;
  platform: 'ANDROID';
}

export interface DeviceTokenResponse {
  message: string;
  updated_at: string;
}

export type NotificationTargetType = 'PINCODE' | 'STREET_NAME' | 'DISTRICT' | 'ROLE' | 'ALL';

export interface AdminNotificationSendRequest {
  title: string;
  body: string;
  target_type: NotificationTargetType;
  target_value: string;
}

export interface AdminNotificationSendResponse {
  dispatch_id: string;
  status: 'QUEUED';
  target_type: NotificationTargetType;
  target_value: string;
  timestamp: string;
}

export interface AgentNotificationSendRequest {
  title: string;
  body: string;
  target_user_id: string;
}

export interface AgentNotificationSendResponse {
  dispatch_id: string;
  status: 'QUEUED';
  target_user_id: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  status: 'UNREAD' | 'READ';
  created_at: string;
}

export interface NotificationsInboxResponse {
  content: NotificationItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

export interface NotificationMarkReadResponse {
  id: string;
  status: 'READ';
  updated_at: string;
}


// =========================================================================
// SECTION 4: PROPOSED BACKEND GAP-FILLER CONTRACTS (TODO_BACKEND_SATHEESH)
// =========================================================================

// 1. Consumer Registration & QR // TODO_BACKEND_SATHEESH
export interface ConsumerRegisterRequest {
  name: string;
  mobile_number: string;
  email: string;
  address: string;
  area_code: string;
  password: string;
}

export interface ConsumerRegisterResponse {
  user_id: string;
  qr_code_payload: string;
  area_code: string;
}

// 2. Consumer Dashboard & Profile // TODO_BACKEND_SATHEESH
export interface ConsumerPickupHistoryItem {
  id: string;
  date: string;
  status: string;
  agent_name?: string;
  waste_weight_kg?: number;
}

export interface ConsumerDashboardResponse {
  pending_amount: number;
  due_date: string;
  next_schedule?: ConsumerScheduleItem | null;
  qr_payload: string;
  recent_pickups: ConsumerPickupHistoryItem[];
}

export interface ConsumerProfileResponse {
  user_id: string;
  name: string;
  mobile_number: string;
  email: string;
  address: string;
  area_code: string;
  qr_payload: string;
}

// 3. Scheduler Write Operations // TODO_BACKEND_SATHEESH
export interface ScheduleCreateRequest {
  area_code: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  assigned_agent_id: string;
}

export interface ScheduleUpdateRequest extends Partial<ScheduleCreateRequest> {
  status?: ScheduleStatus;
}

// 4. Agent QR Scan Verification // TODO_BACKEND_SATHEESH
export interface AgentScanQRRequest {
  qr_payload: string;
  consumer_id?: string;
  waste_weight_kg: number;
  notes?: string;
}

export interface AgentScanQRResponse {
  collection_id: string;
  status: 'COLLECTED';
  timestamp: string;
}

// 5. Payments & Razorpay Verify // TODO_BACKEND_SATHEESH
export interface CreatePaymentOrderRequest {
  amount: number;
}

export interface CreatePaymentOrderResponse {
  order_id: string;
  amount: number;
  currency: 'INR';
  key_id: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  invoice_id: string;
  status: 'PAID';
  paid_at: string;
}

// 6. Fee Collection History // TODO_BACKEND_SATHEESH
export interface PaymentHistoryItem {
  id: string;
  invoice_id: string;
  consumer_id: string;
  consumer_name: string;
  amount: number;
  status: 'PAID' | 'UNPAID' | 'FAILED';
  paid_at?: string;
  due_date?: string;
  area_code: string;
  payment_method?: string;
}

export interface PaymentHistoryResponse {
  content: PaymentHistoryItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

// 7. Manual Pickup Requests // TODO_BACKEND_SATHEESH
export type PickupRequestStatus = 'PENDING' | 'CLAIMED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';

export interface CreatePickupRequestPayload {
  waste_type: 'BULK' | 'ELECTRONIC' | 'HAZARDOUS' | 'RECYCLABLE' | 'GENERAL';
  preferred_date: string;
  address: string;
  notes?: string;
}

export interface ManualPickupRequestItem {
  id: string;
  consumer_id: string;
  consumer_name: string;
  consumer_mobile: string;
  area_code: string;
  waste_type: string;
  preferred_date: string;
  address: string;
  notes?: string;
  status: PickupRequestStatus;
  claimed_by_agent_id?: string;
  claimed_by_agent_name?: string;
  created_at: string;
}

export interface ManualPickupRequestsResponse {
  content: ManualPickupRequestItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

// 8. Help & Support Tickets // TODO_BACKEND_SATHEESH
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface CreateSupportTicketRequest {
  subject: string;
  category: string;
  description: string;
}

export interface SupportTicketItem {
  ticket_id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  subject: string;
  category: string;
  description: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketsResponse {
  content: SupportTicketItem[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
}

// 9. Admin Dashboard & Master CRUD // TODO_BACKEND_SATHEESH
export interface AdminDashboardKPIs {
  total_collected: number;
  pending_fees: number;
  covered_areas: number;
  pending_houses: number;
}

export interface CustomerRecord {
  id: string;
  name: string;
  mobile_number: string;
  email: string;
  address: string;
  area_code: string;
  is_active: boolean;
  qr_payload: string;
  created_at: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  mobile_number: string;
  vehicle_id: string;
  assigned_area_codes: string[];
  is_active: boolean;
  created_at: string;
}

export interface BankingSettings {
  account_holder_name: string;
  bank_name: string;
  account_number_masked: string;
  ifsc_code: string;
  upi_id: string;
  merchant_id: string;
}
