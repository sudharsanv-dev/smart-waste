// src/components/layout/ProtectedRoute.tsx
// Route guard enforcing authentication and server-returned role permissions

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/contracts';
import { LoadingSpinner } from './LoadingEmptyError';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner label="Authenticating session..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !role) {
    // Preserve attempted URL for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Cross-role protection: if allowedRoles is specified, role must match
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to user's permitted landing page
    const roleFallbackPath = {
      CONSUMER: '/consumer',
      AGENT: '/agent',
      ADMIN: '/admin',
    }[role];

    return <Navigate to={roleFallbackPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
