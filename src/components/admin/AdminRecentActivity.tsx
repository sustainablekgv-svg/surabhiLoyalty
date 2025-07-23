import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp,
  UserPlus,
  DollarSign,
  Gift,
  ShoppingCart,
  Wallet,
  Filter,
  Loader2,
  Store
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
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
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        })) as StoreType[];
        setStores(storesData);

        // Initialize store performance data
        const performanceMap: Record<string, StorePerformance> = {};

        storesData.forEach(store => {
          performanceMap[store.name] = {
            name: store.name,
            transactions: 0,
            sales: 0,
            surabhiCoinsUsed: 0,
            walletDeduction: 0,
            cashPayment: 0,
            lastUpdated: Timestamp.fromDate(new Date())
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
          orderBy('date', 'desc'),
          limit(20)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        
        // Process activities
        const activitiesData = activitiesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            description: data.description,
            amount: data.amount,
            user: data.user,
            location: data.location,
            date: data.date
          } as ActivityType;
        });

        setActivities(activitiesData);

        // Calculate store performance
        const newPerformanceMap: Record<string, StorePerformance> = {};

        // Initialize performance map with all stores
        stores.forEach(store => {
          newPerformanceMap[store.name] = {
            name: store.name,
            transactions: 0,
            sales: 0,
            surabhiCoinsUsed: 0,
            walletDeduction: 0,
            cashPayment: 0,
            lastUpdated: Timestamp.fromDate(new Date())
          };
        });

        // Update performance based on activities
        activitiesData.forEach(activity => {
          if (activity.type === 'transaction' && activity.location && activity.amount) {
            if (!newPerformanceMap[activity.location]) {
              newPerformanceMap[activity.location] = {
                name: activity.location,
                transactions: 0,
                sales: 0,
                surabhiCoinsUsed: 0,
                walletDeduction: 0,
                cashPayment: 0,
                lastUpdated: Timestamp.fromDate(new Date())
              };
            }
            newPerformanceMap[activity.location].transactions += 1;
            newPerformanceMap[activity.location].sales += activity.amount;
            // Note: You might need additional fields in ActivityType for these values
            // newPerformanceMap[activity.location].surabhiCoinsUsed += activity.coinsUsed || 0;
            // newPerformanceMap[activity.location].walletDeduction += activity.walletDeduction || 0;
            // newPerformanceMap[activity.location].cashPayment += activity.cashPayment || 0;
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
        orderBy('date', 'desc'),
        limit(1)
      );
      const activitiesUnsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const newActivity: ActivityType = {
              id: change.doc.id,
              type: data.type,
              description: data.description,
              amount: data.amount,
              user: data.user,
              location: data.location,
              date: data.date
            };

            // Update activities
            setActivities(prev => [newActivity, ...prev.slice(0, 14)]);

            // Update store performance if it's a transaction
            if (newActivity.type === 'transaction' && newActivity.location) {
              setStorePerformance(prev => {
                return prev.map(store => {
                  if (store.name === newActivity.location) {
                    return {
                      ...store,
                      transactions: store.transactions + 1,
                      sales: store.sales + (newActivity.amount || 0),
                      // Add other fields as needed
                      lastUpdated: Timestamp.fromDate(new Date())
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
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };
  
  const filteredActivities = activities.filter(activity => {
    // Apply type filter
    if (filter !== 'all' && activity.type !== filter) return false;
    
    // Apply store filter
    if (storeFilter !== 'all' && activity.location !== storeFilter) return false;
    
    return true;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'signup': return <UserPlus className="h-4 w-4 text-purple-600" />;
      case 'transaction': return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'recharge': return <Wallet className="h-4 w-4 text-amber-600" />;
      case 'referral': return <Gift className="h-4 w-4 text-blue-600" />;
      case 'contribution': return <DollarSign className="h-4 w-4 text-teal-600" />;
      case 'allocation': return <Gift className="h-4 w-4 text-indigo-600" />;
      default: return <TrendingUp className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'signup': return 'bg-purple-50';
      case 'transaction': return 'bg-green-50';
      case 'recharge': return 'bg-amber-50';
      case 'referral': return 'bg-blue-50';
      case 'contribution': return 'bg-teal-50';
      case 'allocation': return 'bg-indigo-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Recent Activity Section */}
      <Card className="flex-1 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Filter and view recent system activities
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="transaction">Sales</SelectItem>
                  <SelectItem value="contribution">Seva Contributions</SelectItem>
                  <SelectItem value="allocation">Seva Allocations</SelectItem>
                  <SelectItem value="signup">Signups</SelectItem>
                  <SelectItem value="recharge">Recharges</SelectItem>
                  <SelectItem value="referral">Referrals</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.name}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No activities found for the selected filters
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className={`flex items-center justify-between p-3 ${getActivityColor(activity.type)} rounded-lg`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getActivityColor(activity.type).replace('50', '100')}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{activity.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{activity.user}</span>
                        <span>•</span>
                        <span>{activity.location}</span>
                        <span>•</span>
                        <span>{formatTimestamp(activity.date)}</span>
                      </div>
                    </div>
                  </div>
                  {activity.amount !== undefined && (
                    <Badge variant="secondary">
                      ₹{activity.amount}
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-amber-600" />
                Today's Store Performance
              </CardTitle>
              <CardDescription>
                Summary of transactions across all stores
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                    <p className="font-medium text-sm">{store.name}</p>
                    <p className="text-xs text-gray-600">
                      {store.transactions} transaction{store.transactions !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${index % 2 === 0 ? 'text-blue-600' : 'text-purple-600'}`}>
                      ₹{store.sales.toLocaleString('en-IN')}
                    </p>
                    <div className="flex gap-2 text-xs text-gray-600">
                      <span>Coins: {store.surabhiCoinsUsed}</span>
                      <span>Wallet: ₹{store.walletDeduction}</span>
                      <span>Cash: ₹{store.cashPayment}</span>
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