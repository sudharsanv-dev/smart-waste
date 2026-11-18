// src/api/mockStore.ts
// Persistent, versioned single-store demo data manager for GreenPulse City
// Supports browser localStorage persistence, cross-tab synchronization, and deterministic reset

import { DemoStoreState, getInitialSeedState, SCHEMA_VERSION } from './mockData';
import { NotificationItem, ManualPickupRequestItem } from '../types/contracts';
import { IS_DEMO } from '../lib/env';
import { clearSessionStorage, triggerAuthExpired } from './axiosClient';

export const DEMO_STORAGE_KEY = `smartwaste_demo_state_v${SCHEMA_VERSION}`;

let inMemoryState: DemoStoreState | null = null;
const listeners = new Set<(state: DemoStoreState) => void>();

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

// Migration helper: migrates legacy notification format (commit 966e14b) to current schema
// Preserves recipient identity, existing direct-message read status, and unrelated store data.
// Safe to run multiple times (idempotent).
export function migrateDemoState(state: DemoStoreState): DemoStoreState {
  if (!state || !Array.isArray(state.notifications)) {
    return state;
  }

  let mutated = false;
  const rawList = state.notifications as unknown as Array<Record<string, unknown>>;
  const migratedNotifications: NotificationItem[] = rawList.map((n) => {
    const legacyRecipientId = n.recipient_id as string | undefined;
    const targetUserId = (n.target_user_id as string | undefined) || legacyRecipientId;
    const hasLegacyField = 'recipient_id' in n;

    const readBy = Array.isArray(n.read_by) ? [...(n.read_by as string[])] : [];
    if (n.status === 'READ' && targetUserId && !readBy.includes(targetUserId)) {
      readBy.push(targetUserId);
    }

    if (hasLegacyField || (targetUserId && !n.target_user_id) || !Array.isArray(n.read_by)) {
      mutated = true;
      const { recipient_id: _removed, ...rest } = n;
      return {
        ...rest,
        target_user_id: targetUserId,
        read_by: readBy,
      } as unknown as NotificationItem;
    }

    return n as unknown as NotificationItem;
  });

  if (mutated) {
    const updated: DemoStoreState = {
      ...state,
      notifications: migratedNotifications,
    };
    inMemoryState = updated;
    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
    return updated;
  }

  return state;
}

export function getStoreState(): DemoStoreState {
  if (!IS_DEMO) {
    throw new Error('[SECURITY FATAL] mockStore cannot be accessed in production mode.');
  }

  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoStoreState;
        if (parsed.version === SCHEMA_VERSION) {
          const migrated = migrateDemoState(parsed);
          inMemoryState = migrated;
          return migrated;
        }
      }
    } catch (e) {
      console.warn('[mockStore] Failed to read localStorage, initializing seed:', e);
    }
  }

  if (!inMemoryState) {
    inMemoryState = getInitialSeedState();
    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(inMemoryState));
      } catch (e) {
        console.warn('[mockStore] Failed to write localStorage:', e);
      }
    }
  }

  inMemoryState = migrateDemoState(inMemoryState);
  return inMemoryState;
}

export function setStoreState(updater: DemoStoreState | ((prev: DemoStoreState) => DemoStoreState)): DemoStoreState {
  if (!IS_DEMO) {
    throw new Error('[SECURITY FATAL] mockStore cannot be updated in production mode.');
  }

  const prev = getStoreState();
  const nextRaw = typeof updater === 'function' ? updater(prev) : updater;
  const next = migrateDemoState(nextRaw);
  inMemoryState = next;

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('[mockStore] Failed to persist state to localStorage:', e);
    }
  }

  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch (err) {
      console.error('[mockStore] Listener error:', err);
    }
  });

  return next;
}

export interface DemoSessionRecord {
  token: string;
  user_id: string;
  role: 'CONSUMER' | 'ADMIN' | 'AGENT';
  expires_at: number;
}

const SESSIONS_STORAGE_KEY = 'smartwaste_demo_sessions_registry';
let inMemorySessions: Map<string, DemoSessionRecord> = new Map();

function loadSessions(): Map<string, DemoSessionRecord> {
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as DemoSessionRecord[];
        const map = new Map<string, DemoSessionRecord>();
        const now = Date.now();
        list.forEach((s) => {
          if (s.expires_at > now) {
            map.set(s.token, s);
          }
        });
        inMemorySessions = map;
        return map;
      }
    } catch {
      // ignore
    }
  }
  return inMemorySessions;
}

function saveSessions(): void {
  if (isLocalStorageAvailable()) {
    try {
      const list = Array.from(inMemorySessions.values());
      window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}

export function registerDemoSession(session: DemoSessionRecord): void {
  loadSessions();
  inMemorySessions.set(session.token, session);
  saveSessions();
}

export function getDemoSession(token: string): DemoSessionRecord | null {
  loadSessions();
  const session = inMemorySessions.get(token);
  if (!session) return null;
  if (Date.now() >= session.expires_at) {
    inMemorySessions.delete(token);
    saveSessions();
    return null;
  }
  return session;
}

export function deleteDemoSession(token: string): void {
  loadSessions();
  inMemorySessions.delete(token);
  saveSessions();
}

export function clearDemoSessions(): void {
  inMemorySessions.clear();
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(SESSIONS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

// Payment orders registry bound to signed-in consumer, unpaid invoice, and ledger amount
export interface ActivePaymentOrder {
  order_id: string;
  invoice_id: string;
  consumer_id: string;
  amount: number;
  currency: 'INR';
  key_id: string;
  status: 'CREATED' | 'PAID';
  receipt_id: string;
  paid_at?: string;
  created_at: string;
}

export const ORDERS_STORAGE_KEY = `smartwaste_demo_orders_v${SCHEMA_VERSION}`;
let inMemoryOrders = new Map<string, ActivePaymentOrder>();

function loadOrders(): Map<string, ActivePaymentOrder> {
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as ActivePaymentOrder[];
        const map = new Map<string, ActivePaymentOrder>();
        list.forEach((o) => map.set(o.order_id, o));
        inMemoryOrders = map;
        return map;
      }
    } catch {
      // ignore
    }
  }
  return inMemoryOrders;
}

function saveOrders(): void {
  if (isLocalStorageAvailable()) {
    try {
      const list = Array.from(inMemoryOrders.values());
      window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}

export function registerPaymentOrder(order: ActivePaymentOrder): void {
  loadOrders();
  inMemoryOrders.set(order.order_id, order);
  saveOrders();
}

export function getPaymentOrder(orderId: string): ActivePaymentOrder | undefined {
  loadOrders();
  return inMemoryOrders.get(orderId);
}

export function updatePaymentOrder(orderId: string, updates: Partial<ActivePaymentOrder>): void {
  loadOrders();
  const existing = inMemoryOrders.get(orderId);
  if (existing) {
    const updated = { ...existing, ...updates };
    inMemoryOrders.set(orderId, updated);
    saveOrders();
  }
}

export function clearPaymentOrders(): void {
  inMemoryOrders.clear();
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(ORDERS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function resetDemoData(): DemoStoreState {
  if (!IS_DEMO) {
    throw new Error('[SECURITY FATAL] Reset Demo Data is disabled in production mode.');
  }

  const freshSeed = getInitialSeedState();
  inMemoryState = freshSeed;
  clearDemoSessions();
  clearPaymentOrders();
  clearSessionStorage();
  triggerAuthExpired();

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(freshSeed));
    } catch (e) {
      console.warn('[mockStore] Failed to save reset state in localStorage:', e);
    }
  }

  listeners.forEach((listener) => {
    try {
      listener(freshSeed);
    } catch (err) {
      console.error('[mockStore] Listener error:', err);
    }
  });

  console.log('🔄 [mockStore] Demo state reset to initial seed v' + SCHEMA_VERSION);
  return freshSeed;
}

export function subscribeToStore(listener: (state: DemoStoreState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Cross-tab storage synchronization listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === DEMO_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as DemoStoreState;
        if (parsed.version === SCHEMA_VERSION) {
          inMemoryState = parsed;
          listeners.forEach((listener) => listener(parsed));
        }
      } catch (err) {
        console.warn('[mockStore] Failed to sync storage event across tabs:', err);
      }
    }
  });
}

// --------------------------------------------------------------------------
// Unified Agent Route Eligibility and Atomic Request Claim Implementation
// (Used across demo adapter, unit tests, and multi-context Playwright fixture)
// --------------------------------------------------------------------------

export function getAgentAssignedAreas(state: DemoStoreState, agentUserId: string): Set<string> {
  const agentAccount = state.accounts.find((a) => a.user_id === agentUserId);
  if (!agentAccount) return new Set();
  return new Set([
    ...(agentAccount.assigned_area_codes || []),
    ...state.schedules.filter((s) => s.assigned_agent_id === agentUserId).map((s) => s.area_code),
    ...(agentAccount.area_code ? [agentAccount.area_code] : []),
  ]);
}

export function getEligiblePickupRequestsInStore(
  state: DemoStoreState,
  agentUserId: string
): ManualPickupRequestItem[] {
  const assignedAreas = getAgentAssignedAreas(state, agentUserId);
  return state.pickupRequests.filter((r) => assignedAreas.has(r.area_code));
}

export interface ClaimPickupRequestResult {
  status: number;
  data?: ManualPickupRequestItem;
  message?: string;
  errors?: Record<string, unknown>;
}

export function claimPickupRequestInStore(
  requestId: string,
  agentUserId: string
): ClaimPickupRequestResult {
  const state = getStoreState();
  const agentAccount = state.accounts.find((a) => a.user_id === agentUserId);

  if (!agentAccount || agentAccount.role !== 'AGENT') {
    return {
      status: 403,
      message: 'Forbidden: Valid collection agent identity required to claim requests',
      errors: { error_code: 'FORBIDDEN' },
    };
  }

  const target = state.pickupRequests.find((r) => r.id === requestId);
  if (!target) {
    return {
      status: 404,
      message: 'Pickup request not found',
      errors: { error_code: 'NOT_FOUND' },
    };
  }

  // Check the same route eligibility used by the request list
  const assignedAreas = getAgentAssignedAreas(state, agentUserId);
  if (!assignedAreas.has(target.area_code)) {
    return {
      status: 403,
      message: `Pickup request area (Ward ${target.area_code}) is outside agent assigned routes.`,
      errors: { error_code: 'OUTSIDE_ASSIGNED_ROUTE' },
    };
  }

  // An already-claimed request must return 409 and preserve its owner
  if (target.status !== 'PENDING') {
    return {
      status: 409,
      message: `This request has already been claimed by another agent (${target.claimed_by_agent_name || 'claimed'}).`,
      errors: {
        error_code: 'CONFLICT',
        current_status: target.status,
        owner_id: target.claimed_by_agent_id,
      },
    };
  }

  // Atomically change pending request to claimed in one operation
  const updated: ManualPickupRequestItem = {
    ...target,
    status: 'CLAIMED',
    claimed_by_agent_id: agentAccount.user_id,
    claimed_by_agent_name: agentAccount.name,
  };

  setStoreState((prev) => ({
    ...prev,
    pickupRequests: prev.pickupRequests.map((r) => (r.id === requestId ? updated : r)),
  }));

  return {
    status: 200,
    data: updated,
    message: `Successfully claimed request ${requestId}`,
  };
}
