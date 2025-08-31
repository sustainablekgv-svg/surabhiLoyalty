import { FileText, History, Share2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { CustomerStats } from '@/components/customer/CustomerStats';
import { ReferralSystem } from '@/components/customer/ReferralSystem';
import { TermsAndConditions } from '@/components/customer/TermsAndConditions';
import { TransactionHistory } from '@/components/customer/TransactionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth-context';

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
      console.error('Logout error:', error);
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
        <div className="mb-2 xs:mb-3 sm:mb-4">
          <h1 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 xs:mb-1">
            My Rewards Dashboard
          </h1>
          <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
            Track your coins, referrals, and transaction history
          </p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full space-y-2 xs:space-y-3 sm:space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4 mb-2 xs:mb-3 sm:mb-4 h-10">
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
            <ReferralSystem userId={user.id} userName={user.name || ''} userMobile={user.mobile} />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <TransactionHistory userId={user.id} />
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
