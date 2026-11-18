// src/api/authService.ts
// Locked Section 3.1 Authentication Service

import { axiosClient, setApiBearerToken } from './axiosClient';
import { AuthLoginRequest, AuthSuccessResponse, AuthSuccessData } from '../types/contracts';

export const authService = {
  async login(credentials: AuthLoginRequest): Promise<AuthSuccessData> {
    const response = await axiosClient.post<AuthSuccessResponse>('/api/v1/auth/login', credentials);

    // Validate Section 3.1 auth envelope
    if (response.data && response.data.success && response.data.data) {
      const authData = response.data.data;
      setApiBearerToken(authData.access_token);
      return authData;
    }

    throw new Error(response.data?.message || 'Login failed: unexpected envelope');
  },

  async simulateExpire(): Promise<void> {
    await axiosClient.post('/api/v1/auth/simulate-expire');
  },

  logout(): void {
    setApiBearerToken(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('smartwaste_token');
      window.sessionStorage.removeItem('smartwaste_user');
    }
  },
};
