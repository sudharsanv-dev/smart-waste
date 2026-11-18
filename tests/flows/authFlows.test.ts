// tests/flows/authFlows.test.ts
// Phase 1 Auth, Session Registry, Ownership Enforcement, and Locked Contract Integration Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../src/api/authService';
import { scheduleService } from '../../src/api/scheduleService';
import { notificationService } from '../../src/api/notificationService';
import { backendGapService } from '../../src/api/backendGapService';
import { resetDemoData, registerDemoSession } from '../../src/api/mockStore';
import { getApiBearerToken, setApiBearerToken, axiosClient } from '../../src/api/axiosClient';
import * as envModule from '../../src/lib/env';
import '../../src/api/mockAdapter'; // Ensure mock adapter is wired

describe('Phase 1 Auth, Role Resolution, and Locked Contracts Flow', () => {
  beforeEach(() => {
    resetDemoData();
    authService.logout();
  });

  describe('3.1 Locked Authentication Flows (C-01, C-02)', () => {
    it('logs in as CONSUMER, resolves role strictly from server payload, and discards refresh token at boundary', async () => {
      const authData = await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      expect(authData.role).toBe('CONSUMER');
      expect(authData.user_id).toBe('c1d2e3f4-a5b6-7890-1234-56789abcdef0');
      expect(authData.name).toBe('John Doe');
      expect(authData.mobile_number).toBe('9876543210');
      expect(authData.token_type).toBe('Bearer');
      expect(authData.access_token).toBeDefined();
      expect(getApiBearerToken()).toBe(authData.access_token);

      // Verify that unused live refresh token is discarded at auth-service boundary
      expect('refresh_token' in authData).toBe(false);
    });

    it('logs in as ADMIN and resolves role strictly from server payload', async () => {
      const authData = await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });

      expect(authData.role).toBe('ADMIN');
      expect(authData.username).toBe('admin');
      expect(authData.user_id).toBe('d2e3f4a5-b6c7-8901-2345-67890abcdef1');
      expect(getApiBearerToken()).toBe(authData.access_token);
      expect('refresh_token' in authData).toBe(false);
    });

    it('logs in as AGENT and resolves role strictly from server payload', async () => {
      const authData = await authService.login({
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT',
      });

      expect(authData.role).toBe('AGENT');
      expect(authData.user_id).toBe('a1b2c3d4-e5f6-7890-1234-56789abcdef0');
      expect(authData.name).toBe('Ramesh Kumar');
      expect(getApiBearerToken()).toBe(authData.access_token);
      expect('refresh_token' in authData).toBe(false);
    });

    it('rejects invalid password with 401 error envelope and INVALID_CREDENTIALS', async () => {
      let failed = false;
      try {
        await authService.login({
          mobile_number: '9876543210',
          password: 'WrongPassword',
          type: 'CONSUMER',
        });
      } catch (err: unknown) {
        failed = true;
        const axiosErr = err as { response?: { status?: number; data?: { errors?: { error_code?: string } } } };
        expect(axiosErr.response?.status).toBe(401);
        expect(axiosErr.response?.data?.errors?.error_code).toBe('INVALID_CREDENTIALS');
      }
      expect(failed).toBe(true);
      expect(getApiBearerToken()).toBeNull();
    });

    it('clears token on logout', async () => {
      await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });
      expect(getApiBearerToken()).not.toBeNull();

      authService.logout();
      expect(getApiBearerToken()).toBeNull();
    });

    it('session expiry triggers 401 and clears API bearer token', async () => {
      await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });
      expect(getApiBearerToken()).not.toBeNull();

      try {
        await authService.simulateExpire();
      } catch {
        // expected 401
      }

      // Interceptor should have cleared the token
      expect(getApiBearerToken()).toBeNull();
    });

    it('honors expires_in on use (expired in-memory token returns null)', () => {
      // Set a token that expired 1 second ago
      setApiBearerToken('expired_test_token', -1);
      expect(getApiBearerToken()).toBeNull();
    });

    it('rejects unknown or unregistered demo sessions with 401', async () => {
      setApiBearerToken('unknown_fake_token_random');
      let rejected = false;
      try {
        await scheduleService.getAdminSchedules();
      } catch (err: unknown) {
        rejected = true;
        const axiosErr = err as { response?: { status?: number } };
        expect(axiosErr.response?.status).toBe(401);
      }
      expect(rejected).toBe(true);
    });

    it('rejects expired demo sessions with 401', async () => {
      const expiredToken = 'demo_tok_expired_fixture';
      registerDemoSession({
        token: expiredToken,
        user_id: 'd2e3f4a5-b6c7-8901-2345-67890abcdef1',
        role: 'ADMIN',
        expires_at: Date.now() - 5000, // expired 5s ago
      });

      setApiBearerToken(expiredToken);
      let rejected = false;
      try {
        await scheduleService.getAdminSchedules();
      } catch (err: unknown) {
        rejected = true;
        const axiosErr = err as { response?: { status?: number } };
        expect(axiosErr.response?.status).toBe(401);
      }
      expect(rejected).toBe(true);
    });

    it('preserves valid demo reload: registered active session resolves account', async () => {
      const activeToken = 'demo_tok_reload_fixture';
      registerDemoSession({
        token: activeToken,
        user_id: 'd2e3f4a5-b6c7-8901-2345-67890abcdef1',
        role: 'ADMIN',
        expires_at: Date.now() + 3600 * 1000,
      });

      setApiBearerToken(activeToken);
      const schedules = await scheduleService.getAdminSchedules();
      expect(schedules.content.length).toBeGreaterThan(0);
    });
  });

  describe('3.2 Locked Schedules Service Flows & Ownership Enforcement (C-03)', () => {
    it('Admin fetches master schedules with root pagination', async () => {
      await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });

      const data = await scheduleService.getAdminSchedules();
      expect(Array.isArray(data.content)).toBe(true);
      expect(data.page_number).toBe(0);
      expect(data.total_elements).toBe(3); // All 3 master schedules
      expect(data.content[0].area_code).toBeDefined();
    });

    it('enforces Agent ownership between two different agent accounts', async () => {
      // 1. Log in as Agent 1 (Ramesh Kumar - area 600001, 600040)
      await authService.login({
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT',
      });

      const agent1Data = await scheduleService.getAgentSchedules();
      expect(agent1Data.content.length).toBe(2);
      expect(agent1Data.content.map((s) => s.area_code).sort()).toEqual(['600001', '600040']);

      // 2. Log in as Agent 2 (Suresh Babu - area 600002, 600096)
      await authService.login({
        mobile_number: '9876543211',
        password: 'Agent@123',
        type: 'AGENT',
      });

      const agent2Data = await scheduleService.getAgentSchedules();
      expect(agent2Data.content.length).toBe(1);
      expect(agent2Data.content[0].area_code).toBe('600002');

      // Verify Agent 2 does not see Agent 1's assignments
      const agent2Areas = agent2Data.content.map((s) => s.area_code);
      expect(agent2Areas.includes('600001')).toBe(false);
      expect(agent2Areas.includes('600040')).toBe(false);
    });

    it('enforces Consumer permitted neighborhood timetable', async () => {
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      // Permitted area 600001 returns schedule
      const data = await scheduleService.getConsumerSchedules({ area_code: '600001' });
      expect(data.content.length).toBeGreaterThan(0);

      // Unpermitted area 600096 returns 0 elements
      const unpermitted = await scheduleService.getConsumerSchedules({ area_code: '600096' });
      expect(unpermitted.content.length).toBe(0);
      expect(unpermitted.total_elements).toBe(0);
    });
  });

  describe('3.3 Locked Notifications Service Flows & Ownership Enforcement (C-04)', () => {
    it('requires authenticated session for device token registration', async () => {
      // 1. Unauthenticated request should fail with 401
      let unauthFailed = false;
      try {
        await axiosClient.post('/api/v1/notifications/device-token', {
          device_id: 'test-device-uuid',
          token: 'fcm-test-token-12345',
          platform: 'ANDROID',
        });
      } catch (err: unknown) {
        unauthFailed = true;
        const axiosErr = err as { response?: { status?: number } };
        expect(axiosErr.response?.status).toBe(401);
      }
      expect(unauthFailed).toBe(true);

      // 2. Authenticated request succeeds with 200
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const res = await notificationService.registerDeviceToken({
        device_id: 'test-device-uuid',
        token: 'fcm-test-token-12345',
        platform: 'ANDROID',
      });
      expect(res.message).toBe('Device token registered successfully');
      expect(res.updated_at).toBeDefined();
    });

    it('admin broadcast with multiple recipients maintains separate read status for each recipient', async () => {
      // Admin broadcasts emergency alert to ALL
      await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });

      const sendRes = await notificationService.sendAdminNotification({
        title: 'Citywide Sanitation Alert',
        body: 'Heavy rainfall alert in all wards',
        target_type: 'ALL',
        target_value: 'ALL',
      });
      expect(sendRes.status).toBe('QUEUED');

      // 1. Recipient A (Consumer John Doe) checks inbox -> UNREAD
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const consumerInbox = await notificationService.getNotifications();
      const notifForA = consumerInbox.content.find((n) => n.title === 'Citywide Sanitation Alert');
      expect(notifForA).toBeDefined();
      expect(notifForA?.status).toBe('UNREAD');

      // Recipient A marks it as READ
      const readRes = await notificationService.markNotificationAsRead(notifForA!.id);
      expect(readRes.status).toBe('READ');

      // Recipient A sees it as READ
      const consumerInboxAfter = await notificationService.getNotifications();
      const notifForAAfter = consumerInboxAfter.content.find((n) => n.id === notifForA!.id);
      expect(notifForAAfter?.status).toBe('READ');

      // 2. Recipient B (Agent Ramesh Kumar) checks inbox -> MUST STILL BE UNREAD
      await authService.login({
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT',
      });

      const agentInbox = await notificationService.getNotifications();
      const notifForB = agentInbox.content.find((n) => n.id === notifForA!.id);
      expect(notifForB).toBeDefined();
      expect(notifForB?.status).toBe('UNREAD'); // Still UNREAD for Agent B!
    });

    it('agent arrival notification validates consumer on assigned route', async () => {
      // Agent 1 (Ramesh Kumar - assigned to 600001, 600040)
      await authService.login({
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT',
      });

      // 1. Target consumer inside route (John Doe in 600001) -> succeeds with 202
      const validRes = await notificationService.sendAgentNotification({
        title: 'Agent Arriving Soon',
        body: 'Truck is on your street',
        target_user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
      });
      expect(validRes.status).toBe('QUEUED');

      // 2. Target consumer outside route (hh-005 Vignesh Iyer in 600002) -> fails with 400 OUTSIDE_ASSIGNED_ROUTE
      let outsideFailed = false;
      try {
        await notificationService.sendAgentNotification({
          title: 'Agent Arriving Soon',
          body: 'Truck is on your street',
          target_user_id: 'hh-005',
        });
      } catch (err: unknown) {
        outsideFailed = true;
        const axiosErr = err as { response?: { status?: number; data?: { errors?: { error_code?: string } } } };
        expect(axiosErr.response?.status).toBe(400);
        expect(axiosErr.response?.data?.errors?.error_code).toBe('OUTSIDE_ASSIGNED_ROUTE');
      }
      expect(outsideFailed).toBe(true);
    });

    it('admin personal inbox contains only admin audience notifications (does not leak consumer private notifications)', async () => {
      await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });

      const adminInbox = await notificationService.getNotifications();
      // Seed notification 1 ("Agent Arriving Soon") is targeted directly to John Doe; admin personal inbox must not contain it
      const privateArrivalNotif = adminInbox.content.find((n) => n.title === 'Agent Arriving Soon');
      expect(privateArrivalNotif).toBeUndefined();
    });

    it('mark-read allows owner to update and rejects non-owner with 403', async () => {
      // Consumer John Doe logs in and gets his notification ID
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const inbox = await notificationService.getNotifications();
      const targetNotif = inbox.content.find((n) => n.id === 'c3d4e5f6-1234-5678-90ab-cdef12345678');
      expect(targetNotif).toBeDefined();
      expect(targetNotif?.status).toBe('UNREAD');

      // Agent 2 (Suresh Babu) logs in and tries to mark John Doe's private notification as read
      await authService.login({
        mobile_number: '9876543211',
        password: 'Agent@123',
        type: 'AGENT',
      });

      let agentMarkFailed = false;
      try {
        await notificationService.markNotificationAsRead(targetNotif!.id);
      } catch (err: unknown) {
        agentMarkFailed = true;
        const axiosErr = err as { response?: { status?: number; data?: { errors?: { error_code?: string } } } };
        expect(axiosErr.response?.status).toBe(403);
        expect(axiosErr.response?.data?.errors?.error_code).toBe('FORBIDDEN');
      }
      expect(agentMarkFailed).toBe(true);

      // Now Consumer John Doe logs back in and marks it as read
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const readRes = await notificationService.markNotificationAsRead(targetNotif!.id);
      expect(readRes.id).toBe(targetNotif!.id);
      expect(readRes.status).toBe('READ');

      const updatedInbox = await notificationService.getNotifications();
      const updated = updatedInbox.content.find((n) => n.id === targetNotif!.id);
      expect(updated?.status).toBe('READ');
    });
  });

  describe('Section 4 Backend Gap Guard (backendGapService.ts)', () => {
    it('returns explicit unavailable result in live mode before sending network request', async () => {
      // Simulate live mode
      const isDemoSpy = vi.spyOn(envModule, 'IS_DEMO', 'get').mockReturnValue(false);
      const useMockSpy = vi.spyOn(envModule, 'USE_MOCK_API', 'get').mockReturnValue(false);

      try {
        const result = await backendGapService.getConsumerDashboard();
        expect(result).toHaveProperty('unavailable', true);
        expect(result).toHaveProperty('success', false);
        expect((result as { message: string }).message).toContain('TODO_BACKEND_SATHEESH');
      } finally {
        isDemoSpy.mockRestore();
        useMockSpy.mockRestore();
      }
    });
  });
});
