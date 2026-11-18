// tests/flows/agentFlows.test.ts
// Phase 3 Field Collection Agent Module Flow & Exit Gate Test Suite
// Covers Schedules, Arrival Alerts (QUEUED), QR Scanning & Duplicate Prevention,
// Route Boundaries, F-04 Competing Claims, and Field Support Tickets.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetDemoData,
  getStoreState,
  registerDemoSession,
} from '../../src/api/mockStore';
import { setApiBearerToken } from '../../src/api/axiosClient';
import { agentService } from '../../src/api/agentService';
import { consumerService } from '../../src/api/consumerService';
import { notificationService } from '../../src/api/notificationService';
import '../../src/api/mockAdapter'; // Ensure mock adapter is registered

describe('Phase 3 Field Agent Module & Exit Gate', () => {
  const RAMESH_AGENT = {
    user_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
    name: 'Ramesh Kumar',
    mobile_number: '9876543210',
    password: 'Agent@123',
    role: 'AGENT' as const,
    assigned_area_codes: ['600001', '600040'],
    vehicle_id: 'TN-01-WM-4042',
  };

  const SURESH_AGENT = {
    user_id: 'a2b3c4d5-e6f7-8901-2345-67890abcdef2',
    name: 'Suresh Babu',
    mobile_number: '9876543211',
    password: 'Agent@123',
    role: 'AGENT' as const,
    assigned_area_codes: ['600001', '600002', '600096'],
    vehicle_id: 'TN-01-WM-5120',
  };

  const JOHN_CONSUMER = {
    user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
    name: 'John Doe',
    mobile_number: '9876543210',
    password: 'Consumer@123',
    role: 'CONSUMER' as const,
    area_code: '600001',
    qr_payload: 'GPC-QR-CONS-C1D2E3F4A5B67890',
  };

  function registerSession(
    token: string,
    user: { user_id: string; role: 'CONSUMER' | 'ADMIN' | 'AGENT' },
    ttlMs = 3600000
  ) {
    registerDemoSession({
      token,
      user_id: user.user_id,
      role: user.role,
      expires_at: Date.now() + ttlMs,
    });
  }

  beforeEach(() => {
    resetDemoData();
    setApiBearerToken(null);
  });

  // 1. Agent Schedules & Shift Timetable
  describe('Agent Shift Timetable', () => {
    it('retrieves assigned route schedules filtered to the authenticated agent', async () => {
      const token = 'agt-token-ramesh';
      registerSession(token, RAMESH_AGENT);
      setApiBearerToken(token);

      const res = await agentService.getSchedules();

      expect(res.content).toBeDefined();
      expect(res.content.length).toBeGreaterThan(0);
      const state = getStoreState();
      // All returned schedules must be assigned to Ramesh in store
      res.content.forEach((item) => {
        const stored = state.schedules.find((s) => s.id === item.id);
        expect(stored?.assigned_agent_id).toBe(RAMESH_AGENT.user_id);
      });
    });
  });

  // 2. Arrival Notifications (Honest ETA, HTTP 202 QUEUED)
  describe('Task-based Arrival Notification Dispatch', () => {
    it('dispatches arrival alert with honest manual ETA and returns 202 QUEUED', async () => {
      const token = 'agt-token-ramesh';
      registerSession(token, RAMESH_AGENT);
      setApiBearerToken(token);

      const dispatchRes = await agentService.sendArrivalNotification({
        title: 'Collection Vehicle Approaching',
        body: 'Agent Ramesh Kumar is 10 minutes away. Please keep bins accessible.',
        target_user_id: JOHN_CONSUMER.user_id,
      });

      expect(dispatchRes.status).toBe('QUEUED');
      expect(dispatchRes.dispatch_id).toMatch(/^disp-agt-/);
      expect(dispatchRes.target_user_id).toBe(JOHN_CONSUMER.user_id);

      // Verify that notification appears in the consumer's personal notifications
      const consumerToken = 'cons-token-john';
      registerSession(consumerToken, JOHN_CONSUMER);
      setApiBearerToken(consumerToken);

      const notifs = await notificationService.getNotifications();
      const arrivalNotif = notifs.content.find((n) => n.title === 'Collection Vehicle Approaching');
      expect(arrivalNotif).toBeDefined();
      expect(arrivalNotif?.status).toBe('UNREAD');
    });

    it('rejects arrival notification to a household outside the agent assigned route with 400 OUTSIDE_ASSIGNED_ROUTE', async () => {
      const token = 'agt-token-ramesh';
      // Ramesh is assigned 600001, 600040. He cannot dispatch to Ward 600002.
      registerSession(token, RAMESH_AGENT);
      setApiBearerToken(token);

      // Create an outside-ward consumer in the store
      const state = getStoreState();
      const outsideConsumer = {
        user_id: 'cons-outside-ward',
        name: 'Outside Resident',
        mobile_number: '9998887776',
        password: 'Pass@123',
        role: 'CONSUMER' as const,
        area_code: '600099', // Outside Ward 600001 / 600040
        qr_payload: 'GPC-QR-CONS-OUTSIDE',
      };
      state.accounts.push(outsideConsumer);

      let errorStatus = 0;
      let errorCode = '';
      try {
        await agentService.sendArrivalNotification({
          title: 'Illegal Alert',
          body: 'Approaching outside zone',
          target_user_id: 'cons-outside-ward',
        });
      } catch (err: unknown) {
        const errObj = err as { response?: { status?: number; data?: { errors?: { error_code?: string } } } };
        errorStatus = errObj.response?.status || 0;
        errorCode = errObj.response?.data?.errors?.error_code || '';
      }

      expect(errorStatus).toBe(400);
      expect(errorCode).toBe('OUTSIDE_ASSIGNED_ROUTE');
    });
  });

  // 3. Phase 3 Exit Gate: QR Collection & Duplicate Prevention
  describe('Phase 3 Exit Gate: Household QR Scan & Duplicate Prevention', () => {
    it('valid household scan records collection and immediately updates consumer recent pickups', async () => {
      const agentToken = 'agt-token-ramesh';
      registerSession(agentToken, RAMESH_AGENT);
      setApiBearerToken(agentToken);

      const scanRes = await agentService.scanCollectionQR({
        qr_payload: JOHN_CONSUMER.qr_payload,
        waste_weight_kg: 4.8,
        notes: 'Segregated wet and dry waste verified',
      });

      expect(scanRes.status).toBe('COLLECTED');
      expect(scanRes.collection_id).toBeDefined();

      // Verify stored in collections
      const state = getStoreState();
      const stored = (state.collections || []).find((c) => c.id === scanRes.collection_id);
      expect(stored).toBeDefined();
      expect(stored?.consumer_id).toBe(JOHN_CONSUMER.user_id);
      expect(stored?.waste_weight_kg).toBe(4.8);
      expect(stored?.agent_id).toBe(RAMESH_AGENT.user_id);

      // Verify that consumer dashboard immediately reflects recent pickups
      const consumerToken = 'cons-token-john';
      registerSession(consumerToken, JOHN_CONSUMER);
      setApiBearerToken(consumerToken);

      const dashboard = await consumerService.getDashboard();
      const matchingPickup = dashboard.recent_pickups.find((p) => p.id === scanRes.collection_id);
      expect(matchingPickup).toBeDefined();
      expect(matchingPickup?.status).toBe('COLLECTED');
      expect(matchingPickup?.agent_name).toBe(RAMESH_AGENT.name);
      expect(matchingPickup?.waste_weight_kg).toBe(4.8);
    });

    it('repeat scan on the same day returns ALREADY_COLLECTED and leaves collection count unchanged', async () => {
      const agentToken = 'agt-token-ramesh';
      registerSession(agentToken, RAMESH_AGENT);
      setApiBearerToken(agentToken);

      // Initial scan
      const scan1 = await agentService.scanCollectionQR({
        qr_payload: JOHN_CONSUMER.qr_payload,
        waste_weight_kg: 3.5,
      });
      expect(scan1.status).toBe('COLLECTED');

      const countAfterFirstScan = (getStoreState().collections || []).length;

      // Duplicate scan on same day
      const scan2 = await agentService.scanCollectionQR({
        qr_payload: JOHN_CONSUMER.qr_payload,
        waste_weight_kg: 3.5,
      });

      expect(scan2.status).toBe('ALREADY_COLLECTED');
      expect(scan2.collection_id).toBe(scan1.collection_id);

      // Collection count MUST NOT increase
      const countAfterSecondScan = (getStoreState().collections || []).length;
      expect(countAfterSecondScan).toBe(countAfterFirstScan);
    });

    it('rejects scan for household in outside route with 400 OUTSIDE_ASSIGNED_ROUTE', async () => {
      const agentToken = 'agt-token-ramesh';
      registerSession(agentToken, RAMESH_AGENT);
      setApiBearerToken(agentToken);

      // Create an outside-ward household in the store
      const state = getStoreState();
      state.accounts.push({
        user_id: 'cons-outside-qr',
        name: 'Outside Resident',
        mobile_number: '9998887775',
        password: 'Pass@123',
        role: 'CONSUMER' as const,
        area_code: '600099', // Outside Ramesh's assigned routes
        qr_payload: 'GPC-QR-CONS-OUTSIDE-99',
      });

      let errorStatus = 0;
      let errorCode = '';
      try {
        await agentService.scanCollectionQR({
          qr_payload: 'GPC-QR-CONS-OUTSIDE-99',
          waste_weight_kg: 3.5,
        });
      } catch (err: unknown) {
        const errObj = err as { response?: { status?: number; data?: { errors?: { error_code?: string } } } };
        errorStatus = errObj.response?.status || 0;
        errorCode = errObj.response?.data?.errors?.error_code || '';
      }

      expect(errorStatus).toBe(400);
      expect(errorCode).toBe('OUTSIDE_ASSIGNED_ROUTE');
    });
  });

  // 4. Phase 3 Exit Gate & F-04: Competing Claims on Mutable Request
  describe('Phase 3 Exit Gate & F-04: Competing Claims on Shared Mutable Request', () => {
    it('executes competing claims with two agent sessions: asserts one success, one conflict (409), and one persisted owner', async () => {
      const rameshToken = 'agt-session-ramesh';
      const sureshToken = 'agt-session-suresh';

      registerSession(rameshToken, RAMESH_AGENT);
      registerSession(sureshToken, SURESH_AGENT);

      // Verify request is initially PENDING
      const initialState = getStoreState();
      const initialReq = initialState.pickupRequests.find((r) => r.id === 'req-001');
      expect(initialReq).toBeDefined();
      expect(initialReq?.status).toBe('PENDING');

      // Agent 1 (Ramesh) attempts to claim req-001
      setApiBearerToken(rameshToken);
      const claim1Result = await agentService.claimPickupRequest('req-001');

      expect(claim1Result.status).toBe('CLAIMED');
      expect(claim1Result.claimed_by_agent_id).toBe(RAMESH_AGENT.user_id);
      expect(claim1Result.claimed_by_agent_name).toBe(RAMESH_AGENT.name);

      // Agent 2 (Suresh) attempts to claim the same req-001
      setApiBearerToken(sureshToken);
      let claim2Status = 0;
      let claim2Error: { error_code?: string; owner_id?: string } | undefined;

      try {
        await agentService.claimPickupRequest('req-001');
      } catch (err: unknown) {
        const errObj = err as {
          response?: {
            status?: number;
            data?: { errors?: { error_code?: string; owner_id?: string } };
          };
        };
        claim2Status = errObj.response?.status || 0;
        claim2Error = errObj.response?.data?.errors;
      }

      // Assert that Agent 2 received HTTP 409 Conflict
      expect(claim2Status).toBe(409);
      expect(claim2Error?.error_code).toBe('CONFLICT');
      expect(claim2Error?.owner_id).toBe(RAMESH_AGENT.user_id);

      // Verify exactly one persisted owner in the shared store
      const finalState = getStoreState();
      const finalReq = finalState.pickupRequests.find((r) => r.id === 'req-001');
      expect(finalReq?.status).toBe('CLAIMED');
      expect(finalReq?.claimed_by_agent_id).toBe(RAMESH_AGENT.user_id);
      expect(finalReq?.claimed_by_agent_name).toBe(RAMESH_AGENT.name);
    });
  });

  // 5. Sector Fee History
  describe('Sector Fee History Ledger', () => {
    it('retrieves fee payments filtered to agent assigned sectors', async () => {
      const token = 'agt-token-ramesh';
      registerSession(token, RAMESH_AGENT);
      setApiBearerToken(token);

      const history = await agentService.getPaymentHistory();
      expect(history.content).toBeDefined();
      expect(history.content.length).toBeGreaterThan(0);

      // Payments returned must be in Ramesh's assigned area codes
      history.content.forEach((item) => {
        expect(['600001', '600040']).toContain(item.area_code);
      });
    });
  });

  // 6. Operational Support Desk
  describe('Agent Operational Grievances', () => {
    it('creates an operational support ticket and tags user_role as AGENT', async () => {
      const token = 'agt-token-ramesh';
      registerSession(token, RAMESH_AGENT);
      setApiBearerToken(token);

      const ticket = await agentService.createSupportTicket({
        category: 'Vehicle Breakdown',
        subject: 'Hydraulic lift issue on TN-01-WM-4042',
        description: 'Hydraulic lift failed to cycle at 08:30 AM near Harbour Gate.',
      });

      expect(ticket.ticket_id).toBeDefined();
      expect(ticket.user_role).toBe('AGENT');
      expect(ticket.user_id).toBe(RAMESH_AGENT.user_id);
      expect(ticket.status).toBe('OPEN');

      // Verify in list
      const list = await agentService.getSupportTickets();
      const found = list.content.find((t) => t.ticket_id === ticket.ticket_id);
      expect(found).toBeDefined();
      expect(found?.subject).toBe('Hydraulic lift issue on TN-01-WM-4042');
    });
  });
});
