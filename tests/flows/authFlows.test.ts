// tests/flows/authFlows.test.ts
// Phase 1 Auth, Session Separation, Ownership Enforcement, and Locked Contract Integration Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../src/api/authService';
import { scheduleService } from '../../src/api/scheduleService';
import { notificationService } from '../../src/api/notificationService';
import { backendGapService } from '../../src/api/backendGapService';
import { resetDemoData } from '../../src/api/mockStore';
import { getApiBearerToken, setApiBearerToken } from '../../src/api/axiosClient';
import * as envModule from '../../src/lib/env';
import '../../src/api/mockAdapter'; // Ensure mock adapter is wired

describe('Phase 1 Auth, Role Resolution, and Locked Contracts Flow', () => {
  beforeEach(() => {
    resetDemoData();
    authService.logout();
  });

  describe('3.1 Locked Authentication Flows (C-01, C-02)', () => {
    it('logs in as CONSUMER and resolves role strictly from server payload', async () => {
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
    it('registers device token successfully', async () => {
      const res = await notificationService.registerDeviceToken({
        device_id: 'test-device-uuid',
        token: 'fcm-test-token-12345',
        platform: 'ANDROID',
      });
      expect(res.message).toBe('Device token registered successfully');
      expect(res.updated_at).toBeDefined();
    });

    it('admin broadcast returns 202 QUEUED and appears in consumer inbox', async () => {
      await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });

      const res = await notificationService.sendAdminNotification({
        title: 'Emergency Delay',
        body: 'Collection delayed by 30 mins',
        target_type: 'PINCODE',
        target_value: '600001',
      });
      expect(res.status).toBe('QUEUED');
      expect(res.dispatch_id).toBeDefined();

      // Consumer in area 600001 logs in and sees broadcast notification
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const inbox = await notificationService.getNotifications();
      const found = inbox.content.find((n) => n.title === 'Emergency Delay');
      expect(found).toBeDefined();
      expect(found?.status).toBe('UNREAD');
    });

    it('agent arrival notification returns 202 QUEUED and is delivered to targeted consumer', async () => {
      await authService.login({
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT',
      });

      const res = await notificationService.sendAgentNotification({
        title: 'Agent Arriving Soon',
        body: 'Truck is approaching your street',
        target_user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0', // John Doe
      });
      expect(res.status).toBe('QUEUED');
      expect(res.dispatch_id).toBeDefined();

      // Targeted consumer logs in and sees notification
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const inbox = await notificationService.getNotifications();
      const arrival = inbox.content.find((n) => n.body === 'Truck is approaching your street');
      expect(arrival).toBeDefined();
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
