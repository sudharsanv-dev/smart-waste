// tests/flows/authFlows.test.ts
// Phase 1 Auth, Session, and Locked Contract Integration Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../../src/api/authService';
import { scheduleService } from '../../src/api/scheduleService';
import { notificationService } from '../../src/api/notificationService';
import { resetDemoData } from '../../src/api/mockStore';
import { getApiBearerToken } from '../../src/api/axiosClient';
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
  });

  describe('3.2 Locked Schedules Service Flows (C-03)', () => {
    it('fetches admin schedules with root pagination', async () => {
      const data = await scheduleService.getAdminSchedules();
      expect(Array.isArray(data.content)).toBe(true);
      expect(data.page_number).toBe(0);
      expect(data.total_elements).toBeGreaterThan(0);
      expect(data.content[0].area_code).toBeDefined();
    });

    it('fetches agent schedules with root pagination', async () => {
      const data = await scheduleService.getAgentSchedules();
      expect(Array.isArray(data.content)).toBe(true);
      expect(data.page_number).toBe(0);
      expect(data.total_elements).toBeGreaterThan(0);
    });

    it('fetches consumer neighborhood schedules with root pagination', async () => {
      const data = await scheduleService.getConsumerSchedules({ area_code: '600001' });
      expect(Array.isArray(data.content)).toBe(true);
      expect(data.page_number).toBe(0);
      expect(data.total_elements).toBeGreaterThan(0);
    });
  });

  describe('3.3 Locked Notifications Service Flows (C-04)', () => {
    it('registers device token successfully', async () => {
      const res = await notificationService.registerDeviceToken({
        device_id: 'test-device-uuid',
        token: 'fcm-test-token-12345',
        platform: 'ANDROID',
      });
      expect(res.message).toBe('Device token registered successfully');
      expect(res.updated_at).toBeDefined();
    });

    it('admin broadcast returns 202 QUEUED and appears in inbox', async () => {
      const res = await notificationService.sendAdminNotification({
        title: 'Emergency Delay',
        body: 'Collection delayed by 30 mins',
        target_type: 'PINCODE',
        target_value: '600001',
      });
      expect(res.status).toBe('QUEUED');
      expect(res.dispatch_id).toBeDefined();

      const inbox = await notificationService.getNotifications();
      const found = inbox.content.find((n) => n.title === 'Emergency Delay');
      expect(found).toBeDefined();
      expect(found?.status).toBe('UNREAD');
    });

    it('agent arrival notification returns 202 QUEUED', async () => {
      const res = await notificationService.sendAgentNotification({
        title: 'Agent Arriving Soon',
        body: 'Truck is approaching your street',
        target_user_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
      });
      expect(res.status).toBe('QUEUED');
      expect(res.dispatch_id).toBeDefined();
    });

    it('marks notification as read', async () => {
      const inbox = await notificationService.getNotifications();
      const first = inbox.content[0];
      expect(first).toBeDefined();

      const readRes = await notificationService.markNotificationAsRead(first.id);
      expect(readRes.id).toBe(first.id);
      expect(readRes.status).toBe('READ');

      const updatedInbox = await notificationService.getNotifications();
      const updated = updatedInbox.content.find((n) => n.id === first.id);
      expect(updated?.status).toBe('READ');
    });
  });
});
