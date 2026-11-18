// src/lib/env.ts
// Environment guard and runtime validation ensuring no demo flags or placeholder URLs leak into production

const isProd = import.meta.env.PROD || import.meta.env.MODE === 'production';

const rawUseMock = import.meta.env.VITE_USE_MOCK_API;
const rawEnableDemoTools = import.meta.env.VITE_ENABLE_DEMO_TOOLS;
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const rawTimezone = import.meta.env.VITE_OPERATIONAL_TIMEZONE || 'Asia/Kolkata';

export const USE_MOCK_API: boolean = rawUseMock === 'true' || rawUseMock === true;
export const ENABLE_DEMO_TOOLS: boolean = rawEnableDemoTools === 'true' || rawEnableDemoTools === true;
export const API_BASE_URL: string = String(rawApiBaseUrl);
export const OPERATIONAL_TIMEZONE: string = String(rawTimezone);
export const APP_MODE: 'demo' | 'production' = (import.meta.env.VITE_APP_MODE as 'demo' | 'production') || (isProd ? 'production' : 'demo');

// Fail-fast guard in production
if (isProd) {
  if (USE_MOCK_API) {
    throw new Error('[SECURITY FATAL] VITE_USE_MOCK_API must NOT be enabled in production mode.');
  }
  if (ENABLE_DEMO_TOOLS) {
    throw new Error('[SECURITY FATAL] VITE_ENABLE_DEMO_TOOLS must NOT be enabled in production mode.');
  }
  if (!API_BASE_URL || API_BASE_URL.includes('example.invalid')) {
    throw new Error(`[CONFIG FATAL] VITE_API_BASE_URL cannot be empty or placeholder in production mode. Received: "${API_BASE_URL}"`);
  }
}
