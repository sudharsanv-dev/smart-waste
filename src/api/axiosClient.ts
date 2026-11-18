// src/api/axiosClient.ts
// Axios instance configured with bearer interceptor, 15s timeout, 401 clearance, and consistent errors

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

export function triggerAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

// Memory token storage for interceptor
let inMemoryToken: string | null = null;

export function setApiBearerToken(token: string | null) {
  inMemoryToken = token;
}

export function getApiBearerToken(): string | null {
  return inMemoryToken;
}

// Request Interceptor: Attach Bearer Token
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = inMemoryToken || (typeof window !== 'undefined' ? window.sessionStorage.getItem('smartwaste_token') : null);
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
      // Clear session token immediately
      setApiBearerToken(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('smartwaste_token');
        window.sessionStorage.removeItem('smartwaste_user');
      }
      triggerAuthExpired();
    }

    // Do NOT automatically retry POST/PUT/PATCH/DELETE mutations on failure
    return Promise.reject(error);
  }
);
