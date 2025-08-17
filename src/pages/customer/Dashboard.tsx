import { History, Share2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { CustomerStats } from '@/components/customer/CustomerStats';
import { ReferralSystem } from '@/components/customer/ReferralSystem';
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
      <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6">
        <div className="mb-3 xs:mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 mb-0.5 xs:mb-1 sm:mb-2">
            My Rewards Dashboard
          </h1>
          <p className="text-xs xs:text-sm sm:text-base text-gray-600">
            Track your coins, referrals, and transaction history
          </p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full space-y-3 xs:space-y-4 sm:space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 mb-3 xs:mb-4 sm:mb-6">
            <TabsTrigger value="overview" className="flex flex-col items-center gap-1 py-2 sm:py-3">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs">Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="referrals"
              className="flex flex-col items-center gap-1 py-2 sm:py-3"
            >
              <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs">Referrals</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col items-center gap-1 py-2 sm:py-3">
              <History className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="space-y-3 xs:space-y-4 sm:space-y-6 pt-1 xs:pt-2"
          >
            <CustomerStats userId={user.id} />
          </TabsContent>

          <TabsContent value="referrals" className="pt-1 xs:pt-2">
            <ReferralSystem userId={user.id} userName={user.name || ''} userMobile={user.mobile} />
          </TabsContent>

          <TabsContent value="history" className="pt-1 xs:pt-2">
            <TransactionHistory userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CustomerDashboard;
