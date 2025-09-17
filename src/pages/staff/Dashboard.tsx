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
import StoreAccounts from '@/components/staff/storeAccounts';
import { StoreHeader } from '@/components/staff/StoreHeader';
import { StoreStats } from '@/components/staff/StoreStats';
import { TPINDecryptor } from '@/components/staff/TPINDecryptor';
import { TransactionsPage } from '@/components/staff/TransactionsPage';
import { UserRegistration } from '@/components/staff/UserRegistration';
import { WalletRecharge } from '@/components/staff/WalletRecharge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth-context';

import { db } from '@/lib/firebase';
import { StoreType } from '@/types/types';
import { collection, getDocs, query, where } from 'firebase/firestore';

const StoreDashboard = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [walletEnabled, setWalletEnabled] = useState(false);

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

    const fetchStoreData = async () => {
      try {
        // console.log('User object:', user);
        // console.log('User storeLocation:', user.storeLocation);

        if (user.storeLocation) {
          // Query stores collection for matching location
          const storesQuery = query(
            collection(db, 'stores'),
            where('storeName', '==', user.storeLocation)
          );

          // console.log('Querying stores with location:', user.storeLocation);

          const querySnapshot = await getDocs(storesQuery);
          // console.log('Number of stores found:', querySnapshot.size);

          if (!querySnapshot.empty) {
            // If multiple stores match, you can handle them here
            // querySnapshot.forEach(doc => {
            // console.log(`Store ${doc.id}:`, doc.data());
            // });

            // Use the first store found (or implement your logic for multiple stores)
            const firstStore = querySnapshot.docs[0];
            const storeData = firstStore.data() as StoreType;

            // console.log('Using store:', firstStore.id);
            // console.log('Wallet enabled status:', storeData.walletEnabled);
            setWalletEnabled(storeData.walletEnabled || false);
          } else {
            // console.log('No stores found with location:', user.storeLocation);
            setWalletEnabled(false);
          }
        } else {
          // console.log('No storeLocation found in user object');
          setWalletEnabled(false);
        }
      } catch (error) {
        // console.error('Error fetching store data:', error);
        setWalletEnabled(false);
      }
      setIsLoading(false);
    };

    fetchStoreData();
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

  if (!user || user.role !== 'staff') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 overflow-x-hidden">
      <StoreHeader user={user} onLogout={handleLogout} />
      <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-3 sm:py-6 overflow-x-hidden">
        <div className="mb-3 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {user?.storeLocation || 'Store Dashboard'}
              </h1>
              <p className="text-gray-600">Welcome back, {user?.name || 'Store Member'}</p>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Navigation */}
            <div className="mb-4 sm:mb-6 md:mb-8 overflow-x-hidden overflow-y-hidden">
              <TabsList
                className={`grid w-full grid-cols-${walletEnabled ? 6 : 5} bg-gray-100 p-0.5 rounded-lg overflow-y-hidden`}
              >
                {[
                  { value: 'overview', icon: TrendingUp, label: 'Overview' },
                  { value: 'register', icon: UserPlus, label: 'Register' },
                  { value: 'recharge', icon: Wallet, label: 'Wallet' },
                  { value: 'sales', icon: ShoppingCart, label: 'Sales' },
                  { value: 'transactions', icon: History, label: 'Transactions' },
                  { value: 'accounts', icon: WalletCards, label: 'Accounts' },
                  // { value: 'tpin', icon: Shield, label: 'TPIN' },
                ]
                  .filter(tab => (walletEnabled ? true : tab.value !== 'recharge'))
                  .map(tab => (
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
                      <span className="text-[6px] xs:text-[7px] sm:text-xs truncate w-full text-center leading-tight">
                        {tab.label}
                      </span>
                    </TabsTrigger>
                  ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-sm p-2 xs:p-3 sm:p-6 mt-1 overflow-x-hidden">
              <TabsContent value="overview" className="space-y-4 sm:space-y-6 pt-2">
                <StoreStats
                  storeLocation={user?.storeLocation || ''}
                  demoStore={user?.demoStore || false}
                />
              </TabsContent>

              <TabsContent value="register" className="pt-2">
                <UserRegistration
                  storeLocation={user?.storeLocation || ''}
                  demoStore={user?.demoStore || false}
                />
              </TabsContent>

              <TabsContent value="recharge" className="pt-2">
                <WalletRecharge
                  storeLocation={user?.storeLocation || ''}
                  demoStore={user?.demoStore || false}
                />
              </TabsContent>

              <TabsContent value="sales" className="pt-2">
                <SalesManagement
                  storeLocation={user?.storeLocation || ''}
                  demoStore={user?.demoStore || false}
                />
              </TabsContent>

              <TabsContent value="transactions" className="pt-2">
                <TransactionsPage
                  storeLocation={user?.storeLocation || ''}
                  demoStore={user?.demoStore || false}
                />
              </TabsContent>

              <TabsContent value="accounts" className="pt-2">
                <StoreAccounts storeLocation={user?.storeLocation || ''} userRole={''} demoStore />
              </TabsContent>

              <TabsContent value="tpin" className="pt-2">
                <TPINDecryptor />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StoreDashboard;
