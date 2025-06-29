import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UserPlus, 
  Wallet, 
  TrendingUp,
  Store,
  ShoppingCart,
  Scan,
  Gift,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth-context';
import { StaffHeader } from '@/components/staff/StaffHeader';
import { StaffStats } from '@/components/staff/StaffStats';
import { UserRegistration } from '@/components/staff/UserRegistration';
import { WalletRecharge } from '@/components/staff/WalletRecharge';
import { SalesManagement } from '@/components/staff/SalesManagement';
import { TransactionsPage } from '@/components/staff/TransactionsPage';

const StaffDashboard = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  console.log("the staff info is", user);
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

    if (user.role !== 'staff') {
      // User is not staff
      navigate('/');
      toast.error('Access restricted to staff only');
      return;
    }

    // If we get here, user is authenticated staff
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
  if (!user || user.role !== 'staff') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      <StaffHeader user={user} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 py-6">
        {/* Store Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user?.storeLocation || 'Store Dashboard'}</h1>
              <p className="text-gray-600">Welcome back, {user?.name || 'Staff Member'}</p>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5 mb-6 gap-1">
            <TabsTrigger value="overview" className="flex flex-col items-center gap-1 py-3">
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="register" className="flex flex-col items-center gap-1 py-3">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs">Register</span>
            </TabsTrigger>
            <TabsTrigger value="recharge" className="flex flex-col items-center gap-1 py-3">
              <Wallet className="h-5 w-5" />
              <span className="text-xs">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex flex-col items-center gap-1 py-3">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-xs">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex flex-col items-center gap-1 py-3">
              <History className="h-5 w-5" />
              <span className="text-xs">Transactions</span>
            </TabsTrigger>
          </TabsList>

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
        </Tabs>
      </div>
    </div>
  );
};

export default StaffDashboard;