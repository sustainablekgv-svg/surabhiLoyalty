import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Wallet, 
  TrendingUp,
  LogOut,
  Store,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { StaffHeader } from '@/components/staff/StaffHeader';
import { StaffStats } from '@/components/staff/StaffStats';
import { UserRegistration } from '@/components/staff/UserRegistration';
import { WalletRecharge } from '@/components/staff/WalletRecharge';
import { StoreUsers } from '@/components/staff/StoreUsers';
import { SalesManagement } from '@/components/staff/SalesManagement';

const StaffDashboard = () => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isInitializing, setIsInitializing] = useState(true);

  // Auto-login for preview if no user is logged in
  useEffect(() => {
    const initializeUser = async () => {
      if (!user) {
        try {
          await login('8888888888', 'password123');
        } catch (error) {
          console.error('Auto-login failed:', error);
        }
      }
      setIsInitializing(false);
    };

    initializeUser();
  }, [user, login]);

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need to be logged in as staff to view this page.</p>
          <Button onClick={() => navigate('/')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      <StaffHeader user={user} onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.storeLocation || 'Store Dashboard'}</h1>
              <p className="text-gray-600">Manage customers and transactions for your store</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-5 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="register" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Register</span>
            </TabsTrigger>
            <TabsTrigger value="recharge" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Recharge</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <StaffStats storeLocation={user.storeLocation || ''} />
          </TabsContent>

          <TabsContent value="register">
            <UserRegistration storeLocation={user.storeLocation || ''} />
          </TabsContent>

          <TabsContent value="recharge">
            <WalletRecharge storeLocation={user.storeLocation || ''} />
          </TabsContent>

          <TabsContent value="sales">
            <SalesManagement storeLocation={user.storeLocation || ''} />
          </TabsContent>

          <TabsContent value="users">
            <StoreUsers storeLocation={user.storeLocation || ''} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StaffDashboard;
