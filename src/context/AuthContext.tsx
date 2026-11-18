// src/context/AuthContext.tsx
// Authentication context managing session, server-returned role, and 401 expiry listener

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthSuccessData, UserRole, AuthLoginRequest } from '../types/contracts';
import { authService } from '../api/authService';
import { AUTH_EXPIRED_EVENT, setApiBearerToken } from '../api/axiosClient';

interface AuthContextType {
  user: AuthSuccessData | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthLoginRequest) => Promise<AuthSuccessData>;
  logout: () => void;
  simulateExpiry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'smartwaste_token';
const USER_KEY = 'smartwaste_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthSuccessData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from sessionStorage on initial load
  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem(TOKEN_KEY);
      const storedUser = sessionStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as AuthSuccessData;
        setToken(storedToken);
        setUser(parsedUser);
        setApiBearerToken(storedToken);
      }
    } catch (e) {
      console.warn('[AuthContext] Failed to restore session from storage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for 401 / session expiry events from Axios interceptor
  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn('[AuthContext] 401 Unauthorized / Token Expired received. Clearing session.');
      setUser(null);
      setToken(null);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  const login = async (credentials: AuthLoginRequest): Promise<AuthSuccessData> => {
    const authData = await authService.login(credentials);
    setUser(authData);
    setToken(authData.access_token);
    try {
      sessionStorage.setItem(TOKEN_KEY, authData.access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(authData));
    } catch (e) {
      console.warn('[AuthContext] Storage write failed:', e);
    }
    return authData;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const simulateExpiry = async () => {
    try {
      await authService.simulateExpire();
    } catch {
      // 401 triggers interceptor to clear session
    }
  };

  const value: AuthContextType = {
    user,
    token,
    role: user?.role ?? null,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    simulateExpiry,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
