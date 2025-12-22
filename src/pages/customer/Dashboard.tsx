import { Button } from '@/components/ui/button';
import { FileText, History, Home, Settings, Share2, ShoppingBag, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AccountSettings } from '@/components/customer/AccountSettings';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { CustomerStats } from '@/components/customer/CustomerStats';
import { CustomerOrderHistory } from '@/components/customer/OrderHistory';
import { ReferralSystem } from '@/components/customer/ReferralSystem';
import { TermsAndConditions } from '@/components/customer/TermsAndConditions';
import { TransactionHistory } from '@/components/customer/TransactionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth-context';
import { getUserMobile, getUserName } from '@/lib/userUtils';

const CustomerDashboard = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Handle authentication and authorization
  useEffect(() => {
    if (authLoading) {
      // Still loading auth state
      return;
    }

    if (!user) {
      // No user - redirect to login
      navigate('/');
      toast.error('Please login to access this page');
      return;
    }

    if (user.role !== 'customer') {
      // User is not customer
      navigate('/');
      toast.error('Access restricted to customers only');
      return;
    }

    // If we get here, user is authenticated customer
    setIsLoading(false);
  }, [user, authLoading, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      toast.success('Logged out successfully');
    } catch (error) {
      // console.error('Logout error:', error);
      toast.error('Logout failed. Please try again.');
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Final safety check before rendering
  if (!user || user.role !== 'customer') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      <CustomerHeader user={user} onLogout={handleLogout} />
      <div className="container mx-auto px-2 xs:px-3 sm:px-4 lg:px-6 py-2 xs:py-3 sm:py-4">
        <div className="mb-2 xs:mb-3 sm:mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 xs:mb-1">
              My Rewards Dashboard
            </h1>
            <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
              Track your coins, referrals, and transaction history
            </p>
          </div>
          <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" /> Home
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/shop')}>
                <ShoppingBag className="h-4 w-4 mr-2" /> Shop
              </Button>
          </div>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full space-y-2 xs:space-y-3 sm:space-y-4"
        >
          <TabsList className="grid w-full grid-cols-6 mb-2 xs:mb-3 sm:mb-4 h-10">
            <TabsTrigger
              value="overview"
              className="flex items-center justify-center p-2"
              title="Overview"
            >
              <TrendingUp className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger
              value="referrals"
              className="flex items-center justify-center p-2"
              title="Referrals"
            >
              <Share2 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center justify-center p-2"
              title="History"
            >
              <History className="h-4 w-4" />
            </TabsTrigger>
             <TabsTrigger
              value="orders"
              className="flex items-center justify-center p-2"
              title="Orders"
            >
              <ShoppingBag className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center justify-center p-2"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger
              value="terms"
              className="flex items-center justify-center p-2"
              title="Terms"
            >
              <FileText className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 xs:space-y-3 sm:space-y-4 mt-0">
            <CustomerStats userId={user.id} />
          </TabsContent>

          <TabsContent value="referrals" className="mt-0">
            <ReferralSystem userId={user.id} userName={getUserName(user) || ''} userMobile={getUserMobile(user)} />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <TransactionHistory userId={user.id} demoStore={user.demoStore} />
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <CustomerOrderHistory />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <AccountSettings userId={user.id} />
          </TabsContent>

          <TabsContent value="terms" className="mt-0">
            <TermsAndConditions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CustomerDashboard;
