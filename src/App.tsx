// src/App.tsx
// Root application component with routing, AuthProvider, and ProtectedRoutes

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { UnifiedLoginPage } from './pages/auth/UnifiedLoginPage';
import { ConsumerDashboard } from './pages/consumer/ConsumerDashboard';
import { AgentDashboard } from './pages/agent/AgentDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import './api/mockAdapter'; // Auto-register mock adapter if in demo mode

// Default landing redirect based on authentication and role
const RootRedirect: React.FC = () => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  const rolePaths = {
    CONSUMER: '/consumer',
    AGENT: '/agent',
    ADMIN: '/admin',
  };

  return <Navigate to={rolePaths[role] || '/login'} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<UnifiedLoginPage />} />

      {/* Role Protected Consumer Routes */}
      <Route
        path="/consumer/*"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Role Protected Agent Routes */}
      <Route
        path="/agent/*"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Role Protected Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AppShell>
              <AdminDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Root & Fallback */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
