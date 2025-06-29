import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Coins, 
  Heart, 
  TrendingUp, 
  Store, 
  UserPlus,
  DollarSign,
  Gift
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Adjust this import to your firebase config
import { useEffect, useState } from 'react';

interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  createdAt: any;
  role: string;
  walletId: string;
  surabhiCoins: number;
  sevaCoinsTotal: number;
  sevaCoinsCurrentMonth: number;
  referredBy: string | null;
  referralIncome: number | null;
  referredUsers: { mobile: number; referralDate: string; }[] | null;
  registered: boolean;
  lastTransactionDate: string | null;
  customerPassword: string;
  tpin: string;
}

export const AdminStats = () => {
  const [stats, setStats] = useState([
    {
      title: 'Total Users',
      value: '0',
      change: '+0%',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Recharge',
      value: '₹0',
      change: '+0%',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Surabhi Coins',
      value: '0',
      change: '+0%',
      icon: Coins,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Go Seva Pool',
      value: '₹0',
      change: 'Monthly',
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'customers'));
        const customers: Customer[] = [];
        
        querySnapshot.forEach((doc) => {
          customers.push(doc.data() as Customer);
        });

        // Calculate statistics
        const totalUsers = customers.length;
        const totalRecharge = customers.reduce((sum, customer) => sum + (customer.walletBalance || 0), 0);
        const totalSurabhiCoins = customers.reduce((sum, customer) => sum + (customer.surabhiCoins || 0), 0);
        const totalSevaPool = customers.reduce((sum, customer) => sum + (customer.sevaCoinsCurrentMonth || 0), 0);

        // Calculate percentage changes (you might want to store previous values in Firestore for this)
        const userChange = '+12.5%'; // Replace with actual calculation
        const rechargeChange = '+18.2%'; // Replace with actual calculation
        const coinsChange = '+8.7%'; // Replace with actual calculation

        setStats([
          {
            title: 'Total Users',
            value: totalUsers.toLocaleString(),
            change: userChange,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
          },
          {
            title: 'Total Recharge',
            value: `₹${totalRecharge.toLocaleString('en-IN')}`,
            change: rechargeChange,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
          },
          {
            title: 'Surabhi Coins',
            value: totalSurabhiCoins.toLocaleString(),
            change: coinsChange,
            icon: Coins,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50'
          },
          {
            title: 'Go Seva Pool',
            value: `₹${totalSevaPool.toLocaleString('en-IN')}`,
            change: 'Monthly',
            icon: Heart,
            color: 'text-red-600',
            bgColor: 'bg-red-50'
          }
        ]);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching customer data:', error);
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, []);

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              ...
            </p>
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {stat.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};