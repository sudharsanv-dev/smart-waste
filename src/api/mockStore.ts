// src/api/mockStore.ts
// Persistent, versioned single-store demo data manager for GreenPulse City
// Supports browser localStorage persistence, cross-tab synchronization, and deterministic reset

import { DemoStoreState, getInitialSeedState, SCHEMA_VERSION } from './mockData';
import { IS_DEMO } from '../lib/env';

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
          inMemoryState = parsed;
          return parsed;
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

  return inMemoryState;
}

export function setStoreState(updater: DemoStoreState | ((prev: DemoStoreState) => DemoStoreState)): DemoStoreState {
  if (!IS_DEMO) {
    throw new Error('[SECURITY FATAL] mockStore cannot be updated in production mode.');
  }

  const prev = getStoreState();
  const next = typeof updater === 'function' ? updater(prev) : updater;
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

export function resetDemoData(): DemoStoreState {
  if (!IS_DEMO) {
    throw new Error('[SECURITY FATAL] Reset Demo Data is disabled in production mode.');
  }

  const freshSeed = getInitialSeedState();
  inMemoryState = freshSeed;

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
