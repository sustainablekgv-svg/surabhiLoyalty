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
  // console.log('THe user data is', user);
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

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 overflow-x-hidden">
      <AdminHeader
        user={{
          id: user.id,
          staffName: user.name || '',
          staffEmail: user.email || '',
          staffMobile: user.mobile || '',
          demoStore: user.demoStore || false,
          role: user.role as 'admin',
          storeLocation: user.storeLocation || '',
          staffPassword: '',
          staffStatus: 'active',
          staffSalesCount: 0,
          staffRechargesCount: 0,
          createdAt: new Date() as any,
        }}
        onLogout={handleLogout}
      />

      <div className="container mx-auto px-2 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6 overflow-x-hidden">
        <div className="mb-3 xs:mb-4 sm:mb-8">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 mb-0.5 xs:mb-1 sm:mb-2">
            Admin Dashboard
          </h1>
          <p className="text-xs xs:text-sm sm:text-base text-gray-600">
            Manage your loyalty program and monitor performance
          </p>
        </div>

        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Navigation */}
            <div className="mb-3 xs:mb-4 sm:mb-8 sticky top-0 z-10 bg-gradient-to-br from-purple-50 via-white to-amber-50 pt-1 pb-2 overflow-x-hidden overflow-y-hidden">
              <TabsList className="grid w-full grid-cols-6 bg-gray-100 p-0.5 rounded-lg overflow-y-hidden">
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
                    className={`flex flex-col items-center gap-0.5 py-1 px-0.5 rounded-md transition-all min-w-0 overflow-y-hidden ${
                      activeTab === tab.value
                        ? 'bg-white shadow-sm text-purple-600 font-medium'
                        : 'text-gray-600 hover:text-purple-500'
                    }`}
                  >
                    <tab.icon className="h-2 w-2 xs:h-2.5 xs:w-2.5 sm:h-4 sm:w-4" />
                    <span className="text-[6px] xs:text-[7px] sm:text-xs md:text-sm truncate w-full text-center leading-tight">
                      {tab.label}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-sm p-2 xs:p-3 sm:p-4 md:p-6 mt-2 xs:mt-3 sm:mt-4 overflow-x-hidden">
              <TabsContent value="overview" className="space-y-4 xs:space-y-5 sm:space-y-6 mt-0">
                <AdminStats />
              </TabsContent>

              <TabsContent value="staff" className="mt-0">
                <StaffManagement />
              </TabsContent>

              <TabsContent value="users" className="mt-0">
                <CustomerManagement />
              </TabsContent>

              <TabsContent value="sales" className="mt-0">
                <SalesManagement />
              </TabsContent>

              <TabsContent value="accounts" className="mt-0">
                <Accounts />
              </TabsContent>

              <TabsContent value="goseva" className="mt-0">
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
