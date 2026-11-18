// scripts/test-contracts.js
// Runs contract fixture assertions using Node 26 built-in test runner

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(filename) {
  const filepath = path.resolve(__dirname, '..', 'tests', 'contracts', 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

describe('Section 3 Locked Backend API Contracts (C-01 to C-04)', () => {
  describe('3.1 Common Authentication Contract (POST /api/v1/auth/login)', () => {
    it('C-01a: Consumer login request payload matches exact locked contract', () => {
      const payload = loadFixture('auth_login_consumer_req.json');
      assert.deepStrictEqual(payload, {
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER'
      });
    });

    it('C-01b: Admin login request payload matches exact locked contract', () => {
      const payload = loadFixture('auth_login_admin_req.json');
      assert.deepStrictEqual(payload, {
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN'
      });
    });

    it('C-01c: Agent login request payload matches exact locked contract', () => {
      const payload = loadFixture('auth_login_agent_req.json');
      assert.deepStrictEqual(payload, {
        mobile_number: '9876543210',
        password: 'Agent@123',
        type: 'AGENT'
      });
    });

    it('C-01d: Success response (200 OK) has exact auth envelope and fields', () => {
      const res = loadFixture('auth_login_success_res.json');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.message, 'Consumer login successful');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.errors, null);
      assert.ok(res.data);

      const { data } = res;
      assert.strictEqual(data.user_id, 'c1d2e3f4-a5b6-7890-1234-56789abcdef0');
      assert.strictEqual(data.name, 'John');
      assert.strictEqual(data.username, 'admin');
      assert.strictEqual(data.mobile_number, '9876543210');
      assert.strictEqual(data.role, 'CONSUMER');
      assert.strictEqual(data.access_token, 'jwt_access_token');
      assert.strictEqual(data.refresh_token, 'jwt_refresh_token');
      assert.strictEqual(data.token_type, 'Bearer');
      assert.strictEqual(data.expires_in, 3600);
    });

    it('C-02: Standard error response (401) has exact envelope and error_code', () => {
      const res = loadFixture('auth_login_error_res.json');
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.message, 'Invalid username/mobile number or password');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.data, null);
      assert.deepStrictEqual(res.errors, {
        error_code: 'INVALID_CREDENTIALS'
      });
    });
  });

  describe('3.2 Scheduler Contract (Root Pagination)', () => {
    it('C-03a: Admin master schedules response has root pagination structure', () => {
      const res = loadFixture('admin_schedules_res.json');
      assert.ok(Array.isArray(res.content));
      assert.strictEqual(res.page_number, 0);
      assert.strictEqual(res.page_size, 20);
      assert.strictEqual(res.total_elements, 45);
      assert.strictEqual(res.total_pages, 3);
      assert.strictEqual(res.last, false);

      const item = res.content[0];
      assert.deepStrictEqual(item, {
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
      assert.ok(Array.isArray(res.content));
      assert.strictEqual(res.page_number, 0);
      assert.strictEqual(res.page_size, 20);
      assert.strictEqual(res.total_elements, 12);
      assert.strictEqual(res.total_pages, 1);
      assert.strictEqual(res.last, true);

      const item = res.content[0];
      assert.deepStrictEqual(item, {
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
      assert.ok(Array.isArray(res.content));
      assert.strictEqual(res.page_number, 0);
      assert.strictEqual(res.page_size, 10);
      assert.strictEqual(res.total_elements, 8);
      assert.strictEqual(res.total_pages, 1);
      assert.strictEqual(res.last, true);

      const item = res.content[0];
      assert.deepStrictEqual(item, {
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
      assert.deepStrictEqual(req, {
        device_id: 'string',
        token: 'string',
        platform: 'ANDROID'
      });

      const res = loadFixture('device_token_res.json');
      assert.deepStrictEqual(res, {
        message: 'Device token registered successfully',
        updated_at: '2026-11-14T18:30:00Z'
      });
    });

    it('C-04b: Admin bulk dispatch returns 202 QUEUED with target_type', () => {
      const req = loadFixture('admin_notifications_send_req.json');
      assert.strictEqual(req.target_type, 'PINCODE');
      assert.strictEqual(req.target_value, '600040');

      const res = loadFixture('admin_notifications_send_res.json');
      assert.strictEqual(res.status, 'QUEUED');
      assert.strictEqual(res.dispatch_id, 'a1b2c3d4-e5f6-7890-1234-56789abcdef0');
      assert.strictEqual(res.target_type, 'PINCODE');
      assert.strictEqual(res.target_value, '600040');
      assert.strictEqual(res.timestamp, '2026-11-14T18:35:00Z');
    });

    it('C-04c: Agent notify arrival returns 202 QUEUED with target_user_id', () => {
      const req = loadFixture('agent_notifications_send_req.json');
      assert.strictEqual(req.target_user_id, 'uuid-of-the-consumer');

      const res = loadFixture('agent_notifications_send_res.json');
      assert.strictEqual(res.status, 'QUEUED');
      assert.strictEqual(res.dispatch_id, 'f5e4d3c2-b1a0-9876-5432-109876abcdef');
      assert.strictEqual(res.target_user_id, 'uuid-of-the-consumer');
      assert.strictEqual(res.timestamp, '2026-11-14T18:40:00Z');
    });

    it('C-04d: Notification history (inbox) has root pagination with UNREAD items', () => {
      const res = loadFixture('notifications_inbox_res.json');
      assert.ok(Array.isArray(res.content));
      assert.strictEqual(res.page_number, 0);
      assert.strictEqual(res.page_size, 20);
      assert.strictEqual(res.total_elements, 2);
      assert.strictEqual(res.total_pages, 1);
      assert.strictEqual(res.last, true);

      const item = res.content[0];
      assert.deepStrictEqual(item, {
        id: 'c3d4e5f6-1234-5678-90ab-cdef12345678',
        title: 'Agent Arriving Soon',
        body: 'Your waste collection agent is 5 minutes away.',
        status: 'UNREAD',
        created_at: '2026-11-14T18:40:00Z'
      });
    });

    it('C-04e: Mark notification as read returns updated READ status', () => {
      const res = loadFixture('notifications_mark_read_res.json');
      assert.deepStrictEqual(res, {
        id: 'c3d4e5f6-1234-5678-90ab-cdef12345678',
        status: 'READ',
        updated_at: '2026-11-14T18:45:00Z'
      });
    });
  });
});
