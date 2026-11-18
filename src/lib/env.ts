// src/lib/env.ts
// Environment guard and runtime validation ensuring no demo flags or placeholder URLs leak into production
// The selected Vite mode (import.meta.env.MODE) is strictly authoritative.

const mode = import.meta.env.MODE;
const rawAppMode = import.meta.env.VITE_APP_MODE;

// Selected Vite mode is the authoritative source of truth
export const IS_PRODUCTION: boolean = mode === 'production';
export const IS_DEMO: boolean = !IS_PRODUCTION;
export const APP_MODE: 'demo' | 'production' = IS_PRODUCTION ? 'production' : 'demo';

const rawUseMock = import.meta.env.VITE_USE_MOCK_API;
const rawEnableDemoTools = import.meta.env.VITE_ENABLE_DEMO_TOOLS;
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const rawTimezone = import.meta.env.VITE_OPERATIONAL_TIMEZONE || 'Asia/Kolkata';

// In live production mode, demo features are strictly disabled
export const USE_MOCK_API: boolean = IS_PRODUCTION 
  ? false 
  : (rawUseMock === 'true' || rawUseMock === true || rawUseMock === undefined);

export const ENABLE_DEMO_TOOLS: boolean = IS_PRODUCTION 
  ? false 
  : (rawEnableDemoTools === 'true' || rawEnableDemoTools === true || rawEnableDemoTools === undefined);

export const API_BASE_URL: string = String(rawApiBaseUrl);
export const OPERATIONAL_TIMEZONE: string = String(rawTimezone);

// Fail-fast guard in live production mode
if (IS_PRODUCTION) {
  if (rawAppMode === 'demo') {
    throw new Error('[CONFIG FATAL] Conflicting configuration: VITE_APP_MODE cannot be "demo" in a production build.');
  }
  if (rawUseMock === 'true' || rawUseMock === true) {
    throw new Error('[SECURITY FATAL] VITE_USE_MOCK_API must NOT be enabled in live production mode.');
  }
  if (rawEnableDemoTools === 'true' || rawEnableDemoTools === true) {
    throw new Error('[SECURITY FATAL] VITE_ENABLE_DEMO_TOOLS must NOT be enabled in live production mode.');
  }
  if (!API_BASE_URL || API_BASE_URL.trim() === '' || API_BASE_URL.includes('example.invalid')) {
    throw new Error(`[CONFIG FATAL] VITE_API_BASE_URL cannot be empty or placeholder in live production mode. Received: "${API_BASE_URL}"`);
  }
  try {
    const parsed = new URL(API_BASE_URL);
    if (parsed.protocol !== 'https:') {
      throw new Error(`[CONFIG FATAL] VITE_API_BASE_URL must use HTTPS in live production mode. Received: "${API_BASE_URL}"`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('[CONFIG FATAL]')) {
      throw err;
    }
    throw new Error(`[CONFIG FATAL] VITE_API_BASE_URL is malformed: "${API_BASE_URL}"`);
  }
}
