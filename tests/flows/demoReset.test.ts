// tests/flows/demoReset.test.ts
// Test Phase 0 deterministic seed, mockStore transitions, migration of legacy notifications,
// session registry lifecycle (reload, logout, reset, expiry), and Reset Demo Data control

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  getStoreState,
  setStoreState,
  resetDemoData,
  migrateDemoState,
  registerDemoSession,
  getDemoSession,
} from '../../src/api/mockStore';
import { getInitialSeedState, SCHEMA_VERSION } from '../../src/api/mockData';
import { ResetDemoDataControl } from '../../src/components/demo/ResetDemoDataControl';
import { authService } from '../../src/api/authService';
import { notificationService } from '../../src/api/notificationService';
import { AUTH_EXPIRED_EVENT } from '../../src/api/axiosClient';
import * as envModule from '../../src/lib/env';
import '../../src/api/mockAdapter';

describe('Deterministic Seed & Demo Data Reset (Phase 0 Deliverable)', () => {
  beforeEach(() => {
    // Reset to deterministic seed before each test
    resetDemoData();
    authService.logout();
  });

  it('initializes with exact deterministic seed from DEMO_SPEC.md (v1.0.0)', () => {
    const state = getStoreState();
    expect(state.version).toBe(SCHEMA_VERSION);
    expect(state.accounts.length).toBe(4); // Consumer, Admin, Agent 1, Agent 2
    expect(state.households.length).toBe(10);
    expect(state.schedules.length).toBe(3);
    expect(state.payments.length).toBe(3);
    expect(state.notifications.length).toBe(2);
    expect(state.tickets.length).toBe(2);
    expect(state.pickupRequests.length).toBe(1);
    expect(state.banking.account_holder_name).toContain('Corporation of GreenPulse');

    // Verify key seed accounts
    const consumer = state.accounts.find((a) => a.role === 'CONSUMER');
    expect(consumer?.name).toBe('John Doe');
    expect(consumer?.mobile_number).toBe('9876543210');

    const admin = state.accounts.find((a) => a.role === 'ADMIN');
    expect(admin?.username).toBe('admin');

    const agent1 = state.accounts.find((a) => a.user_id === 'a1b2c3d4-e5f6-7890-1234-56789abcdef0');
    expect(agent1?.name).toBe('Ramesh Kumar');
  });

  it('changing demo data mutates the state', () => {
    const original = getStoreState();
    const unpaidInvoice = original.payments.find((p) => p.status === 'UNPAID');
    expect(unpaidInvoice).toBeDefined();

    // Mutate state: mark invoice as paid
    setStoreState((prev) => ({
      ...prev,
      payments: prev.payments.map((p) =>
        p.id === unpaidInvoice!.id ? { ...p, status: 'PAID', paid_at: new Date().toISOString() } : p
      ),
    }));

    const modified = getStoreState();
    const updatedInvoice = modified.payments.find((p) => p.id === unpaidInvoice!.id);
    expect(updatedInvoice?.status).toBe('PAID');
    expect(updatedInvoice?.paid_at).toBeDefined();
    expect(modified).not.toEqual(original);
  });

  it('resetDemoData restores the original deterministic seed', () => {
    const seed = getInitialSeedState();

    // Mutate state by adding a household and modifying payments
    setStoreState((prev) => ({
      ...prev,
      households: [
        ...prev.households,
        {
          id: 'hh-999',
          name: 'Temporary Resident',
          mobile_number: '9999999999',
          email: 'temp@test.com',
          address: '99 Temp St',
          area_code: '600001',
          is_active: true,
          qr_payload: 'TEMP-TOKEN',
          created_at: new Date().toISOString(),
        },
      ],
      payments: [],
    }));

    expect(getStoreState().households.length).toBe(11);
    expect(getStoreState().payments.length).toBe(0);

    // Reset demo data
    const restored = resetDemoData();

    // Must be identical to initial seed
    expect(restored).toEqual(seed);
    expect(getStoreState()).toEqual(seed);
    expect(getStoreState().households.length).toBe(10);
    expect(getStoreState().payments.length).toBe(3);
  });

  it('calling reset a second time gives the exact same result (idempotency)', () => {
    const firstReset = resetDemoData();
    const secondReset = resetDemoData();
    expect(firstReset).toEqual(secondReset);
    expect(getStoreState()).toEqual(firstReset);
  });

  it('ResetDemoDataControl renders in demo mode', () => {
    const html = renderToString(React.createElement(ResetDemoDataControl));
    expect(html).toContain('Reset Demo Data');
    expect(html).toContain('reset-demo-data-btn');
  });

  it('ResetDemoDataControl is NOT exposed in production mode (Finding 1 requirement)', () => {
    const isDemoSpy = vi.spyOn(envModule, 'IS_DEMO', 'get').mockReturnValue(false);
    const html = renderToString(React.createElement(ResetDemoDataControl));
    expect(html).toBe('');
    isDemoSpy.mockRestore();
  });

  describe('Phase 1 Notification Migration from commit 966e14b', () => {
    it('migrates legacy 966e14b store through load -> inbox -> mark-read -> reload without resetting', async () => {
      // 1. Construct a legacy 966e14b state with recipient_id and no read_by
      const seed = getInitialSeedState();
      const legacyState = {
        ...seed,
        notifications: [
          {
            id: 'legacy-notif-001',
            recipient_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0', // John Doe
            title: 'Legacy Pickup Notice',
            body: 'Old format unread notification',
            status: 'UNREAD' as const,
            created_at: '2026-11-14T10:00:00Z',
          },
          {
            id: 'legacy-notif-002',
            recipient_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0', // John Doe
            title: 'Legacy Bill',
            body: 'Old format read notification',
            status: 'READ' as const,
            created_at: '2026-11-10T10:00:00Z',
          },
        ],
      };

      // Set directly as mockStore state
      setStoreState(legacyState as unknown as typeof seed);

      // Verify migration ran on load: target_user_id populated, recipient_id migrated, read_by preserved
      const loaded = getStoreState();
      expect(loaded.notifications[0].target_user_id).toBe('c1d2e3f4-a5b6-7890-1234-56789abcdef0');
      expect(loaded.notifications[0].read_by).toEqual([]);
      expect(loaded.notifications[1].target_user_id).toBe('c1d2e3f4-a5b6-7890-1234-56789abcdef0');
      expect(loaded.notifications[1].read_by).toEqual(['c1d2e3f4-a5b6-7890-1234-56789abcdef0']);
      // Verify unrelated store data is untouched
      expect(loaded.accounts.length).toBe(seed.accounts.length);
      expect(loaded.households.length).toBe(seed.households.length);
      expect(loaded.schedules.length).toBe(seed.schedules.length);

      // Verify running migration a second time is safe and idempotent
      const twice = migrateDemoState(loaded);
      expect(twice).toEqual(loaded);

      // Normal flow: login as consumer -> fetch inbox -> mark unread as read
      await authService.login({
        mobile_number: '9876543210',
        password: 'Consumer@123',
        type: 'CONSUMER',
      });

      const inbox = await notificationService.getNotifications();
      const unreadItem = inbox.content.find((n) => n.id === 'legacy-notif-001');
      const readItem = inbox.content.find((n) => n.id === 'legacy-notif-002');
      expect(unreadItem?.status).toBe('UNREAD');
      expect(readItem?.status).toBe('READ');

      // Mark unread notification as read
      const markRes = await notificationService.markNotificationAsRead('legacy-notif-001');
      expect(markRes.status).toBe('READ');

      // Normal reload simulation: fetch state again without resetting demo
      const reloadedState = getStoreState();
      const updatedNotif = reloadedState.notifications.find((n) => n.id === 'legacy-notif-001');
      expect(updatedNotif?.status).toBe('READ');
      expect(updatedNotif?.read_by).toContain('c1d2e3f4-a5b6-7890-1234-56789abcdef0');
      expect(reloadedState.accounts.length).toBe(seed.accounts.length);
    });
  });

  describe('Session Registry Lifecycle (Reload, Logout, Reset, Expiry)', () => {
    it('valid reload: registered session is resolved from registry and matches account', async () => {
      const session = await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });

      const registered = getDemoSession(session.access_token);
      expect(registered).not.toBeNull();
      expect(registered?.user_id).toBe('d2e3f4a5-b6c7-8901-2345-67890abcdef1');
      expect(registered?.role).toBe('ADMIN');
    });

    it('logout revokes the demo session from the registry', async () => {
      const session = await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });
      const token = session.access_token;
      expect(getDemoSession(token)).not.toBeNull();

      authService.logout();
      expect(getDemoSession(token)).toBeNull(); // Revoked in registry!
    });

    it('Reset Demo Data clears registry and triggers auth expiration for UI', async () => {
      const session = await authService.login({
        username: 'admin',
        password: 'Admin@123',
        type: 'ADMIN',
      });
      const token = session.access_token;
      expect(getDemoSession(token)).not.toBeNull();

      let eventFired = false;
      const handler = () => {
        eventFired = true;
      };
      if (typeof window !== 'undefined') {
        window.addEventListener(AUTH_EXPIRED_EVENT, handler);
      }

      resetDemoData();

      expect(getDemoSession(token)).toBeNull();
      if (typeof window !== 'undefined') {
        expect(eventFired).toBe(true);
        window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
      }
    });

    it('expiry: expired session returns null from getDemoSession and cannot be used', () => {
      const expiredToken = 'demo_tok_expired_999';
      registerDemoSession({
        token: expiredToken,
        user_id: 'd2e3f4a5-b6c7-8901-2345-67890abcdef1',
        role: 'ADMIN',
        expires_at: Date.now() - 1000,
      });

      expect(getDemoSession(expiredToken)).toBeNull();
    });
  });
});
