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
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { StoreType } from '@/types/types';
interface Activity {
  id: string;
  type: 'signup' | 'transaction' | 'recharge' | 'referral' | 'contribution' | 'allocation';
  description: string;
  amount?: number;
  user: string;
  location: string;
  timestamp: string;
  date?: any;
}

interface StorePerformance {
  name: string;
  transactions: number;
  sales: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
}

export const AdminRecentActivity = () => {
  const [filter, setFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch recent sales transactions
        const salesQuery = query(
          collection(db, 'SalesTransaction'),
          orderBy('date', 'desc'),
          limit(20)
        );
        const salesSnapshot = await getDocs(salesQuery);
        
        // Fetch recent seva transactions
        const sevaQuery = query(
          collection(db, 'SevaTransaction'),
          orderBy('date', 'desc'),
          limit(5)
        );
        const sevaSnapshot = await getDocs(sevaQuery);
        
        // Process sales transactions
        const salesActivities = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'transaction',
            description: `Sale - ${data.paymentMethod === 'cash' ? 'Cash' : 
                         data.paymentMethod === 'wallet' ? 'Wallet' : 'Mixed'} Payment`,
            amount: data.amount,
            user: data.customerName,
            location: data.storeLocation,
            timestamp: formatTimestamp(data.date),
            date: data.date
          } as Activity;
        });
        
        // Process seva transactions
        const sevaActivities = sevaSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type as 'contribution' | 'allocation',
            description: `Seva ${data.type}`,
            amount: data.amount,
            user: data.customerName || 'System',
            location: data.storeLocation || 'N/A',
            timestamp: formatTimestamp(data.date),
            date: data.date
          } as Activity;
        });

        // Calculate store performance
        const today = new Date().toISOString().split('T')[0];
        const performanceMap: Record<string, StorePerformance> = {};

        storesData.forEach(store => {
          performanceMap[store.name] = {
            name: store.name,
            transactions: 0,
            sales: 0,
            surabhiCoinsUsed: 0,
            walletDeduction: 0,
            cashPayment: 0
          };
        });

        salesSnapshot.docs.forEach(doc => {
          const sale = doc.data();
          const saleDate = sale.date?.toDate?.().toISOString().split('T')[0];
          const storeName = sale.storeLocation;
          
          if (performanceMap[storeName]) {
            performanceMap[storeName].transactions++;
            performanceMap[storeName].sales += sale.amount;
            performanceMap[storeName].surabhiCoinsUsed += sale.surabhiCoinsUsed || 0;
            performanceMap[storeName].walletDeduction += sale.walletDeduction || 0;
            performanceMap[storeName].cashPayment += sale.cashPayment || 0;
          }
        });

        setStorePerformance(Object.values(performanceMap));
        
        // Combine and sort all activities by date
        const allActivities = [...salesActivities, ...sevaActivities]
          .sort((a, b) => b.date?.seconds - a.date?.seconds)
          .slice(0, 15); // Get top 15 most recent
        
        setActivities(allActivities);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const formatTimestamp = (firestoreTimestamp: any) => {
    if (!firestoreTimestamp?.seconds) return 'Just now';
    
    const date = new Date(firestoreTimestamp.seconds * 1000);
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
                        <span>{activity.timestamp}</span>
                      </div>
                    </div>
                  </div>
                  {activity.amount && (
                    <Badge variant="secondary">
                      {activity.type === 'contribution' || activity.type === 'allocation' 
                        ? `₹${activity.amount}` 
                        : `₹${activity.amount}`}
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