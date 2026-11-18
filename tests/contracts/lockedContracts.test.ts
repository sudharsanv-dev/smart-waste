// tests/contracts/lockedContracts.test.ts
// Tests validating Section 3 Locked Backend API Contracts against verbatim fixtures

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadFixture(filename: string) {
  const filepath = path.resolve(__dirname, 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

describe('Section 3 Locked Backend API Contracts (C-01 to C-04)', () => {
  describe('3.1 Common Authentication Contract (POST /api/v1/auth/login)', () => {
    it('C-01a: Consumer login request payload matches exact locked contract', () => {
      const payload = loadFixture('auth_login_consumer_req.json');
      expect(payload).toEqual({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER'
      });
      expect(typeof payload.mobile_number).toBe('string');
      expect(typeof payload.password).toBe('string');
      expect(payload.type).toBe('CONSUMER');
    });

    it('C-01b: Admin login request payload matches exact locked contract', () => {
      const payload = loadFixture('auth_login_admin_req.json');
      expect(payload).toEqual({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN'
      });
      expect(typeof payload.username).toBe('string');
      expect(typeof payload.password).toBe('string');
      expect(payload.type).toBe('ADMIN');
    });

    it('C-01c: Agent login request payload matches exact locked contract', () => {
      const payload = loadFixture('auth_login_agent_req.json');
      expect(payload).toEqual({
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT'
      });
      expect(typeof payload.mobile_number).toBe('string');
      expect(typeof payload.password).toBe('string');
      expect(payload.type).toBe('AGENT');
    });

    it('C-01d: Success response (200 OK) has exact auth envelope and fields', () => {
      const res = loadFixture('auth_login_success_res.json');
      expect(res.success).toBe(true);
      expect(res.message).toBe('Consumer login successful');
      expect(res.statusCode).toBe(200);
      expect(res.errors).toBeNull();
      expect(res.data).toBeDefined();

      const { data } = res;
      expect(data.user_id).toBe('c1d2e3f4-a5b6-7890-1234-56789abcdef0');
      expect(data.name).toBe('John');
      expect(data.username).toBe('admin');
      expect(data.mobile_number).toBe('9876543210');
      expect(data.role).toBe('CONSUMER');
      expect(data.access_token).toBe('jwt_access_token');
      expect(data.refresh_token).toBe('jwt_refresh_token');
      expect(data.token_type).toBe('Bearer');
      expect(data.expires_in).toBe(3600);
    });

    it('C-02: Standard error response (401) has exact envelope and error_code', () => {
      const res = loadFixture('auth_login_error_res.json');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Invalid username/mobile number or password');
      expect(res.statusCode).toBe(401);
      expect(res.data).toBeNull();
      expect(res.errors).toEqual({
        error_code: 'INVALID_CREDENTIALS'
      });
    });
  });

  describe('3.2 Scheduler Contract (Root Pagination)', () => {
    it('C-03a: Admin master schedules response has root pagination structure', () => {
      const res = loadFixture('admin_schedules_res.json');
      expect(Array.isArray(res.content)).toBe(true);
      expect(res.page_number).toBe(0);
      expect(res.page_size).toBe(20);
      expect(res.total_elements).toBe(45);
      expect(res.total_pages).toBe(3);
      expect(res.last).toBe(false);

      const item = res.content[0];
      expect(item).toEqual({
        id: 'f5e4d3c2-b1a0-9876-5432-109876abcdef',
        area_code: '600001',
        scheduled_date: '2026-11-15',
        start_time: '07:00:00',
        end_time: '11:00:00',
        assigned_agent_id: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        status: 'ASSIGNED'
      });
    });

    it('C-03b: Agent assigned schedules response has root pagination structure', () => {
      const res = loadFixture('agent_schedules_res.json');
      expect(Array.isArray(res.content)).toBe(true);
      expect(res.page_number).toBe(0);
      expect(res.page_size).toBe(20);
      expect(res.total_elements).toBe(12);
      expect(res.total_pages).toBe(1);
      expect(res.last).toBe(true);

      const item = res.content[0];
      expect(item).toEqual({
        id: 'f5e4d3c2-b1a0-9876-5432-109876abcdef',
        area_code: '600001',
        scheduled_date: '2026-11-15',
        start_time: '07:00:00',
        end_time: '11:00:00',
        status: 'ASSIGNED'
      });
    });

    it('C-03c: Consumer neighborhood timetable response has root pagination structure', () => {
      const res = loadFixture('consumer_schedules_res.json');
      expect(Array.isArray(res.content)).toBe(true);
      expect(res.page_number).toBe(0);
      expect(res.page_size).toBe(10);
      expect(res.total_elements).toBe(8);
      expect(res.total_pages).toBe(1);
      expect(res.last).toBe(true);

      const item = res.content[0];
      expect(item).toEqual({
        id: 'f5e4d3c2-b1a0-9876-5432-109876abcdef',
        scheduled_date: '2026-11-15',
        start_time: '07:00:00',
        end_time: '11:00:00',
        status: 'ASSIGNED'
      });
    });
  });

  describe('3.3 Push & In-App Notification Contract', () => {
    it('C-04a: Device token registration request and response match locked contract', () => {
      const req = loadFixture('device_token_req.json');
      expect(req).toEqual({
        device_id: 'string',
        token: 'string',
        platform: 'ANDROID'
      });

      const res = loadFixture('device_token_res.json');
      expect(res).toEqual({
        message: 'Device token registered successfully',
        updated_at: '2026-11-14T18:30:00Z'
      });
    });

    it('C-04b: Admin bulk dispatch returns 202 QUEUED with target_type', () => {
      const req = loadFixture('admin_notifications_send_req.json');
      expect(req.target_type).toBe('PINCODE');
      expect(req.target_value).toBe('600040');

      const res = loadFixture('admin_notifications_send_res.json');
      expect(res.status).toBe('QUEUED');
      expect(res.dispatch_id).toBe('a1b2c3d4-e5f6-7890-1234-56789abcdef0');
      expect(res.target_type).toBe('PINCODE');
      expect(res.target_value).toBe('600040');
      expect(res.timestamp).toBe('2026-11-14T18:35:00Z');
    });

    it('C-04c: Agent notify arrival returns 202 QUEUED with target_user_id', () => {
      const req = loadFixture('agent_notifications_send_req.json');
      expect(req.target_user_id).toBe('uuid-of-the-consumer');

      const res = loadFixture('agent_notifications_send_res.json');
      expect(res.status).toBe('QUEUED');
      expect(res.dispatch_id).toBe('f5e4d3c2-b1a0-9876-5432-109876abcdef');
      expect(res.target_user_id).toBe('uuid-of-the-consumer');
      expect(res.timestamp).toBe('2026-11-14T18:40:00Z');
    });

    it('C-04d: Notification history (inbox) has root pagination with UNREAD items', () => {
      const res = loadFixture('notifications_inbox_res.json');
      expect(Array.isArray(res.content)).toBe(true);
      expect(res.page_number).toBe(0);
      expect(res.page_size).toBe(20);
      expect(res.total_elements).toBe(2);
      expect(res.total_pages).toBe(1);
      expect(res.last).toBe(true);

      const item = res.content[0];
      expect(item).toEqual({
        id: 'c3d4e5f6-1234-5678-90ab-cdef12345678',
        title: 'Agent Arriving Soon',
        body: 'Your waste collection agent is 5 minutes away.',
        status: 'UNREAD',
        created_at: '2026-11-14T18:40:00Z'
      });
    });

    it('C-04e: Mark notification as read returns updated READ status', () => {
      const res = loadFixture('notifications_mark_read_res.json');
      expect(res).toEqual({
        id: 'c3d4e5f6-1234-5678-90ab-cdef12345678',
        status: 'READ',
        updated_at: '2026-11-14T18:45:00Z'
      });
    });
  });
});
