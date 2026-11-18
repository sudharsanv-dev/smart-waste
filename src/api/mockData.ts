// src/api/mockData.ts
// Deterministic seed fixtures for GreenPulse City matching DEMO_SPEC.md exactly
// Schema Version: 1.0.0

import {
  AdminScheduleItem,
  CustomerRecord,
  AgentRecord,
  PaymentHistoryItem,
  NotificationItem,
  SupportTicketItem,
  ManualPickupRequestItem,
  BankingSettings,
} from '../types/contracts';

export const SCHEMA_VERSION = '1.0.0';
export const OPERATIONAL_TIMEZONE = 'Asia/Kolkata';

export interface DemoUserAccount {
  user_id: string;
  name: string;
  username?: string;
  mobile_number?: string;
  password: string;
  role: 'CONSUMER' | 'ADMIN' | 'AGENT';
  area_code?: string;
  assigned_area_codes?: string[];
  vehicle_id?: string;
  qr_payload?: string;
}

export interface StoredCollectionRecord {
  id: string;
  consumer_id: string;
  household_id?: string;
  qr_payload?: string;
  date: string;
  timestamp: string;
  status: 'COLLECTED';
  agent_id?: string;
  agent_name?: string;
  waste_weight_kg?: number;
  notes?: string;
}

export interface DemoStoreState {
  version: string;
  accounts: DemoUserAccount[];
  households: CustomerRecord[];
  agents: AgentRecord[];
  schedules: AdminScheduleItem[];
  payments: PaymentHistoryItem[];
  notifications: NotificationItem[];
  tickets: SupportTicketItem[];
  pickupRequests: ManualPickupRequestItem[];
  banking: BankingSettings;
  collections?: StoredCollectionRecord[];
}

export function getInitialSeedState(): DemoStoreState {
  return {
    version: SCHEMA_VERSION,
    accounts: [
      {
        user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        name: 'John Doe',
        mobile_number: '9876543210',
        password: 'Consumer@123',
        role: 'CONSUMER',
        area_code: '600001',
        qr_payload: 'GPC-QR-CONS-C1D2E3F4A5B67890',
      },
      {
        user_id: 'd2e3f4a5-b6c7-8901-2345-67890abcdef1',
        name: 'Satish Nair',
        username: 'admin',
        password: 'Admin@123',
        role: 'ADMIN',
      },
      {
        user_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        name: 'Ramesh Kumar',
        mobile_number: '9876543210',
        password: 'Agent@123',
        role: 'AGENT',
        assigned_area_codes: ['600001', '600040'],
        vehicle_id: 'TN-01-WM-4042',
      },
      {
        user_id: 'a2b3c4d5-e6f7-8901-2345-67890abcdef2',
        name: 'Suresh Babu',
        mobile_number: '9876543211',
        password: 'Agent@123',
        role: 'AGENT',
        assigned_area_codes: ['600002', '600096'],
        vehicle_id: 'TN-01-WM-5120',
      },
    ],
    households: [
      {
        id: 'hh-001',
        name: 'John Doe',
        mobile_number: '9876543210',
        email: 'john.doe@example.com',
        address: '14/B Sunrise Ave',
        area_code: '600001',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-C1D2E3F4A5B67890',
        created_at: '2026-01-10T09:00:00Z',
      },
      {
        id: 'hh-002',
        name: 'Priya Raman',
        mobile_number: '9876543202',
        email: 'priya.raman@example.com',
        address: '16/A Sunrise Ave',
        area_code: '600001',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-88A190BC33D14120',
        created_at: '2026-01-12T10:00:00Z',
      },
      {
        id: 'hh-003',
        name: 'Karthik Sundaram',
        mobile_number: '9876543203',
        email: 'karthik.s@example.com',
        address: '22 Palm Grove St',
        area_code: '600001',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-77B289CD44E25231',
        created_at: '2026-01-15T11:00:00Z',
      },
      {
        id: 'hh-004',
        name: 'Ananya Krishnan',
        mobile_number: '9876543204',
        email: 'ananya.k@example.com',
        address: '5 Harbour View Road',
        area_code: '600001',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-66C378DE55F36342',
        created_at: '2026-02-01T08:30:00Z',
      },
      {
        id: 'hh-005',
        name: 'Vignesh Iyer',
        mobile_number: '9876543205',
        email: 'vignesh.i@example.com',
        address: '102 Market St',
        area_code: '600002',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-55D467EF66A47453',
        created_at: '2026-02-05T09:15:00Z',
      },
      {
        id: 'hh-006',
        name: 'Deepa Menon',
        mobile_number: '9876543206',
        email: 'deepa.m@example.com',
        address: '88 Grand Mall Bypass',
        area_code: '600002',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-44E556FA77B58564',
        created_at: '2026-02-10T14:00:00Z',
      },
      {
        id: 'hh-007',
        name: 'Rajesh Verma',
        mobile_number: '9876543207',
        email: 'rajesh.v@example.com',
        address: '12 2nd Avenue, Anna Nagar',
        area_code: '600040',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-33F645AB88C69675',
        created_at: '2026-02-12T10:00:00Z',
      },
      {
        id: 'hh-008',
        name: 'Meenakshi Natarajan',
        mobile_number: '9876543208',
        email: 'meenakshi.n@example.com',
        address: '45 4th Main Road, Anna Nagar',
        area_code: '600040',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-22A734BC99D70786',
        created_at: '2026-02-18T11:30:00Z',
      },
      {
        id: 'hh-009',
        name: 'Balaji Govind',
        mobile_number: '9876543209',
        email: 'balaji.g@example.com',
        address: '7 Eco Garden Way',
        area_code: '600096',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-11B823CD00E81897',
        created_at: '2026-03-01T10:00:00Z',
      },
      {
        id: 'hh-010',
        name: 'Shweta Rao',
        mobile_number: '9876543212',
        email: 'shweta.r@example.com',
        address: '19 Lakeview Crescent',
        area_code: '600096',
        is_active: true,
        qr_payload: 'GPC-QR-CONS-00C912DE11F92908',
        created_at: '2026-03-05T12:00:00Z',
      },
    ],
    agents: [
      {
        id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        name: 'Ramesh Kumar',
        mobile_number: '9876543210',
        vehicle_id: 'TN-01-WM-4042',
        assigned_area_codes: ['600001', '600040'],
        is_active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'a2b3c4d5-e6f7-8901-2345-67890abcdef2',
        name: 'Suresh Babu',
        mobile_number: '9876543211',
        vehicle_id: 'TN-01-WM-5120',
        assigned_area_codes: ['600002', '600096'],
        is_active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
    ],
    schedules: [
      {
        id: 'f5e4d3c2-b1a0-9876-5432-109876abcdef',
        area_code: '600001',
        scheduled_date: '2026-11-15',
        start_time: '07:00:00',
        end_time: '11:00:00',
        assigned_agent_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        status: 'ASSIGNED',
      },
      {
        id: 'f5e4d3c2-b1a0-9876-5432-109876abcde2',
        area_code: '600040',
        scheduled_date: '2026-11-18',
        start_time: '08:00:00',
        end_time: '12:00:00',
        assigned_agent_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        status: 'ASSIGNED',
      },
      {
        id: 'f5e4d3c2-b1a0-9876-5432-109876abcde3',
        area_code: '600002',
        scheduled_date: '2026-11-18',
        start_time: '06:30:00',
        end_time: '10:30:00',
        assigned_agent_id: 'a2b3c4d5-e6f7-8901-2345-67890abcdef2',
        status: 'ASSIGNED',
      },
    ],
    payments: [
      {
        id: 'pay-001',
        invoice_id: 'inv-2026-10-001',
        consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        consumer_name: 'John Doe',
        amount: 150,
        status: 'PAID',
        paid_at: '2026-10-05T10:30:00Z',
        area_code: '600001',
        payment_method: 'UPI',
      },
      {
        id: 'pay-002',
        invoice_id: 'inv-2026-11-002',
        consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        consumer_name: 'John Doe',
        amount: 150,
        status: 'UNPAID',
        due_date: '2026-11-30',
        area_code: '600001',
      },
      {
        id: 'pay-003',
        invoice_id: 'inv-2026-11-fail-001',
        consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        consumer_name: 'John Doe',
        amount: 150,
        status: 'FAILED',
        area_code: '600001',
        payment_method: 'CARD',
      },
    ],
    notifications: [
      {
        id: 'c3d4e5f6-1234-5678-90ab-cdef12345678',
        target_user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        title: 'Agent Arriving Soon',
        body: 'Your waste collection agent is 5 minutes away.',
        status: 'UNREAD',
        created_at: '2026-11-14T18:40:00Z',
        read_by: [],
      },
      {
        id: 'd4e5f6a7-2345-6789-01bc-def234567890',
        target_user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        title: 'Monthly Billing Generated',
        body: 'Your waste fee of ₹150 for November 2026 is ready for payment.',
        status: 'READ',
        created_at: '2026-11-01T09:00:00Z',
        read_by: ['c1d2e3f4-a5b6-7890-1234-56789abcdef0'],
      },
    ],
    tickets: [
      {
        ticket_id: 'tkt-001',
        user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        user_name: 'John Doe',
        user_role: 'CONSUMER',
        subject: 'Delay in Thursday morning pickup',
        category: 'Missed Pickup',
        description: 'Pickup truck did not arrive during the scheduled 07:00-11:00 window.',
        status: 'IN_PROGRESS',
        created_at: '2026-11-16T12:00:00Z',
        updated_at: '2026-11-16T14:30:00Z',
      },
      {
        ticket_id: 'tkt-002',
        user_id: 'hh-002',
        user_name: 'Priya Raman',
        user_role: 'CONSUMER',
        subject: 'Double charge inquiry',
        category: 'Billing',
        description: 'Card was deducted twice on Oct 5; please reconcile.',
        status: 'RESOLVED',
        created_at: '2026-10-06T09:00:00Z',
        updated_at: '2026-10-07T16:00:00Z',
      },
    ],
    pickupRequests: [
      {
        id: 'req-001',
        consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        consumer_name: 'John Doe',
        consumer_mobile: '9876543210',
        area_code: '600001',
        waste_type: 'BULK',
        preferred_date: '2026-11-20',
        address: '14/B Sunrise Ave, Harbour Zone',
        notes: 'Old furniture and wooden packaging crates',
        status: 'PENDING',
        created_at: '2026-11-17T11:00:00Z',
      },
    ],
    banking: {
      account_holder_name: 'Corporation of GreenPulse - Waste Dept',
      bank_name: 'State Bank of India',
      account_number_masked: '•••• •••• •••• 4092',
      ifsc_code: 'SBIN0001234',
      upi_id: 'greenpulse.waste@sbi',
      merchant_id: 'MID_GP_MUNICIPAL_883',
    },
    collections: [
      {
        id: 'col-001',
        consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        household_id: 'hh-001',
        qr_payload: 'GPC-QR-CONS-C1D2E3F4A5B67890',
        date: '2026-11-14',
        timestamp: '2026-11-14T08:30:00Z',
        status: 'COLLECTED',
        agent_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        agent_name: 'Ramesh Kumar',
        waste_weight_kg: 3.2,
      },
    ],
  };
}
