import { DollarSign, Heart, ShoppingCart, TrendingUp, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Accounts from '@/components/admin/AccountsSection';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminStats } from '@/components/admin/AdminStats';
import { CustomerManagement } from '@/components/admin/CustomerManagement';
import { GoSevaPool } from '@/components/admin/GoSevaPool';
import { SalesManagement } from '@/components/admin/SalesManagement';
import { StaffManagement } from '@/components/admin/StaffManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth-context';

const AdminDashboard = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  console.log('THe user data is', user);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      navigate('/');
      toast.error('Please login to access this page');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      toast.error('Access restricted to admins only');
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

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      <AdminHeader
        user={{
          id: user.id,
          staffName: user.name || '',
          staffEmail: user.email || '',
          staffMobile: user.mobile || '',
          role: user.role as 'admin',
          storeLocation: user.storeLocation || '',
          staffPassword: '',
          staffPin: '',
          staffStatus: 'active',
          staffSalesCount: 0,
          staffRechargesCount: 0,
          createdAt: new Date() as any,
        }}
        onLogout={handleLogout}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            Admin Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage your loyalty program and monitor performance
          </p>
        </div>

        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Navigation */}
            <div className="mb-4 sm:mb-8">
              <TabsList className="grid w-full grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 lg:grid-cols-6 gap-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { value: 'overview', icon: TrendingUp, label: 'Overview' },
                  { value: 'staff', icon: UserPlus, label: 'Staff' },
                  { value: 'users', icon: Users, label: 'Users' },
                  { value: 'sales', icon: ShoppingCart, label: 'Sales' },
                  { value: 'accounts', icon: DollarSign, label: 'Accounts' },
                  { value: 'goseva', icon: Heart, label: 'Seva' },
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
                    <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-[10px] xs:text-xs sm:text-sm">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mt-4">
              <TabsContent value="overview" className="space-y-6">
                <AdminStats />
              </TabsContent>

              <TabsContent value="staff">
                <StaffManagement />
              </TabsContent>

              <TabsContent value="users">
                <CustomerManagement />
              </TabsContent>

              <TabsContent value="sales">
                <SalesManagement />
              </TabsContent>

              <TabsContent value="accounts">
                <Accounts />
              </TabsContent>

              <TabsContent value="goseva">
                <GoSevaPool />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
