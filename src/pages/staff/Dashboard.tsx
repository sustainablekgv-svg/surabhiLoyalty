import {
  History,
  ShoppingCart,
  Store,
  TrendingUp,
  UserPlus,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { SalesManagement } from '@/components/staff/SalesManagement';
import { StaffHeader } from '@/components/staff/StaffHeader';
import { StaffStats } from '@/components/staff/StaffStats';
import StoreAccounts from '@/components/staff/storeAccounts';
import { TransactionsPage } from '@/components/staff/TransactionsPage';
import { UserRegistration } from '@/components/staff/UserRegistration';
import { WalletRecharge } from '@/components/staff/WalletRecharge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth-context';

const StaffDashboard = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/');
      toast.error('Please login to access this page');
      return;
    }
    if (user.role !== 'staff') {
      navigate('/');
      toast.error('Access restricted to staff only');
      return;
    }
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

  if (!user || user.role !== 'staff') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      <StaffHeader user={user} onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.storeLocation || 'Store Dashboard'}
              </h1>
              <p className="text-gray-600">Welcome back, {user?.name || 'Staff Member'}</p>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Navigation */}
            <div className="mb-8">
              <TabsList className="grid w-full grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { value: 'overview', icon: TrendingUp, label: 'Overview' },
                  { value: 'register', icon: UserPlus, label: 'Register' },
                  { value: 'recharge', icon: Wallet, label: 'Wallet' },
                  { value: 'sales', icon: ShoppingCart, label: 'Sales' },
                  { value: 'transactions', icon: History, label: 'Transactions' },
                  { value: 'accounts', icon: WalletCards, label: 'Accounts' },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`flex flex-col items-center gap-0.5 xs:gap-1 py-1 xs:py-1.5 sm:py-2 px-0.5 xs:px-1 sm:px-2 rounded-md transition-all ${
                      activeTab === tab.value
                        ? 'bg-white shadow-sm text-purple-600 font-medium'
                        : 'text-gray-600 hover:text-purple-500'
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                    <span className="text-[10px] xs:text-xs sm:text-sm">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <TabsContent value="overview" className="space-y-6">
                <StaffStats storeLocation={user?.storeLocation || ''} />
              </TabsContent>

              <TabsContent value="register">
                <UserRegistration storeLocation={user?.storeLocation || ''} />
              </TabsContent>

              <TabsContent value="recharge">
                <WalletRecharge storeLocation={user?.storeLocation || ''} />
              </TabsContent>

              <TabsContent value="sales">
                <SalesManagement storeLocation={user?.storeLocation || ''} />
              </TabsContent>

              <TabsContent value="transactions">
                <TransactionsPage storeLocation={user?.storeLocation || ''} />
              </TabsContent>

              <TabsContent value="accounts">
                <StoreAccounts storeLocation={user?.storeLocation || ''} userRole={''} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
