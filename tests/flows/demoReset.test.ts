// tests/flows/demoReset.test.ts
// Test Phase 0 deterministic seed, mockStore transitions, and Reset Demo Data control

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getStoreState, setStoreState, resetDemoData } from '../../src/api/mockStore';
import { getInitialSeedState, SCHEMA_VERSION } from '../../src/api/mockData';
import { ResetDemoDataControl } from '../../src/components/demo/ResetDemoDataControl';
import * as envModule from '../../src/lib/env';

describe('Deterministic Seed & Demo Data Reset (Phase 0 Deliverable)', () => {
  beforeEach(() => {
    // Reset to deterministic seed before each test
    resetDemoData();
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
    // Spy or override IS_DEMO to false
    const isDemoSpy = vi.spyOn(envModule, 'IS_DEMO', 'get').mockReturnValue(false);
    const html = renderToString(React.createElement(ResetDemoDataControl));
    expect(html).toBe('');
    isDemoSpy.mockRestore();
  });
});
