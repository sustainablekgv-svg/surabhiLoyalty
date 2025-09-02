import { format } from 'date-fns';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Users, DollarSign, TrendingUp, UserPlus, Wallet, Activity, Coins } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { CustomerType, ActivityType, StaffStatsProps } from '@/types/types';
// import { Timestamp } from 'firebase/firestore';

export const StoreStats = ({ storeLocation }: StaffStatsProps) => {
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // Set up real-time listener for customers
    const customersQuery = query(
      collection(db, 'Customers'),
      where('storeLocation', '==', storeLocation),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeCustomers = onSnapshot(
      customersQuery,
      snapshot => {
        const customersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as CustomerType[];
        setCustomers(customersData);
        setLoading(false);
      },
      err => {
        // console.error('Error fetching customers:', err);
        setError('Failed to load customer data');
        setLoading(false);
      }
    );

    // Set up real-time listener for activities
    const activitiesQuery = query(
      collection(db, 'Activity'),
      where('storeLocation', '==', storeLocation),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribeActivities = onSnapshot(
      activitiesQuery,
      snapshot => {
        const activitiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ActivityType[];
        setActivities(activitiesData);
      },
      err => {
        // console.error('Error fetching activities:', err);
        setError('Failed to load activity data');
      }
    );

    // Cleanup function to unsubscribe listeners
    return () => {
      unsubscribeCustomers();
      unsubscribeActivities();
    };
  }, [storeLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  // Stats Calculations
  const totalCustomers = customers.length;
  // const registeredCustomers = customers.filter(c => c.walletRechargeDone).length;
  // const totalWalletBalance = customers.reduce((sum, c) => sum + (c.walletBalance || 0), 0);

  const newCustomersThisWeek = customers.filter(c => {
    const createdAt = c.createdAt?.toDate();
    if (!createdAt) return false;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return createdAt > oneWeekAgo;
  }).length;

  const totalSurabhiCoins = customers.reduce((sum, c) => sum + (c.surabhiBalance || 0), 0);
  const sevaCoinsThisMonth = customers.reduce(
    (sum, c) => sum + (c.sevaBalanceCurrentMonth || 0),
    0
  );

  const topCustomers = [...customers]
    .sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0))
    .slice(0, 3);

  const stats = [
    {
      title: 'Store Customers',
      value: totalCustomers,
      change: `${newCustomersThisWeek} new this week`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    // {
    //   title: "Total Wallet Balance",
    //   value: `₹${totalWalletBalance.toLocaleString()}`,
    //   change: `${registeredCustomers} registered wallets`,
    //   icon: DollarSign,
    //   color: 'text-green-600',
    //   bgColor: 'bg-green-50'
    // },
    {
      title: 'New Registrations',
      value: newCustomersThisWeek,
      change: 'This week',
      icon: UserPlus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Surabhi Coins',
      value: totalSurabhiCoins,
      change: `${sevaCoinsThisMonth} this month`,
      icon: Coins,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-200"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 xs:pb-2">
              <CardTitle className="text-xs xs:text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-1.5 xs:p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-3.5 w-3.5 xs:h-4 xs:w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="pt-1 xs:pt-2">
              <div className="text-xl xs:text-2xl font-bold text-gray-900 mb-0.5 xs:mb-1">
                {stat.value}
              </div>
              <p className="text-[10px] xs:text-xs text-gray-600 flex items-center gap-0.5 xs:gap-1">
                <Activity className="h-2.5 w-2.5 xs:h-3 xs:w-3" />
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xs:gap-4 sm:gap-6">
        {/* Recent Activities */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-2 xs:pb-4">
            <CardTitle className="flex items-center gap-1.5 xs:gap-2 text-base xs:text-lg">
              <TrendingUp className="h-4 w-4 xs:h-5 xs:w-5 text-purple-600" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 xs:pt-2">
            <div className="space-y-2 xs:space-y-4">
              {activities.length > 0 ? (
                activities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2 xs:p-3 bg-green-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 xs:gap-3">
                      <div className="bg-green-100 p-1.5 xs:p-2 rounded-full">
                        <DollarSign className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-xs xs:text-sm truncate max-w-[150px] xs:max-w-[200px]">
                          {activity.remarks}
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-600">
                          <span className="truncate max-w-[80px] xs:max-w-[120px] inline-block align-bottom">
                            {activity.customerName}
                          </span>{' '}
                          • {format(activity.createdAt?.toDate() || new Date(), 'MMM dd, hh:mm a')}
                        </p>
                      </div>
                    </div>
                    {activity.amount > 0 && (
                      <span className="font-bold text-green-600 text-xs xs:text-sm">
                        ₹{activity.amount}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 xs:py-8 text-gray-500 text-xs xs:text-sm">
                  No recent activities found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-2 xs:pb-4">
            <CardTitle className="flex items-center gap-1.5 xs:gap-2 text-base xs:text-lg">
              <Wallet className="h-4 w-4 xs:h-5 xs:w-5 text-amber-600" />
              Top Customers
            </CardTitle>
            <CardDescription className="text-xs xs:text-sm">
              Customers with highest wallet balances
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 xs:pt-2">
            <div className="space-y-2 xs:space-y-4">
              {topCustomers.length > 0 ? (
                topCustomers.map(customer => (
                  <div
                    key={customer.customerMobile}
                    className="flex items-center justify-between p-2 xs:p-3 bg-amber-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-xs xs:text-sm truncate max-w-[150px] xs:max-w-[200px]">
                        {customer.customerName}
                      </p>
                      <p className="text-[10px] xs:text-xs text-gray-600">
                        {customer.customerMobile}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-600 text-xs xs:text-sm">
                        ₹{(customer.walletBalance || 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] xs:text-xs text-gray-600">
                        {customer.surabhiBalance || 0} coins
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 xs:py-8 text-gray-500 text-xs xs:text-sm">
                  No customer data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
