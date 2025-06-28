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

const StaffDashboard = () => {
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
            {/* <TabsTrigger value="scan" className="flex flex-col items-center gap-1 py-3">
              <Scan className="h-5 w-5" />
              <span className="text-xs">Scan</span>
            </TabsTrigger> */}
            <TabsTrigger value="history" className="flex flex-col items-center gap-1 py-3">
              <History className="h-5 w-5" />
              <span className="text-xs">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <StaffStats storeLocation={user?.storeLocation || ''} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-purple-600" />
                    <span>Today's Offers</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">No special offers today. Check back later!</p>
                </CardContent>
              </Card>
            </div>
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

          <TabsContent value="scan">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5 text-purple-600" />
                  <span>Scan Customer QR</span>
                </CardTitle>
                <CardDescription>
                  Scan a customer's QR code to access their profile quickly
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Scan className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">Scanner will appear here</p>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Start Scanning
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-600" />
                  <span>Transaction History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Transaction history will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StaffDashboard;