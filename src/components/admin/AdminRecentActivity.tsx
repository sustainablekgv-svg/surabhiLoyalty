import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  TrendingUp,
  UserPlus,
  DollarSign,
  Gift,
  ShoppingCart,
  Wallet,
  Filter,
  Loader2,
  Store,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { StorePerformance, ActivityType, StoreType } from '@/types/types';

export const AdminRecentActivity = () => {
  const [filter, setFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch stores first
        const storesQuery = query(collection(db, 'stores'));
        const storesSnapshot = await getDocs(storesQuery);
        const storesData = storesSnapshot.docs.map(doc => ({
          id: doc.id,
          storeName: doc.data().storeName || '',
          storeLocation: doc.data().storeLocation || '',
          storeAddress: doc.data().storeAddress || '',
          storeContactNumber: doc.data().storeContactNumber || '',
          storeCurrentBalance: Number(doc.data().storeCurrentBalance) || 0,
          referralCommission: Number(doc.data().referralCommission) || 0,
          surabhiCommission: Number(doc.data().surabhiCommission) || 0,
          sevaCommission: Number(doc.data().sevaCommission) || 0,
          cashOnlyCommission: Number(doc.data().cashOnlyCommission) || 0,
          storeStatus: doc.data().storeStatus || 'active',
          adminCurrentBalance: Number(doc.data().adminCurrentBalance) || 0,
          adminStoreProfit: Number(doc.data().adminStoreProfit) || 0,
          storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
          storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
        })) as StoreType[];
        setStores(storesData);

        // Initialize store performance data
        const performanceMap: Record<string, StorePerformance> = {};

        storesData.forEach(store => {
          performanceMap[store.storeName] = {
            storeName: store.storeName,
            transactions: 0,
            sales: 0,
            surabhiCoinsUsed: 0,
            walletDeduction: 0,
            cashPayment: 0,
            lastUpdated: Timestamp.fromDate(new Date()),
          };
        });

        setStorePerformance(Object.values(performanceMap));

        // Process initial activities
        await processActivities();
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const processActivities = async () => {
      try {
        // Fetch recent activities
        const activitiesQuery = query(
          collection(db, 'Activity'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);

        // Process activities
        const activitiesData = activitiesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            remarks: data.remarks,
            amount: data.amount,
            customerName: data.customerName,
            customerMobile: data.customerMobile,
            storeLocation: data.storeLocation,
            createdAt: data.createdAt,
          } as ActivityType;
        });

        setActivities(activitiesData);

        // Calculate store performance
        const newPerformanceMap: Record<string, StorePerformance> = {};

        // Initialize performance map with all stores
        stores.forEach(store => {
          newPerformanceMap[store.storeName] = {
            storeName: store.storeName,
            transactions: 0,
            sales: 0,
            surabhiCoinsUsed: 0,
            walletDeduction: 0,
            cashPayment: 0,
            lastUpdated: Timestamp.fromDate(new Date()),
          };
        });

        // Update performance based on activities
        activitiesData.forEach(activity => {
          if (
            (activity.type === 'sale' || activity.type === 'recharge') &&
            activity.storeLocation &&
            activity.amount
          ) {
            if (!newPerformanceMap[activity.storeLocation]) {
              newPerformanceMap[activity.storeLocation] = {
                storeName: activity.storeLocation,
                transactions: 0,
                sales: 0,
                surabhiCoinsUsed: 0,
                walletDeduction: 0,
                cashPayment: 0,
                lastUpdated: Timestamp.fromDate(new Date()),
              };
            }
            newPerformanceMap[activity.storeLocation].transactions += 1;
            newPerformanceMap[activity.storeLocation].sales += activity.amount;
          }
        });

        setStorePerformance(Object.values(newPerformanceMap));
      } catch (error) {
        console.error('Error processing activities:', error);
      }
    };

    // Set up real-time listeners
    const setupListeners = () => {
      // Activities listener
      const activitiesQuery = query(
        collection(db, 'Activity'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const activitiesUnsubscribe = onSnapshot(activitiesQuery, snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const newActivity: ActivityType = {
              id: change.doc.id,
              type: data.type,
              remarks: data.remarks,
              amount: data.amount,
              customerName: data.customerName,
              customerMobile: data.customerMobile,
              storeLocation: data.storeLocation,
              createdAt: data.createdAt,
            };

            // Update activities
            setActivities(prev => [newActivity, ...prev.slice(0, 14)]);

            // Update store performance if it's a transaction
            if (
              (newActivity.type === 'sale' || newActivity.type === 'recharge') &&
              newActivity.storeLocation
            ) {
              setStorePerformance(prev => {
                return prev.map(store => {
                  if (store.storeName === newActivity.storeLocation) {
                    return {
                      ...store,
                      transactions: store.transactions + 1,
                      sales: store.sales + (newActivity.amount || 0),
                      lastUpdated: Timestamp.fromDate(new Date()),
                    };
                  }
                  return store;
                });
              });
            }
          }
        });
      });

      return () => {
        activitiesUnsubscribe();
      };
    };

    fetchInitialData();
    const unsubscribe = setupListeners();

    return () => {
      unsubscribe();
    };
  }, []);

  const formatTimestamp = (firestoreTimestamp: Timestamp) => {
    if (!firestoreTimestamp?.seconds) return 'Just now';

    const date = firestoreTimestamp.toDate();
    const now = new Date();
    const diffInSeconds = Number(((now.getTime() - date.getTime()) / 1000).toFixed(2));

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Number((diffInSeconds / 60).toFixed(2))} minutes ago`;
    if (diffInSeconds < 86400) return `${Number((diffInSeconds / 3600).toFixed(2))} hours ago`;
    return `${Number((diffInSeconds / 86400).toFixed(2))} days ago`;
  };

  const filteredActivities = activities.filter(activity => {
    // Apply type filter
    if (filter !== 'all' && activity.type !== filter) return false;

    // Apply store filter
    if (storeFilter !== 'all' && activity.storeLocation !== storeFilter) return false;

    return true;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'signup':
        return <UserPlus className="h-4 w-4 text-purple-600" />;
      case 'sale':
        return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'recharge':
        return <Wallet className="h-4 w-4 text-amber-600" />;
      case 'referral':
        return <Gift className="h-4 w-4 text-blue-600" />;
      case 'seva_contribution':
        return <DollarSign className="h-4 w-4 text-teal-600" />;
      case 'seva_allocation':
        return <Gift className="h-4 w-4 text-indigo-600" />;
      case 'surabhi_earn':
        return <Gift className="h-4 w-4 text-indigo-600" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'signup':
        return 'bg-purple-50';
      case 'sale':
        return 'bg-green-50';
      case 'recharge':
        return 'bg-amber-50';
      case 'referral':
        return 'bg-blue-50';
      case 'seva_contribution':
        return 'bg-teal-50';
      case 'seva_allocation':
        return 'bg-indigo-50';
      case 'surabhi_earn':
        return 'bg-indigo-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div className="flex flex-col gap-3 xs:gap-4 sm:gap-6 lg:flex-row">
      {/* Recent Activity Section */}
      <Card className="flex-1 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 xs:gap-0">
            <div>
              <CardTitle className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 text-sm xs:text-base sm:text-lg">
                <TrendingUp className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-purple-600" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-[10px] xs:text-xs sm:text-sm">
                Filter and view recent system activities
              </CardDescription>
            </div>

            <div className="flex items-center gap-1 xs:gap-2 w-full xs:w-auto">
              <Filter className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-gray-500" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full xs:w-32 sm:w-40 h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm rounded-[4px] xs:rounded">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="sale">Sales</SelectItem>
                  <SelectItem value="seva_contribution">Seva Contributions</SelectItem>
                  <SelectItem value="seva_allocation">Seva Allocations</SelectItem>
                  <SelectItem value="signup">Signups</SelectItem>
                  <SelectItem value="recharge">Recharges</SelectItem>
                  <SelectItem value="referral">Referrals</SelectItem>
                  <SelectItem value="surabhi_earn">Surabhi Earnings</SelectItem>
                </SelectContent>
              </Select>

              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-full xs:w-32 sm:w-40 h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm rounded-[4px] xs:rounded">
                  <SelectValue placeholder="Filter by store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.storeName}>
                      {store.storeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-24 xs:h-32 sm:h-40">
              <Loader2 className="h-5 w-5 xs:h-6 xs:w-6 sm:h-8 sm:w-8 animate-spin text-gray-500" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-4 xs:py-6 sm:py-8 text-gray-500 text-xs xs:text-sm sm:text-base">
              No activities found for the selected filters
            </div>
          ) : (
            <div className="space-y-2 xs:space-y-3 sm:space-y-4">
              {filteredActivities.map(activity => (
                <div
                  key={activity.id}
                  className={`flex items-center justify-between p-2 xs:p-2.5 sm:p-3 ${getActivityColor(activity.type)} rounded-lg`}
                >
                  <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 overflow-hidden">
                    <div
                      className={`p-1 xs:p-1.5 sm:p-2 rounded-full ${getActivityColor(activity.type).replace('50', '100')}`}
                    >
                      <div className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-medium text-[10px] xs:text-xs sm:text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">
                        {activity.remarks}
                      </p>
                      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[8px] xs:text-[10px] sm:text-xs text-gray-600 flex-wrap">
                        <span className="truncate max-w-[60px] xs:max-w-[80px] sm:max-w-none">
                          {activity.customerName}
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span className="truncate max-w-[60px] xs:max-w-[80px] sm:max-w-none">
                          {activity.storeLocation}
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span>{formatTimestamp(activity.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  {activity.amount !== undefined && (
                    <Badge
                      variant="secondary"
                      className="text-[8px] xs:text-[10px] sm:text-xs px-1 xs:px-1.5 sm:px-2 py-0.5 h-4 xs:h-5 sm:h-6 min-w-[40px] xs:min-w-[50px] text-center"
                    >
                      ₹{activity.amount.toFixed(2)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Performance Section */}
      <Card className="flex-1 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 text-sm xs:text-base sm:text-lg">
                <Store className="h-3 w-3 xs:h-4 xs:w-4 sm:h-5 sm:w-5 text-amber-600" />
                Today's Store Performance
              </CardTitle>
              <CardDescription className="text-[10px] xs:text-xs sm:text-sm">
                Summary of transactions across all stores
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 xs:px-3 sm:px-6 pb-2 xs:pb-3 sm:pb-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {storePerformance.map((store, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 ${
                    index % 2 === 0 ? 'bg-blue-50' : 'bg-purple-50'
                  } rounded-lg`}
                >
                  <div>
                    <p className="font-medium text-sm">{store.storeName}</p>
                    <p className="text-xs text-gray-600">
                      {store.transactions} transaction{store.transactions !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${index % 2 === 0 ? 'text-blue-600' : 'text-purple-600'}`}
                    >
                      ₹{store.sales.toFixed(2)}
                    </p>
                    <div className="flex gap-2 text-xs text-gray-600">
                      <span>Coins: {store.surabhiCoinsUsed.toFixed(2)}</span>
                      <span>Wallet: ₹{store.walletDeduction.toFixed(2)}</span>
                      <span>Cash: ₹{store.cashPayment.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
