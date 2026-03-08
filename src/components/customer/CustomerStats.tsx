import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where
} from 'firebase/firestore';
import {
  Coins,
  Gift,
  Heart,
  Phone,
  RefreshCw,
  Target,
  TrendingUp,
  User,
  Wallet
} from 'lucide-react';
import { useEffect, useState } from 'react';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { ActivityType, CustomerType } from '@/types/types';
interface CustomerStatsProps {
  userId: string;
}

export const CustomerStats = ({ userId }: CustomerStatsProps) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerType | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCustomerData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch the customer document with the given userId
      const docRef = doc(db, 'Customers', userId);
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
          const activitiesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as ActivityType[];

          setActivities(activitiesData);
        }
      } else {
        setError('No customer data found');
      }
    } catch (err) {
      // console.error('Error fetching customer data:', err);
      setError('Failed to fetch customer data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [userId]);

  const handleRefreshing = async () => {
    setIsRefreshing(true);
    await fetchCustomerData();
    setIsRefreshing(false);
  };

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
      minute: '2-digit',
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
      title: 'Lifetime Surabhi Coins',
      value: `₹${(customerData.surbhiTotal || 0).toFixed(2)}`,
      description: 'Cumulative Surabhi Coins',
      icon: Wallet,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Current Wallet Balance',
      value: `₹${(customerData.walletBalance || 0).toFixed(2)}`,
      description: 'Your available balance',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Referral Seva Coins',
      value: `₹${(customerData.surabhiReferral || 0).toFixed(2)}`,
      description: 'Coins earned via referrals',
      icon: Target,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    {
      title: 'My Surabhi Rating',
      value: (customerData.surabhiBalance || 0).toString(),
      description: 'Your customer rating',
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    {
      title: 'Total Referrals',
      value: totalReferrals.toString(),
      description: 'Friends you referred',
      icon: Gift,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: 'Shipping Balance',
      value: `₹${(customerData.shippingBalance || 0).toFixed(2)}`,
      description: 'Credits for shipping',
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Refresh Button */}
      <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshing}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-1.5 xs:gap-2 sm:gap-3">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className={`shadow-lg border-0 ${stat.bgColor} ${stat.borderColor} hover:shadow-xl transition-shadow duration-200`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 xs:pb-1 sm:pb-1.5 px-1.5 xs:px-2 sm:px-4 pt-1.5 xs:pt-2 sm:pt-4">
              <CardTitle className="text-[9px] xs:text-[10px] sm:text-xs font-medium text-gray-700">
                {stat.title}
              </CardTitle>
              <div className="bg-white p-0.5 xs:p-1 sm:p-1.5 rounded-full">
                <stat.icon className={`h-2 w-2 xs:h-2.5 xs:w-2.5 sm:h-3 sm:w-3 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="px-1.5 xs:px-2 sm:px-4 pb-1.5 xs:pb-2 sm:pb-4 pt-0">
              <div
                className={`text-sm xs:text-base sm:text-lg font-bold ${stat.color} mb-0.5 xs:mb-0.5 sm:mb-1`}
              >
                {stat.value}
              </div>
              <p className="text-[7px] xs:text-[8px] sm:text-[10px] text-gray-600">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-4 sm:gap-6">
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 sm:py-3">
            <CardTitle className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-xs xs:text-sm sm:text-base">
              <TrendingUp className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 xs:px-3 sm:px-4 pb-2 xs:pb-3 sm:pb-4 pt-0">
            <div className="space-y-1 xs:space-y-2 sm:space-y-3">
              {activities.length > 0 ? (
                activities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-1.5 sm:p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="bg-white p-1 sm:p-1.5 rounded-full border">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[10px] sm:text-xs break-words">
                          {activity.type === 'recharge'
                            ? 'Wallet Recharge'
                            : activity.type === 'sale'
                              ? 'Purchase Made'
                              : activity.type === 'referral'
                                ? 'Referral Bonus'
                                : activity.type === 'seva_contribution'
                                  ? 'Seva Contribution'
                                  : activity.type === 'seva_allocation'
                                    ? 'Seva Allocation'
                                    : activity.type === 'surabhi_earn'
                                      ? 'Surabhi Coins Earned'
                                      : 'Account Activity'}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-gray-600 break-words">
                          {activity.createdAt && formatActivityDate(activity.createdAt)} •{' '}
                          {activity.storeLocation}
                        </p>
                      </div>
                    </div>
                    {activity.amount && (
                      <span
                        className={`text-[10px] sm:text-xs font-bold ${
                          activity.type === 'recharge' ||
                          activity.type === 'referral' ||
                          activity.type === 'surabhi_earn'
                            ? 'text-green-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {activity.remarks}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-2 sm:py-3 text-gray-500 text-xs">
                  No recent activities found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 sm:py-3">
            <CardTitle className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-xs xs:text-sm sm:text-base">
              <Target className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-purple-600" />
              Earning Opportunities
            </CardTitle>
            <CardDescription className="text-[10px] xs:text-xs">
              Ways to earn more rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 xs:px-3 sm:px-4 pb-2 xs:pb-3 sm:pb-4 pt-0">
            <div className="space-y-1.5 xs:space-y-2 sm:space-y-3">
              {/* <div className="p-2 sm:p-3 bg-gradient-to-r from-purple-50 to-amber-50 rounded-lg border border-purple-200"> */}
                {/* <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                  <div className="bg-purple-100 p-1 sm:p-1.5 rounded-full">
                    <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-xs sm:text-sm text-purple-900">
                    Recharge Wallet
                  </h3>
                </div> */}
                {/* <p className="text-[10px] sm:text-xs text-purple-700 mb-1 sm:mb-1.5">
                  Earn Surabhi Coins on every recharge
                </p> */}
                {/* <div className="text-[9px] sm:text-[10px] text-purple-600">
                  Visit store to recharge
                </div> */}
              {/* </div> */}

              <div className="p-2 sm:p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                  <div className="bg-purple-100 p-1 sm:p-1.5 rounded-full">
                    <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600" />
                  </div>
                  <h3 className="font-medium text-xs sm:text-sm text-red-900">Amount Spent</h3>
                </div>
                <p className="text-[10px] sm:text-xs text-blue-700 mb-1 sm:mb-1.5">
                  Earn Surabhi coins on amount spent during sales
                </p>
                <div className="text-[9px] sm:text-[10px] text-blue-600">Shop at the Store</div>
              </div>

              <div className="p-2 sm:p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                  <div className="bg-green-100 p-1 sm:p-1.5 rounded-full">
                    <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
                  </div>
                  <h3 className="font-medium text-xs sm:text-sm text-green-900">Refer Friends</h3>
                </div>
                <p className="text-[10px] sm:text-xs text-green-700 mb-1 sm:mb-1.5">
                  Earn surabhi coins on amount spent by referral during sales.
                </p>
                <div className="text-[9px] sm:text-[10px] text-green-600">
                  Ask friends to use your number when signing up
                </div>
              </div>

              <div className="p-2 sm:p-3 bg-gradient-to-r from-purple-50 to-amber-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                  <div className="bg-purple-100 p-1 sm:p-1.5 rounded-full">
                    <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-xs sm:text-sm text-purple-900">
                    Seva Contribution
                  </h3>
                </div>
                <p className="text-[10px] sm:text-xs text-purple-700 mb-1 sm:mb-1.5">
                  Earn Seva Coins on amount spent during sales
                </p>
                <div className="text-[9px] sm:text-[10px] text-purple-600">Help the Community</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
