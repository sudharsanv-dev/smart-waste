// src/App.tsx
// Root application component with routing, AuthProvider, and ProtectedRoutes

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { UnifiedLoginPage } from './pages/auth/UnifiedLoginPage';
import { ConsumerRegisterPage } from './pages/auth/ConsumerRegisterPage';
import { ConsumerDashboard } from './pages/consumer/ConsumerDashboard';
import { ConsumerSchedulePage } from './pages/consumer/ConsumerSchedulePage';
import { ConsumerQRPage } from './pages/consumer/ConsumerQRPage';
import { ConsumerPickupRequestsPage } from './pages/consumer/ConsumerPickupRequestsPage';
import { ConsumerPaymentsPage } from './pages/consumer/ConsumerPaymentsPage';
import { ConsumerSupportPage } from './pages/consumer/ConsumerSupportPage';
import { AgentDashboard } from './pages/agent/AgentDashboard';
import { AgentSchedulesPage } from './pages/agent/AgentSchedulesPage';
import { AgentScanQRPage } from './pages/agent/AgentScanQRPage';
import { AgentPickupRequestsPage } from './pages/agent/AgentPickupRequestsPage';
import { AgentFeeHistoryPage } from './pages/agent/AgentFeeHistoryPage';
import { AgentSupportPage } from './pages/agent/AgentSupportPage';
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
      {/* Public Routes */}
      <Route path="/login" element={<UnifiedLoginPage />} />
      <Route path="/register" element={<ConsumerRegisterPage />} />

      {/* Role Protected Consumer Routes (Six Screens) */}
      <Route
        path="/consumer"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer/schedule"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerSchedulePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer/schedules"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerSchedulePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer/qr"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerQRPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer/requests"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerPickupRequestsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer/payments"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerPaymentsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer/support"
        element={
          <ProtectedRoute allowedRoles={['CONSUMER']}>
            <AppShell>
              <ConsumerSupportPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Role Protected Agent Routes */}
      <Route
        path="/agent"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent/schedules"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentSchedulesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent/scan"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentScanQRPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent/requests"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentPickupRequestsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent/payments"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentFeeHistoryPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent/support"
        element={
          <ProtectedRoute allowedRoles={['AGENT']}>
            <AppShell>
              <AgentSupportPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
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
