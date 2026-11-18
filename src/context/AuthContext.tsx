// src/context/AuthContext.tsx
// Authentication context managing session, server-returned role, and 401 expiry listener
// Separates live session (memory-only) from minimal persisted demo session

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserSession, UserRole, AuthLoginRequest, DemoSession } from '../types/contracts';
import { authService } from '../api/authService';
import {
  AUTH_EXPIRED_EVENT,
  DEMO_SESSION_KEY,
  setApiBearerToken,
  clearSessionStorage,
} from '../api/axiosClient';
import { IS_DEMO, USE_MOCK_API } from '../lib/env';

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthLoginRequest) => Promise<UserSession>;
  logout: () => void;
  simulateExpiry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on initial load (Demo mode only honors persisted minimal fake demo session)
  useEffect(() => {
    try {
      if (IS_DEMO && USE_MOCK_API && typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
        if (stored) {
          const session = JSON.parse(stored) as DemoSession;
          // Honor expires_in on restore
          if (session.expires_at && Date.now() < session.expires_at) {
            const remainingSec = Math.round((session.expires_at - Date.now()) / 1000);
            setToken(session.access_token);
            setUser({
              user_id: session.user_id,
              name: session.name,
              username: session.username,
              mobile_number: session.mobile_number,
              role: session.role,
              access_token: session.access_token,
              token_type: 'Bearer',
              expires_in: remainingSec,
            });
            setApiBearerToken(session.access_token, remainingSec);
          } else {
            // Expired on restore
            clearSessionStorage();
            setToken(null);
            setUser(null);
            setApiBearerToken(null);
          }
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Failed to restore session from storage:', e);
      clearSessionStorage();
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
      clearSessionStorage();
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  const login = async (credentials: AuthLoginRequest): Promise<UserSession> => {
    const session = await authService.login(credentials);
    setUser(session);
    setToken(session.access_token);

    if (IS_DEMO && USE_MOCK_API && typeof window !== 'undefined') {
      // In demo mode: persist ONLY the minimal fake demo session with expires_at (no refresh token)
      const minimalSession: DemoSession = {
        user_id: session.user_id,
        name: session.name,
        username: session.username,
        mobile_number: session.mobile_number,
        role: session.role,
        access_token: session.access_token,
        token_type: session.token_type,
        expires_at: Date.now() + (session.expires_in || 3600) * 1000,
      };
      try {
        sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(minimalSession));
      } catch (e) {
        console.warn('[AuthContext] Demo storage write failed:', e);
      }
    }
    // In live mode: live access token is kept in memory only; unused refresh token is discarded

    return session;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
    clearSessionStorage();
  };

  const simulateExpiry = async () => {
    // Keep expiry simulator local to demo
    if (!IS_DEMO || !USE_MOCK_API) {
      console.warn('[AuthContext] Expiry simulator is only available in demo mode.');
      return;
    }
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
