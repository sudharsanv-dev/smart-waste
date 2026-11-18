// src/api/axiosClient.ts
// Axios instance configured with bearer interceptor, 15s timeout, 401 clearance, and consistent errors
// Live access tokens kept in memory; minimal fake demo session persisted only in demo mode

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, IS_DEMO, USE_MOCK_API } from '../lib/env';

// Base API URL: In live mode use API_BASE_URL; in demo mock mode use blank or base
export const baseURL = !IS_DEMO || !USE_MOCK_API ? API_BASE_URL : '';

export const axiosClient = axios.create({
  baseURL,
  timeout: 15000, // 15-second timeout as required by PLAN.md
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
});

// Event emitter target for 401 unauthorized / session expiry events
export const AUTH_EXPIRED_EVENT = 'smartwaste:auth_expired';
export const DEMO_SESSION_KEY = 'smartwaste_demo_session';

export function triggerAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

// In-memory token storage (authoritative for live mode; honored on use)
let inMemoryToken: string | null = null;
let tokenExpiresAt: number | null = null;

export function setApiBearerToken(token: string | null, expiresInSeconds?: number) {
  inMemoryToken = token;
  if (token && typeof expiresInSeconds === 'number') {
    tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  } else if (!token) {
    tokenExpiresAt = null;
  }
}

export function getApiBearerToken(): string | null {
  // Honor expires_in on use
  if (tokenExpiresAt !== null && Date.now() >= tokenExpiresAt) {
    inMemoryToken = null;
    tokenExpiresAt = null;
    triggerAuthExpired();
    return null;
  }
  return inMemoryToken;
}

export function clearSessionStorage() {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      window.sessionStorage.removeItem('smartwaste_token');
      window.sessionStorage.removeItem('smartwaste_user');
    } catch {
      // storage unavailable
    }
  }
}

// Request Interceptor: Attach Bearer Token and validate expiration
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    let token = getApiBearerToken();

    // In demo mode only, restore from demo session storage if in-memory token is absent
    if (!token && IS_DEMO && USE_MOCK_API && typeof window !== 'undefined') {
      try {
        const rawDemo = window.sessionStorage.getItem(DEMO_SESSION_KEY);
        if (rawDemo) {
          const demoSession = JSON.parse(rawDemo);
          if (demoSession?.access_token && demoSession?.expires_at) {
            if (Date.now() < demoSession.expires_at) {
              const remainingSec = Math.round((demoSession.expires_at - Date.now()) / 1000);
              setApiBearerToken(demoSession.access_token, remainingSec);
              token = demoSession.access_token;
            } else {
              // Expired demo session on restore
              clearSessionStorage();
              triggerAuthExpired();
            }
          }
        }
      } catch {
        clearSessionStorage();
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 handling, consistent error format, and no unsafe retries
axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear in-memory token and demo session storage immediately
      setApiBearerToken(null);
      clearSessionStorage();
      triggerAuthExpired();
    }

    // Do NOT automatically retry POST/PUT/PATCH/DELETE mutations on failure
    return Promise.reject(error);
  }
);
