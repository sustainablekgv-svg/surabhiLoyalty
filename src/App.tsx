import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AnalyticsProvider } from './components/AnalyticsProvider';
// import CreateAdmin from './components/CreateAdmin';
import { ProtectedRoute } from '@/components/protectedRoutes';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/auth-context';
import { ShopProvider } from '@/hooks/shop-context';
import { CartProvider } from '@/hooks/useCart';
import { WishlistProvider } from '@/hooks/useWishlist';
import { ErrorBoundary } from './components/ErrorBoundary';
import AdminDashboard from './pages/admin/Dashboard';
import CustomerDashboard from './pages/customer/Dashboard';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFound from './pages/NotFound';
import CancellationRefund from './pages/policies/CancellationRefund';
import ContactUs from './pages/policies/ContactUs';
import PrivacyPolicy from './pages/policies/PrivacyPolicy';
import ShippingPolicy from './pages/policies/ShippingPolicy';
import TermsAndConditions from './pages/policies/TermsAndConditions';
import CartPage from './pages/shop/CartPage';
import CheckoutPage from './pages/shop/CheckoutPage';
import ProductDetailsPage from './pages/shop/ProductDetailsPage';
import ShopPage from './pages/shop/ShopPage';
import WishlistPage from './pages/shop/WishlistPage';
import SignupPage from './pages/SignupPage';
import StaffDashboard from './pages/staff/Dashboard';

const queryClient = new QueryClient();

const App = () => {
  // console.log('App Rendering');
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <ShopProvider>
              <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" />
          <BrowserRouter>
            <AnalyticsProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-conditions" element={<TermsAndConditions />} />
                <Route path="/cancellation-refund" element={<CancellationRefund />} />
                <Route path="/shipping-policy" element={<ShippingPolicy />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/shop/product/:id" element={<ProductDetailsPage />} />
                <Route path="/shop/cart" element={<CartPage />} />
                <Route path="/shop/wishlist" element={<WishlistPage />} />
                <Route path="/shop/checkout" element={<CheckoutPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
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
            </ShopProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
