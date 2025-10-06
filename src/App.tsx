import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AnalyticsProvider } from './components/AnalyticsProvider';
// import CreateAdmin from './components/CreateAdmin';
import { ErrorBoundary } from './components/ErrorBoundary';
import AdminDashboard from './pages/admin/Dashboard';
import CustomerDashboard from './pages/customer/Dashboard';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFound from './pages/NotFound';
import StaffDashboard from './pages/staff/Dashboard';

import { ProtectedRoute } from '@/components/protectedRoutes';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/auth-context';

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnalyticsProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                {/* <Route path="/create-admin" element={<CreateAdmin />} /> */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff/dashboard"
                  element={
                    <ProtectedRoute requiredRole="staff">
                      <StaffDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/dashboard"
                  element={
                    <ProtectedRoute requiredRole="customer">
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />
                {/* <Route
                  path="/customer/:mobile"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <CustomerDetails />
                    </ProtectedRoute>
                  }
                /> */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AnalyticsProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
