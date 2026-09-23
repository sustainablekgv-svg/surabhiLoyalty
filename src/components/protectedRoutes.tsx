import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'staff' | 'customer';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isInitialized, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    let loginPath = "/login";
    if (requiredRole === 'admin') {
      loginPath = "/admin/login";
    } else if (requiredRole === 'staff') {
      loginPath = "/shop/login";
    }
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRole && user?.role !== requiredRole) {
    // Admin has access across management routes
    if (user?.role === 'admin' && (requiredRole === 'staff' || requiredRole === 'admin')) {
      return <>{children}</>;
    }
    // Redirect to user's proper role dashboard
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (user?.role === 'staff') {
      return <Navigate to="/staff/dashboard" replace />;
    }
    if (user?.role === 'customer') {
      return <Navigate to="/customer/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
