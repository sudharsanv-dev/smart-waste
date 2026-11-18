// tests/flows/consumerFlows.test.ts
// Phase 2 Consumer Module Flow & Exit Gate Test Suite
// Covers Registration, Area-filtered Schedule, Idempotent Payment Exit Gate, Requests & Support Tickets

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetDemoData,
  getStoreState,
  registerDemoSession,
} from '../../src/api/mockStore';
import { setApiBearerToken } from '../../src/api/axiosClient';
import { consumerService } from '../../src/api/consumerService';
import { backendGapService } from '../../src/api/backendGapService';
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
