import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Coins, 
  Heart, 
  TrendingUp, 
  Store, 
  UserPlus,
  DollarSign,
  Gift,
  Loader2
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { Customer } from '@/types/types';
import { AdminRecentActivity } from './AdminRecentActivity'; // Import the activity component

export const AdminStats = () => {
  const [stats, setStats] = useState([
    {
      title: 'Total Users',
      value: '0',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Recharge',
      value: '₹0',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Surabhi Coins',
      value: '0',
      icon: Coins,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Go Seva Pool',
      value: '₹0',
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ]);
  const [loading, setLoading] = useState(true);
  const [storePerformance, setStorePerformance] = useState([
    {
      name: 'Downtown Branch',
      transactions: 0,
      sales: 0
    },
    {
      name: 'Mall Branch',
      transactions: 0,
      sales: 0
    }
  ]);
  const [storeLoading, setStoreLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch customer data
        const customersQuery = await getDocs(collection(db, 'customers'));
        const customers: Customer[] = [];
        customersQuery.forEach((doc) => {
          customers.push(doc.data() as Customer);
        });

        // Fetch sales data for store performance
        const salesQuery = await getDocs(collection(db, 'SalesTransaction'));
        const today = new Date().toISOString().split('T')[0];
        
        const storeStats = {
          'Downtown Branch': { transactions: 0, sales: 0 },
          'Mall Branch': { transactions: 0, sales: 0 }
        };

        salesQuery.forEach(doc => {
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

        // Calculate statistics
        const totalUsers = customers.length;
        const totalRecharge = customers.reduce((sum, customer) => sum + (customer.walletBalance || 0), 0);
        const totalSurabhiCoins = customers.reduce((sum, customer) => sum + (customer.surabhiCoins || 0), 0);
        const totalSevaPool = customers.reduce((sum, customer) => sum + (customer.sevaCoinsCurrentMonth || 0), 0);

        setStats([
          {
            title: 'Total Users',
            value: totalUsers.toLocaleString(),
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
          },
          {
            title: 'Total Recharge',
            value: `₹${totalRecharge.toLocaleString('en-IN')}`,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
          },
          {
            title: 'Surabhi Coins',
            value: totalSurabhiCoins.toLocaleString(),
            icon: Coins,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50'
          },
          {
            title: 'Go Seva Pool',
            value: `₹${totalSevaPool.toLocaleString('en-IN')}`,
            icon: Heart,
            color: 'text-red-600',
            bgColor: 'bg-red-50'
          }
        ]);

        setStorePerformance([
          {
            name: 'Downtown Branch',
            transactions: storeStats['Downtown Branch'].transactions,
            sales: storeStats['Downtown Branch'].sales
          },
          {
            name: 'Mall Branch',
            transactions: storeStats['Mall Branch'].transactions,
            sales: storeStats['Mall Branch'].sales
          }
        ]);

        setLoading(false);
        setStoreLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
        setStoreLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Loading...
                </CardTitle>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  ...
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-amber-600" />
                Store Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section with Store Performance and Recent Activity */}
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminRecentActivity />
      </div>
    </div>
  );
};