import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { Coins, DollarSign, Heart, Loader2, Store, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AdminRecentActivity } from './AdminRecentActivity';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { CustomerType, StoreType } from '@/types/types';

export const AdminStats = () => {
  const [sevaPoolAmount, setSevaPoolAmount] = useState<number>(0);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [stats, setStats] = useState([
    {
      title: 'Total Users',
      value: '0',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Wallet Balance ATM',
      value: '₹0',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Surabhi Coins ATM',
      value: '0',
      icon: Coins,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Seva Pool',
      value: '₹0',
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [storePerformance, setStorePerformance] = useState([
    {
      name: 'Downtown Branch',
      transactions: 0,
      sales: 0,
    },
    {
      name: 'Mall Branch',
      transactions: 0,
      sales: 0,
    },
  ]);
  const [storeLoading, setStoreLoading] = useState(true);

  // Separate effect for stores to ensure it loads first
  useEffect(() => {
    const storesQuery = query(collection(db, 'stores'));
    const unsubscribeStores = onSnapshot(
      storesQuery,
      snapshot => {
        const storesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as StoreType[];
        setStores(storesData);
      },
      error => {
        // console.error('Error listening to stores updates:', error);
        toast.error('Failed to load stores data');
      }
    );

    return () => {
      unsubscribeStores();
    };
  }, []);

  // Effect for other data that depends on stores
  useEffect(() => {
    if (stores.length === 0) return; // Wait for stores to load

    setLoading(true);

    // Real-time listener for Seva Pool data
    const poolRef = doc(db, 'SevaPool', 'main');
    const unsubscribeSevaPool = onSnapshot(
      poolRef,
      doc => {
        if (doc.exists()) {
          const data = doc.data();
          setSevaPoolAmount(data.currentSevaBalance);
        }
      },
      error => {
        // console.error('Error listening to SevaPool updates:', error);
        toast.error('Failed to load Seva Pool data');
      }
    );

    // Real-time listener for customers data
    const customersQuery = query(collection(db, 'Customers'));
    const unsubscribeCustomers = onSnapshot(
      customersQuery,
      snapshot => {
        const customers: CustomerType[] = [];
        snapshot.forEach(doc => {
          customers.push(doc.data() as CustomerType);
        });

        // Get demo store locations to exclude from KPIs
        const demoStoreLocations = stores
          .filter(store => store.demoStore === true)
          .map(store => store.storeName);
        // console.log('The demo store locations are', demoStoreLocations);
        // Filter out customers from demo stores for KPI calculations
        // const nonDemoCustomers = customers.filter(customer => customer.demoStore === false);
        // console.log('The non Demo Customers are', nonDemoCustomers);
        // Calculate statistics excluding demo store customers
        const totalUsers = customers.filter(customer => customer.demoStore === false).length;
        const totalWallet = customers
          .filter(customer => customer.demoStore === false)
          .reduce((sum, customer) => sum + (customer.walletBalance || 0), 0);
        const totalSurabhiCoins = customers
          .filter(customer => customer.demoStore === false)
          .reduce((sum, customer) => sum + (customer.surabhiBalance || 0), 0);
        const totalSevaPool = sevaPoolAmount;

        // Update stats cards
        setStats([
          {
            title: 'Total Users',
            value: totalUsers.toString(),
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
          },
          {
            title: 'Total Wallet Balance ATM',
            value: `₹${totalWallet.toFixed(2)}`,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
          },
          {
            title: 'Total Surabhi Coins ATM',
            value: totalSurabhiCoins.toFixed(2),
            icon: Coins,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
          },
          {
            title: 'Seva Pool',
            value: `₹${totalSevaPool.toFixed(2)}`,
            icon: Heart,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
          },
        ]);
        setLoading(false);
      },
      error => {
        // console.error('Error listening to customer updates:', error);
        setLoading(false);
      }
    );

    // Real-time listener for sales data
    const today = new Date().toISOString().split('T')[0];
    const salesQuery = query(collection(db, 'SalesTransaction'));
    const unsubscribeSales = onSnapshot(
      salesQuery,
      snapshot => {
        const storeStats = {
          'Downtown Branch': { transactions: 0, sales: 0 },
          'Mall Branch': { transactions: 0, sales: 0 },
        };

        snapshot.forEach(doc => {
          const sale = doc.data();
          const saleDate = sale.date?.toDate?.().toISOString().split('T')[0];

          if (saleDate === today) {
            if (sale.storeLocation === 'Downtown Branch') {
              storeStats['Downtown Branch'].transactions++;
              storeStats['Downtown Branch'].sales += sale.amount;
            } else if (sale.storeLocation === 'Mall Branch') {
              storeStats['Mall Branch'].transactions++;
              storeStats['Mall Branch'].sales += sale.amount;
            }
          }
        });

        setStorePerformance([
          {
            name: 'Downtown Branch',
            transactions: storeStats['Downtown Branch'].transactions,
            sales: storeStats['Downtown Branch'].sales,
          },
          {
            name: 'Mall Branch',
            transactions: storeStats['Mall Branch'].transactions,
            sales: storeStats['Mall Branch'].sales,
          },
        ]);

        setStoreLoading(false);
      },
      error => {
        // console.error('Error listening to sales updates:', error);
        setStoreLoading(false);
      }
    );

    // Cleanup function to unsubscribe from all listeners when component unmounts
    return () => {
      unsubscribeSevaPool();
      unsubscribeCustomers();
      unsubscribeSales();
    };
  }, [stores, sevaPoolAmount]);

  if (loading) {
    return (
      <div className="space-y-3 xs:space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-3 sm:gap-4 md:gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 xs:pb-1 sm:pb-2 px-2 xs:px-3 sm:px-6 pt-2 xs:pt-3 sm:pt-6">
                <CardTitle className="text-[10px] xs:text-xs sm:text-sm font-medium text-gray-600">
                  Loading...
                </CardTitle>
                <div className={`p-0.5 xs:p-1 sm:p-2 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6 pt-0">
                <div className="text-base xs:text-lg sm:text-2xl font-bold text-gray-900 mb-0 xs:mb-0 sm:mb-1">
                  ...
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
              <CardTitle className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 text-sm xs:text-base sm:text-lg">
                <TrendingUp className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-purple-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6">
              <div className="flex justify-center items-center h-20 xs:h-28 sm:h-40">
                <Loader2 className="h-4 w-4 xs:h-6 xs:w-6 sm:h-8 sm:w-8 animate-spin text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
              <CardTitle className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 text-sm xs:text-base sm:text-lg">
                <Store className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-amber-600" />
                Store Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6">
              <div className="space-y-1.5 xs:space-y-2 sm:space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 xs:h-12 sm:h-16 bg-gray-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-3 sm:gap-4 md:gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-200"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 xs:pb-1 sm:pb-2 px-2 xs:px-3 sm:px-6 pt-2 xs:pt-3 sm:pt-6">
              <CardTitle className="text-[10px] xs:text-xs sm:text-sm font-medium text-gray-600 truncate">
                {stat.title}
              </CardTitle>
              <div className={`p-0.5 xs:p-1 sm:p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6 pt-0">
              <div className="text-base xs:text-lg sm:text-2xl font-bold text-gray-900 mb-0 xs:mb-0 sm:mb-1">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section - Full width cards */}
      <div className="space-y-3 xs:space-y-4 sm:space-y-6">
        {/* Recent Activity - Full width */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm w-full">
          {/* <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
            <CardTitle className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 text-sm xs:text-base sm:text-lg">
              <TrendingUp className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-purple-600" />
              Recent Activity
            </CardTitle>
          </CardHeader> */}
          <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6">
            <AdminRecentActivity />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
