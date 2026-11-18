// tests/flows/consumerFlows.test.ts
// Phase 2 Consumer Module Flow & Exit Gate Test Suite
// Covers Registration, Area-filtered Schedule, Idempotent Payment Exit Gate, Requests & Support Tickets

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetDemoData,
  getStoreState,
  setStoreState,
  registerDemoSession,
  getDemoSession,
  registerPaymentOrder,
} from '../../src/api/mockStore';
import { setApiBearerToken } from '../../src/api/axiosClient';
import { consumerService } from '../../src/api/consumerService';
import { backendGapService } from '../../src/api/backendGapService';
import { ConsumerScheduleItem } from '../../src/types/contracts';
import '../../src/api/mockAdapter'; // Ensure mock adapter is registered

describe('Phase 2 Consumer Module & Payment Exit Gate', () => {
  beforeEach(() => {
    resetDemoData();
    setApiBearerToken(null);
  });

  // 1. Consumer Registration & Account Isolation
  describe('Consumer Registration & Data Isolation', () => {
    it('registers a new household resident and generates an opaque QR fixture token', async () => {
      const regPayload = {
        name: 'Meera Patel',
        mobile_number: '9876543299',
        email: 'meera.patel@example.com',
        address: '77 Marina Promenade, North Ward',
        area_code: '600001',
        password: 'Consumer@123',
      };

      const res = await consumerService.register(regPayload);

      expect(res.user_id).toBeDefined();
      expect(res.area_code).toBe('600001');
      expect(res.qr_code_payload).toMatch(/^GPC-QR-CONS-[A-F0-9]+$/);
      // Ensure token is opaque and does NOT encode raw mobile number or password
      expect(res.qr_code_payload).not.toContain('9876543299');
      expect(res.qr_code_payload).not.toContain('Consumer@123');

      // Verify in store
      const state = getStoreState();
      const account = state.accounts.find((a) => a.mobile_number === '9876543299');
      expect(account).toBeDefined();
      expect(account?.name).toBe('Meera Patel');
      expect(account?.role).toBe('CONSUMER');
      expect(account?.area_code).toBe('600001');

      // Verify household record
      const household = state.households.find((h) => h.mobile_number === '9876543299');
      expect(household).toBeDefined();
      expect(household?.address).toBe('77 Marina Promenade, North Ward');
    });

    it('keeps newly registered consumer data strictly separate from seeded household (John Doe)', async () => {
      // Seeded John Doe
      const stateBefore = getStoreState();
      const johnAccount = stateBefore.accounts.find((a) => a.user_id === 'c1d2e3f4-a5b6-7890-1234-56789abcdef0')!;
      expect(johnAccount.mobile_number).toBe('9876543210');
      const johnPayments = stateBefore.payments.filter((p) => p.consumer_id === johnAccount.user_id);
      expect(johnPayments.some((p) => p.status === 'UNPAID')).toBe(true);

      // Register new consumer
      const res = await consumerService.register({
        name: 'Kavitha S',
        mobile_number: '9876543298',
        email: 'kavitha@example.com',
        address: '102 Lakeview, South Ward',
        area_code: '600096',
        password: 'Consumer@123',
      });

      // Register session for new user and verify dashboard
      const token = 'test-token-kavitha-' + Date.now();
      registerDemoSession({
        user_id: res.user_id,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      const dashboard = await consumerService.getDashboard();
      // Newly registered consumer has NO outstanding dues (separate from John Doe's ₹150)
      expect(dashboard.pending_amount).toBe(0);
      expect(dashboard.qr_payload).toBe(res.qr_code_payload);
      expect(dashboard.qr_payload).not.toBe(johnAccount.qr_payload);
    });

    it('rejects duplicate mobile registration with 400 error', async () => {
      // John Doe already has mobile 9876543210
      await expect(
        consumerService.register({
          name: 'Imposter',
          mobile_number: '9876543210',
          email: 'imposter@example.com',
          address: 'Duplicate Ave',
          area_code: '600001',
          password: 'Pass@123',
        })
      ).rejects.toThrow();
    });

    it('persists newly registered household in another ward after login and reload, verifying QR and ward isolation', async () => {
      // Register household in Ward 600099
      const reg = await consumerService.register({
        name: 'Deepa Krishnan',
        mobile_number: '9876543288',
        email: 'deepa@example.com',
        address: '54 Hill Road, Ward 600099',
        area_code: '600099',
        password: 'Consumer@123',
      });

      const token = 'token-deepa-' + Date.now();
      registerDemoSession({
        user_id: reg.user_id,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      // Verify dashboard uses its own QR token and not fallback
      const dashboard = await consumerService.getDashboard();
      expect(dashboard.qr_payload).toBe(reg.qr_code_payload);
      expect(dashboard.qr_payload).not.toBe('GPC-QR-CONS-C1D2E3F4A5B67890');

      // Simulate reload: session restored from registry + store
      const sessionRecord = getDemoSession(token);
      expect(sessionRecord).toBeDefined();
      expect(sessionRecord?.user_id).toBe(reg.user_id);

      const state = getStoreState();
      const account = state.accounts.find((a) => a.user_id === reg.user_id);
      expect(account?.area_code).toBe('600099');
      expect(account?.qr_payload).toBe(reg.qr_code_payload);
    });

    it('handles unavailable QR code and unassigned ward states gracefully', async () => {
      // Register an account with empty ward and no QR payload
      const unassignedUserId = 'user-unassigned-' + Date.now();
      const unassignedToken = 'token-unassigned-' + Date.now();

      setStoreState((prev) => ({
        ...prev,
        accounts: [
          ...prev.accounts,
          {
            user_id: unassignedUserId,
            mobile_number: '9876543200',
            name: 'Unassigned User',
            role: 'CONSUMER',
            area_code: '',
            qr_payload: '',
            password: 'Consumer@123',
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
          },
        ],
      }));

      registerDemoSession({
        user_id: unassignedUserId,
        role: 'CONSUMER',
        token: unassignedToken,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(unassignedToken, 3600);

      const dashboard = await consumerService.getDashboard();
      expect(dashboard.qr_payload).toBe('');

      // Attempting to get schedules without area_code returns empty schedules
      const emptyRes = await consumerService.getSchedules('');
      expect(emptyRes.content).toEqual([]);
      expect(emptyRes.total_elements).toBe(0);
    });
  });

  // 2. Area-Filtered Neighborhood Timetable
  describe('Area-Filtered Schedule Timetable (C-03)', () => {
    it('returns schedules filtered strictly to consumer permitted area code', async () => {
      // Authenticate as John Doe (Ward 600001)
      const johnToken = 'token-john-sched-' + Date.now();
      registerDemoSession({
        user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        role: 'CONSUMER',
        token: johnToken,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(johnToken, 3600);

      // Permitted area 600001 -> returns schedules
      const res600001 = await consumerService.getSchedules('600001');
      expect(res600001.content.length).toBeGreaterThan(0);
      expect(res600001.content[0].id).toBe('f5e4d3c2-b1a0-9876-5432-109876abcdef');

      // Unpermitted area 600040 -> returns empty list
      const resUnpermitted = await consumerService.getSchedules('600040');
      expect(resUnpermitted.content).toEqual([]);
      expect(resUnpermitted.total_elements).toBe(0);

      // Now register and authenticate a consumer in Ward 600040
      const reg40 = await consumerService.register({
        name: 'Anna Nagar Resident',
        mobile_number: '9876543240',
        email: 'annanagar@example.com',
        address: '2nd Ave, Anna Nagar',
        area_code: '600040',
        password: 'Consumer@123',
      });
      const token40 = 'token-user40-' + Date.now();
      registerDemoSession({
        user_id: reg40.user_id,
        role: 'CONSUMER',
        token: token40,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token40, 3600);

      // Permitted area 600040 -> returns Anna Nagar schedule
      const res600040 = await consumerService.getSchedules('600040');
      expect(res600040.content.length).toBeGreaterThan(0);
      expect(res600040.content[0].id).toBe('f5e4d3c2-b1a0-9876-5432-109876abcde2');

      // Unpermitted area 600001 -> returns empty list
      const resUnpermitted2 = await consumerService.getSchedules('600001');
      expect(resUnpermitted2.content).toEqual([]);
    });

    it('supports schedule pagination beyond the first page and respects date filtering', async () => {
      const johnToken = 'token-john-sched-pages-' + Date.now();
      registerDemoSession({
        user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        role: 'CONSUMER',
        token: johnToken,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(johnToken, 3600);

      // Add extra schedules to Ward 600001 so total >= 4
      const extraSchedules = [
        {
          id: 'sched-page-001',
          area_code: '600001',
          assigned_agent_id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
          scheduled_date: '2026-11-20',
          start_time: '07:00:00',
          end_time: '09:00:00',
          status: 'ASSIGNED' as const,
        },
        {
          id: 'sched-page-002',
          area_code: '600001',
          assigned_agent_id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
          scheduled_date: '2026-11-22',
          start_time: '07:00:00',
          end_time: '09:00:00',
          status: 'ASSIGNED' as const,
        },
        {
          id: 'sched-page-003',
          area_code: '600001',
          assigned_agent_id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
          scheduled_date: '2026-11-25',
          start_time: '07:00:00',
          end_time: '09:00:00',
          status: 'ASSIGNED' as const,
        },
      ];
      setStoreState((prev) => ({
        ...prev,
        schedules: [...prev.schedules, ...extraSchedules],
      }));

      // Page 0 with page size 2
      const page0 = await consumerService.getSchedules({
        area_code: '600001',
        page: 0,
        size: 2,
      });
      expect(page0.content).toHaveLength(2);
      expect(page0.page_number).toBe(0);
      expect(page0.page_size).toBe(2);
      expect(page0.total_elements).toBeGreaterThanOrEqual(4);
      expect(page0.last).toBe(false);

      // Page 1 with page size 2 (matching beyond first page)
      const page1 = await consumerService.getSchedules({
        area_code: '600001',
        page: 1,
        size: 2,
      });
      expect(page1.content).toHaveLength(2);
      expect(page1.page_number).toBe(1);
      // Items on page 1 must be distinct from items on page 0
      const ids0 = page0.content.map((s) => s.id);
      const ids1 = page1.content.map((s) => s.id);
      expect(ids0.some((id) => ids1.includes(id))).toBe(false);

      // Filter by start_date = 2026-11-21
      const filteredByDate = await consumerService.getSchedules({
        area_code: '600001',
        start_date: '2026-11-21',
        page: 0,
        size: 10,
      });
      expect(filteredByDate.content.every((s) => s.scheduled_date >= '2026-11-21')).toBe(true);
    });

    it('handles consumer account with only past schedules: sets next_schedule to null and derives pickups from stored collections', async () => {
      // In seed data, John Doe in Ward 600001 has only schedule 2026-11-15 (past relative to current IST time in 2026-11-18)
      const johnToken = 'token-john-past-sched-' + Date.now();
      registerDemoSession({
        user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        role: 'CONSUMER',
        token: johnToken,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(johnToken, 3600);

      const dashboard = await consumerService.getDashboard();
      // Since 2026-11-15 is in the past, earliest upcoming eligible schedule must be null
      expect(dashboard.next_schedule).toBeNull();

      // Recent pickups must be derived from stored collection records
      expect(dashboard.recent_pickups).toBeDefined();
      expect(dashboard.recent_pickups.length).toBeGreaterThan(0);
      expect(dashboard.recent_pickups[0].agent_name).toBe('Ramesh Kumar');
      expect(dashboard.recent_pickups[0].waste_weight_kg).toBe(3.2);
    });

    it('filters consumer timetable by status across pages where the only matching pickup starts on page two of raw timetable', async () => {
      const johnToken = 'token-john-page2-filter-' + Date.now();
      registerDemoSession({
        user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        role: 'CONSUMER',
        token: johnToken,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(johnToken, 3600);

      // Configure schedules for Ward 600001:
      // Page 0 (size 2): 2 ASSIGNED schedules
      // Page 1 (size 2): 1 COMPLETED schedule (starts on page two of raw query)
      const customSchedules = [
        {
          id: 'sched-raw-p1-01',
          area_code: '600001',
          assigned_agent_id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
          scheduled_date: '2026-11-20',
          start_time: '07:00:00',
          end_time: '09:00:00',
          status: 'ASSIGNED' as const,
        },
        {
          id: 'sched-raw-p1-02',
          area_code: '600001',
          assigned_agent_id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
          scheduled_date: '2026-11-21',
          start_time: '07:00:00',
          end_time: '09:00:00',
          status: 'ASSIGNED' as const,
        },
        {
          id: 'sched-raw-p2-01',
          area_code: '600001',
          assigned_agent_id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
          scheduled_date: '2026-11-22',
          start_time: '07:00:00',
          end_time: '09:00:00',
          status: 'COMPLETED' as const, // Only COMPLETED schedule, starts on page two
        },
      ];

      setStoreState((prev) => ({
        ...prev,
        schedules: customSchedules,
      }));

      // 1. Verify raw API behavior with pageSize=2 keeps locked Section 3 contract
      const rawPage0 = await consumerService.getSchedules({ area_code: '600001', page: 0, size: 2 });
      expect(rawPage0.content).toHaveLength(2);
      expect(rawPage0.content.every((s) => s.status === 'ASSIGNED')).toBe(true);

      const rawPage1 = await consumerService.getSchedules({ area_code: '600001', page: 1, size: 2 });
      expect(rawPage1.content).toHaveLength(1);
      expect(rawPage1.content[0].id).toBe('sched-raw-p2-01');
      expect(rawPage1.content[0].status).toBe('COMPLETED');

      // 2. Fetch all pages through locked contract to simulate consumer timetable status filtering across pages
      let allItems: ConsumerScheduleItem[] = [];
      let curPage = 0;
      let isLast = false;
      while (!isLast && curPage < 10) {
        const res = await consumerService.getSchedules({ area_code: '600001', page: curPage, size: 2 });
        allItems = [...allItems, ...res.content];
        isLast = Boolean(res.last) || curPage + 1 >= res.total_pages;
        curPage++;
      }
      expect(allItems).toHaveLength(3);

      // Filter by COMPLETED:
      const completedFiltered = allItems.filter((s) => s.status === 'COMPLETED');
      expect(completedFiltered).toHaveLength(1);
      expect(completedFiltered[0].id).toBe('sched-raw-p2-01');

      // The count (1), displayed rows (1), total pages (1), and empty state (false) describe the same filtered result
      const pageSize = 2;
      const totalElements = completedFiltered.length;
      const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
      const pageIndex = 0;
      const displayed = completedFiltered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

      expect(displayed).toHaveLength(1);
      expect(displayed[0].status).toBe('COMPLETED');
      expect(totalElements).toBe(1);
      expect(totalPages).toBe(1);
      expect(displayed.length === 0).toBe(false); // empty state is false
    });
  });

  // 3. Payment Exit Gate: Double-Click Idempotency
  describe('Payment Exit Gate & Double-Click Idempotency', () => {
    it('double-clicking Pay for seeded ₹150 due produces exactly one ledger entry and one receipt', async () => {
      const johnUserId = 'c1d2e3f4-a5b6-7890-1234-56789abcdef0';
      const token = 'test-token-john-payment-' + Date.now();
      registerDemoSession({
        user_id: johnUserId,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      // Verify initial state
      const initialHistory = await consumerService.getPaymentHistory();
      const unpaidBefore = initialHistory.filter((p) => p.status === 'UNPAID');
      expect(unpaidBefore).toHaveLength(1);
      expect(unpaidBefore[0].invoice_id).toBe('inv-2026-11-002');
      expect(unpaidBefore[0].amount).toBe(150);

      const stateBefore = getStoreState();
      const totalPaidBefore = stateBefore.payments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);
      expect(totalPaidBefore).toBe(150); // only inv-2026-10-001 was paid

      // Simulate rapid double-click on Pay button: two concurrent createOrder & verify dispatches
      const [order1, order2] = await Promise.all([
        consumerService.createPaymentOrder(150),
        consumerService.createPaymentOrder(150),
      ]);

      const [verifyRes1, verifyRes2] = await Promise.all([
        consumerService.verifyPayment(order1.order_id, 'pay_click_1', 'sig_click_1', 'inv-2026-11-002'),
        consumerService.verifyPayment(order2.order_id, 'pay_click_2', 'sig_click_2', 'inv-2026-11-002'),
      ]);

      // Both calls must resolve safely without error
      expect(verifyRes1.status).toBe('PAID');
      expect(verifyRes2.status).toBe('PAID');
      expect(verifyRes1.invoice_id).toBe('inv-2026-11-002');
      expect(verifyRes2.invoice_id).toBe('inv-2026-11-002');

      // Assert consumer state: unpaid invoices are now 0, dues = ₹0.00
      const updatedHistory = await consumerService.getPaymentHistory();
      const unpaidAfter = updatedHistory.filter((p) => p.status === 'UNPAID');
      expect(unpaidAfter).toHaveLength(0);

      const dashboard = await consumerService.getDashboard();
      expect(dashboard.pending_amount).toBe(0);

      // Assert single ledger entry: inv-2026-11-002 appears EXACTLY ONCE
      const invRows = updatedHistory.filter((p) => p.invoice_id === 'inv-2026-11-002');
      expect(invRows).toHaveLength(1);
      expect(invRows[0].status).toBe('PAID');
      expect(invRows[0].amount).toBe(150);

      // Assert admin total collected: increases by ₹150 ONCE (from ₹150 to ₹300, NOT ₹450!)
      const stateAfter = getStoreState();
      const totalPaidAfter = stateAfter.payments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);
      expect(totalPaidAfter).toBe(300);

      // Admin dashboard KPI verification
      const adminToken = 'test-token-admin-' + Date.now();
      registerDemoSession({
        user_id: 'd2e3f4a5-b6c7-8901-2345-67890abcdef1',
        role: 'ADMIN',
        token: adminToken,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(adminToken, 3600);

      const adminDashboard = await backendGapService.getAdminDashboardKPIs();
      if (!('unavailable' in adminDashboard)) {
        expect(adminDashboard.total_collected).toBe(300);
        expect(adminDashboard.pending_fees).toBe(0);
      }
    });

    it('manages two unpaid invoices: verifies consumer balance, receipt count, and admin total after each action with mismatched ID rejection and idempotent repetition', async () => {
      const johnUserId = 'c1d2e3f4-a5b6-7890-1234-56789abcdef0';
      const token = 'test-token-john-two-invoices-' + Date.now();
      registerDemoSession({
        user_id: johnUserId,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      // Add a second unpaid invoice to the store for John Doe
      const secondInvoice = {
        id: 'pay-john-extra-002',
        invoice_id: 'inv-2026-12-003',
        consumer_id: johnUserId,
        consumer_name: 'John Doe',
        area_code: '600001',
        amount: 250,
        due_date: '2026-12-31',
        status: 'UNPAID' as const,
        created_at: '2026-11-18T10:00:00Z',
      };
      setStoreState((prev) => ({
        ...prev,
        payments: [...prev.payments, secondInvoice],
      }));

      // Verify Step 0: Initial State with two unpaid invoices
      const history0 = await consumerService.getPaymentHistory();
      const unpaid0 = history0.filter((p) => p.status === 'UNPAID');
      const paid0 = history0.filter((p) => p.status === 'PAID');
      expect(unpaid0).toHaveLength(2); // inv-2026-11-002 (₹150) and inv-2026-12-003 (₹250)
      expect(paid0).toHaveLength(1);   // inv-2026-10-001 (₹150)
      const balance0 = unpaid0.reduce((sum, p) => sum + p.amount, 0);
      expect(balance0).toBe(400);

      const state0 = getStoreState();
      const adminTotal0 = state0.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
      expect(adminTotal0).toBe(150);

      // Step 1: Attempt to create an order without specifying invoice_id when multiple unpaid exist -> rejected
      await expect(consumerService.createPaymentOrder({})).rejects.toThrow();

      // Step 2: Create order bound to invoice 1 (inv-2026-11-002, amount 150)
      const order1 = await consumerService.createPaymentOrder({
        invoice_id: 'inv-2026-11-002',
        amount: 150,
      });
      expect(order1.order_id).toBeDefined();
      expect(order1.amount).toBe(150);
      expect(order1.invoice_id).toBe('inv-2026-11-002');

      // Step 3: Attempt verification with MISMATCHED invoice ID (inv-2026-12-003) -> must fail, leave balances unchanged
      await expect(
        consumerService.verifyPayment(order1.order_id, 'pay_mismatch', 'sig_mismatch', 'inv-2026-12-003')
      ).rejects.toThrow();

      // Balances must be byte-for-byte unchanged
      const historyAfterMismatch = await consumerService.getPaymentHistory();
      expect(historyAfterMismatch.filter((p) => p.status === 'UNPAID')).toHaveLength(2);
      expect(historyAfterMismatch.filter((p) => p.status === 'PAID')).toHaveLength(1);
      const stateAfterMismatch = getStoreState();
      expect(stateAfterMismatch.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0)).toBe(150);

      // Step 4: Attempt verification with NON-EXISTENT order ID -> must fail, leave balances unchanged
      await expect(
        consumerService.verifyPayment('order_nonexistent_999', 'pay_fake', 'sig_fake', 'inv-2026-11-002')
      ).rejects.toThrow();

      // Step 5: Verify order 1 with exact invoice match -> SUCCESS
      const verifyRes1 = await consumerService.verifyPayment(
        order1.order_id,
        'pay_valid_1',
        'sig_valid_1',
        'inv-2026-11-002'
      );
      expect(verifyRes1.status).toBe('PAID');
      expect(verifyRes1.invoice_id).toBe('inv-2026-11-002');

      // Check balances after settling invoice 1:
      // Consumer pending dues drops to ₹250, paid receipts count = 2
      const history1 = await consumerService.getPaymentHistory();
      const unpaid1 = history1.filter((p) => p.status === 'UNPAID');
      const paid1 = history1.filter((p) => p.status === 'PAID');
      expect(unpaid1).toHaveLength(1);
      expect(unpaid1[0].invoice_id).toBe('inv-2026-12-003');
      expect(unpaid1[0].amount).toBe(250);
      expect(paid1).toHaveLength(2);
      const state1 = getStoreState();
      const adminTotal1 = state1.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
      expect(adminTotal1).toBe(300); // Increased from 150 to 300

      // Step 6: Repeat verification of order 1 -> MUST return the same receipt without mutating ledger
      const repeatRes1 = await consumerService.verifyPayment(
        order1.order_id,
        'pay_repeat_1',
        'sig_repeat_1',
        'inv-2026-11-002'
      );
      expect(repeatRes1.status).toBe('PAID');
      expect(repeatRes1.invoice_id).toBe('inv-2026-11-002');

      const historyAfterRepeat = await consumerService.getPaymentHistory();
      expect(historyAfterRepeat.filter((p) => p.status === 'UNPAID')).toHaveLength(1);
      expect(historyAfterRepeat.filter((p) => p.status === 'PAID')).toHaveLength(2);
      const stateAfterRepeat = getStoreState();
      expect(stateAfterRepeat.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0)).toBe(300);

      // Step 7: Create and verify order for second invoice (inv-2026-12-003, amount 250)
      const order2 = await consumerService.createPaymentOrder({
        invoice_id: 'inv-2026-12-003',
        amount: 250,
      });
      const verifyRes2 = await consumerService.verifyPayment(
        order2.order_id,
        'pay_valid_2',
        'sig_valid_2',
        'inv-2026-12-003'
      );
      expect(verifyRes2.status).toBe('PAID');
      expect(verifyRes2.invoice_id).toBe('inv-2026-12-003');

      // Check final balances:
      // All unpaid invoices cleared (0), paid receipts count = 3, admin total collected = ₹550
      const historyFinal = await consumerService.getPaymentHistory();
      expect(historyFinal.filter((p) => p.status === 'UNPAID')).toHaveLength(0);
      expect(historyFinal.filter((p) => p.status === 'PAID')).toHaveLength(3);
      const stateFinal = getStoreState();
      const adminTotalFinal = stateFinal.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
      expect(adminTotalFinal).toBe(550);
    });

    it('authoritative ledger: starts with paid order and unpaid invoice, retries confirmation, and ensures receipt, balance, and admin total agree exactly once', async () => {
      const johnUserId = 'c1d2e3f4-a5b6-7890-1234-56789abcdef0';
      const token = 'test-token-john-ledger-auth-' + Date.now();
      registerDemoSession({
        user_id: johnUserId,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      // Verify initial state: invoice inv-2026-11-002 is UNPAID (amount 150)
      const initialHistory = await consumerService.getPaymentHistory();
      const unpaidInvoice = initialHistory.find((p) => p.invoice_id === 'inv-2026-11-002');
      expect(unpaidInvoice?.status).toBe('UNPAID');

      const initialDashboard = await consumerService.getDashboard();
      expect(initialDashboard.pending_amount).toBe(150);

      const state0 = getStoreState();
      const initialAdminTotal = state0.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
      expect(initialAdminTotal).toBe(150); // only inv-2026-10-001 was paid

      // Simulate desync / interrupted write: An active payment order exists and was set to 'PAID' in registry,
      // but the invoice in the ledger was NOT yet updated to PAID (still UNPAID)
      const desyncedOrderId = 'order_desync_' + Date.now();
      registerPaymentOrder({
        order_id: desyncedOrderId,
        invoice_id: 'inv-2026-11-002',
        consumer_id: johnUserId,
        amount: 150,
        currency: 'INR',
        key_id: 'rzp_test_greenpulse_demo',
        status: 'PAID', // order marked paid
        receipt_id: 'rcpt_inv-2026-11-002',
        created_at: new Date().toISOString(),
      });

      // Confirmation is retried
      const verifyRes = await consumerService.verifyPayment(
        desyncedOrderId,
        'pay_retry_reconcile',
        'sig_retry_reconcile',
        'inv-2026-11-002'
      );

      // Verify that confirmation performs authoritative settlement on the invoice ledger
      expect(verifyRes.status).toBe('PAID');
      expect(verifyRes.invoice_id).toBe('inv-2026-11-002');

      // 1. Consumer balance must reflect settled payment
      const updatedHistory = await consumerService.getPaymentHistory();
      const reconciledInvoice = updatedHistory.find((p) => p.invoice_id === 'inv-2026-11-002');
      expect(reconciledInvoice?.status).toBe('PAID');
      const updatedDashboard = await consumerService.getDashboard();
      expect(updatedDashboard.pending_amount).toBe(0);

      // 2. Receipt count must increase by exactly 1
      const paidReceipts = updatedHistory.filter((p) => p.status === 'PAID');
      expect(paidReceipts).toHaveLength(2); // inv-2026-10-001 and inv-2026-11-002

      // 3. Admin total must increase by exactly ₹150 (from 150 to 300)
      const state1 = getStoreState();
      const reconciledAdminTotal = state1.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
      expect(reconciledAdminTotal).toBe(300);

      // 4. A subsequent retry confirmation must return the same receipt without double-crediting
      const retryRes = await consumerService.verifyPayment(
        desyncedOrderId,
        'pay_second_retry',
        'sig_second_retry',
        'inv-2026-11-002'
      );
      expect(retryRes.status).toBe('PAID');
      const state2 = getStoreState();
      const finalAdminTotal = state2.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
      expect(finalAdminTotal).toBe(300); // Still 300, unchanged!
    });
  });

  // 4. Manual Pickup Requests & Support Tickets
  describe('Manual Pickup Requests & Support Tickets', () => {
    it('allows consumer to submit on-demand pickup requests and list them', async () => {
      const johnUserId = 'c1d2e3f4-a5b6-7890-1234-56789abcdef0';
      const token = 'test-token-john-requests-' + Date.now();
      registerDemoSession({
        user_id: johnUserId,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      const newReq = await consumerService.createPickupRequest({
        waste_type: 'ELECTRONIC',
        preferred_date: '2026-11-25',
        address: '14/B Sunrise Ave, Gate 2',
        notes: 'Old CRT monitor and wiring',
      });

      expect(newReq.id).toMatch(/^req-/);
      expect(newReq.status).toBe('PENDING');
      expect(newReq.waste_type).toBe('ELECTRONIC');
      expect(newReq.consumer_id).toBe(johnUserId);

      const list = await consumerService.getPickupRequests();
      expect(list.some((r) => r.id === newReq.id)).toBe(true);
    });

    it('allows consumer to open support grievances and list them', async () => {
      const johnUserId = 'c1d2e3f4-a5b6-7890-1234-56789abcdef0';
      const token = 'test-token-john-tickets-' + Date.now();
      registerDemoSession({
        user_id: johnUserId,
        role: 'CONSUMER',
        token,
        expires_at: Date.now() + 3600000,
      });
      setApiBearerToken(token, 3600);

      const newTkt = await consumerService.createSupportTicket({
        category: 'Bin Replacement / Damage',
        subject: 'Cracked green wet-waste bin lid',
        description: 'The lid hinges broke during Monday morning collection. Requesting replacement.',
      });

      expect(newTkt.ticket_id).toMatch(/^tkt-/);
      expect(newTkt.status).toBe('OPEN');
      expect(newTkt.category).toBe('Bin Replacement / Damage');
      expect(newTkt.user_id).toBe(johnUserId);

      const list = await consumerService.getSupportTickets();
      expect(list.some((t) => t.ticket_id === newTkt.ticket_id)).toBe(true);
    });
  });
});
