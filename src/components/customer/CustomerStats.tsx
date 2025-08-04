import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Wallet, 
  Coins, 
  Heart, 
  TrendingUp, 
  Gift,
  Target,
  Phone,
  User
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CustomerType, ActivityType } from '@/types/types';
import { useAuth } from '@/hooks/auth-context';

interface CustomerStatsProps {
  userId: string;
}

export const CustomerStats = ({ userId }: CustomerStatsProps) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerType | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!userId) return;

      setLoading(true);
      try {
        // Fetch the customer document with the given userId
        const docRef = doc(db, 'customers', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const customer = { id: docSnap.id, ...docSnap.data() } as CustomerType;
          setCustomerData(customer);

          // Only fetch activities if customer has a mobile number
          if (customer.customerMobile) {
            const activitiesQuery = query(
              collection(db, 'Activity'),
              where('customerMobile', '==', customer.customerMobile),
              orderBy('createdAt', 'desc'),
              limit(3)
            );

            const querySnapshot = await getDocs(activitiesQuery);
            const activitiesData = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as ActivityType[];

            setActivities(activitiesData);
          }
        } else {
          setError('No customer data found');
        }
      } catch (err) {
        console.error('Error fetching customer data:', err);
        setError('Failed to fetch customer data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [userId]);

  if (loading) {
    return <div>Loading customer data...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!customerData) {
    return <div>No customer data available</div>;
  }

  // Format member since date
  function formatCreatedAt(createdAt: unknown): string {
    if (createdAt instanceof Timestamp) {
      return createdAt.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  
    if (createdAt instanceof Date) {
      return createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  
    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      return new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  
    return 'N/A';
  }
  
  const memberSince = formatCreatedAt(customerData.createdAt);

  // Calculate referrals count
  const totalReferrals = customerData.referredUsers?.length || 0;

  // Format activity date
  const formatActivityDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get icon for activity type
  const getActivityIcon = (type: ActivityType['type']) => {
    switch (type) {
      case 'recharge':
        return <Wallet className="h-4 w-4 text-green-600" />;
      case 'sale':
        return <Coins className="h-4 w-4 text-blue-600" />;
      case 'referral':
        return <Gift className="h-4 w-4 text-purple-600" />;
      case 'seva_contribution':
        return <Heart className="h-4 w-4 text-red-600" />;
      case 'seva_allocation':
        return <Target className="h-4 w-4 text-amber-600" />;
      case 'surabhi_earn':
        return <Coins className="h-4 w-4 text-amber-600" />;
      case 'signup':
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const stats = [
    {
      title: 'Wallet Balance',
      value: `₹${customerData.walletBalance.toLocaleString()}`,
      description: 'Available for purchases',
      icon: Wallet,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Surabhi Coins',
      value: customerData.surabhiBalance.toLocaleString(),
      description: 'Lifetime coins earned',
      icon: Coins,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'Go Seva Contribution',
      value: `₹${customerData.sevaTotal}`,
      description: 'Community welfare fund',
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Total Referrals',
      value: totalReferrals.toString(),
      description: 'Friends you referred',
      icon: Gift,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Customer Info Card */}
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{customerData.customerName}</h2>
                <p className="text-gray-600">Member since {memberSince}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Your referral number</p>
                <p className="text-lg font-bold">{customerData.customerMobile}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className={`shadow-lg border-0 ${stat.bgColor} ${stat.borderColor} hover:shadow-xl transition-shadow duration-200`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">
                {stat.title}
              </CardTitle>
              <div className="bg-white p-2 rounded-full">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color} mb-1`}>
                {stat.value}
              </div>
              <p className="text-xs text-gray-600">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-full border">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {activity.type === 'recharge' ? 'Wallet Recharge' : 
                           activity.type === 'sale' ? 'Purchase Made' :
                           activity.type === 'referral' ? 'Referral Bonus' :
                           activity.type === 'seva_contribution' ? 'Seva Contribution' :
                           activity.type === 'seva_allocation' ? 'Seva Allocation' :
                           activity.type === 'surabhi_earn' ? 'Surabhi Coins Earned' :
                           'Account Activity'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {activity.createdAt && formatActivityDate(activity.createdAt)} • {activity.storeLocation}
                        </p>
                      </div>
                    </div>
                    {activity.amount && (
                      <span className={`font-bold ${
                        activity.type === 'recharge' || activity.type === 'referral' || activity.type === 'surabhi_earn'
                          ? 'text-green-600' 
                          : 'text-blue-600'
                      }`}>
                        {activity.type === 'recharge' ? `₹${activity.amount}` : 
                         activity.type === 'sale' ? `₹${activity.amount}` :
                         activity.type === 'seva_contribution' ? `₹${activity.amount}` :
                         `${activity.amount} coins`}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No recent activities found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Earning Opportunities
            </CardTitle>
            <CardDescription>
              Ways to earn more rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-amber-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Wallet className="h-4 w-4 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-purple-900">Recharge Wallet</h3>
                </div>
                <p className="text-sm text-purple-700 mb-2">Earn Surabhi Coins on every recharge</p>
                <div className="text-xs text-purple-600">Visit store to recharge</div>
              </div>
              
              <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Phone className="h-4 w-4 text-green-600" />
                  </div>
                  <h3 className="font-medium text-green-900">Refer Friends</h3>
                </div>
                <p className="text-sm text-green-700 mb-2">Earn Referral coins on friend's purchases</p>
                <div className="text-xs text-green-600">Ask friends to use your number when signing up</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};