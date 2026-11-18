// src/api/authService.ts
// Locked Section 3.1 Authentication Service

import { axiosClient, setApiBearerToken, clearSessionStorage } from './axiosClient';
import { AuthLoginRequest, AuthSuccessResponse, AuthSuccessData, UserSession } from '../types/contracts';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';

export const authService = {
  async login(credentials: AuthLoginRequest): Promise<UserSession> {
    const response = await axiosClient.post<AuthSuccessResponse>('/api/v1/auth/login', credentials);

    // Validate Section 3.1 auth envelope
    if (response.data && response.data.success && response.data.data) {
      const wireData: AuthSuccessData = response.data.data;
      // Discard the unused live refresh token at the auth-service boundary
      // Return only the session fields the application actually uses
      const { refresh_token: _unusedRefreshToken, ...appSession } = wireData;
      setApiBearerToken(appSession.access_token, appSession.expires_in);
      return appSession;
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
