// src/api/authService.ts
// Locked Section 3.1 Authentication Service

import { axiosClient, setApiBearerToken, clearSessionStorage } from './axiosClient';
import { AuthLoginRequest, AuthSuccessResponse, AuthSuccessData } from '../types/contracts';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';

export const authService = {
  async login(credentials: AuthLoginRequest): Promise<AuthSuccessData> {
    const response = await axiosClient.post<AuthSuccessResponse>('/api/v1/auth/login', credentials);

    // Validate Section 3.1 auth envelope
    if (response.data && response.data.success && response.data.data) {
      const authData = response.data.data;
      // In live mode: set in-memory token with expiration; discard unused refresh token
      setApiBearerToken(authData.access_token, authData.expires_in);
      return authData;
    }

    throw new Error(response.data?.message || 'Login failed: unexpected envelope');
  },

  async simulateExpire(): Promise<void> {
    // Keep the expiry simulator local to demo mode
    if (!IS_DEMO || !USE_MOCK_API) {
      throw new Error('Session expiry simulation is unavailable in live production mode.');
    }
    await axiosClient.post('/api/v1/auth/simulate-expire');
  },

  logout(): void {
    setApiBearerToken(null);
    clearSessionStorage();
  },
};
