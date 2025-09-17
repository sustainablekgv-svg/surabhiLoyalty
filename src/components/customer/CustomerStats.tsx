import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { Coins, Gift, Heart, Key, Phone, Target, TrendingUp, User, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/auth-context';
import { decryptText } from '@/lib/encryption';
import { db } from '@/lib/firebase';
import { ActivityType, CustomerType } from '@/types/types';
import { Badge } from '../ui/badge';
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
      title: 'Wallet Balance',
      value: `₹${customerData.walletBalance.toFixed(2)}`,
      description: 'Available for purchases at registered store only',
      icon: Wallet,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Surabhi Coins',
      value: customerData.surabhiBalance.toFixed(2),
      description: 'Available for purchases',
      icon: Coins,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Seva Contribution',
      value: `₹${customerData.sevaTotal.toFixed(2)}`,
      description: 'Community welfare fund',
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
  ];

  return (
    <div className="space-y-2 xs:space-y-3 sm:space-y-4">
      {/* Customer Info Card */}
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="p-2 xs:p-3 sm:p-4">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-2 sm:gap-3">
            <div className="flex items-center gap-1 xs:gap-2 sm:gap-3">
              <div className="bg-purple-100 p-1 xs:p-1.5 sm:p-2 rounded-full">
                <User className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm xs:text-base sm:text-lg font-bold break-words">
                  {customerData.customerName}
                </h2>
                <p className="text-[9px] xs:text-[10px] sm:text-xs text-gray-600">
                  Member since {memberSince}
                  {customerData.demoStore && (
                    <Badge className="bg-black text-white text-[6px] ml-2  xs:text-[7px] sm:text-[8px] rounded-full px-1 xs:px-1.5 sm:px-2">
                      Demo Customer
                    </Badge>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 xs:gap-2 sm:gap-3 mt-1 xs:mt-0">
              <div className="bg-blue-100 p-1 xs:p-1.5 sm:p-2 rounded-full">
                <Key className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[9px] xs:text-[10px] sm:text-xs text-gray-600">Your T Pin</p>
                <p className="text-xs xs:text-sm sm:text-base font-bold">
                  {decryptText(customerData.tpin)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 xs:gap-2 sm:gap-3 mt-1 xs:mt-0">
              <div className="bg-blue-100 p-1 xs:p-1.5 sm:p-2 rounded-full">
                <Phone className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[9px] xs:text-[10px] sm:text-xs text-gray-600">
                  Your referral number
                </p>
                <p className="text-xs xs:text-sm sm:text-base font-bold">
                  {customerData.customerMobile}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 xs:gap-2 sm:gap-3">
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
              <div className="p-2 sm:p-3 bg-gradient-to-r from-purple-50 to-amber-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                  <div className="bg-purple-100 p-1 sm:p-1.5 rounded-full">
                    <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-xs sm:text-sm text-purple-900">
                    Recharge Wallet
                  </h3>
                </div>
                <p className="text-[10px] sm:text-xs text-purple-700 mb-1 sm:mb-1.5">
                  Earn Surabhi Coins on every recharge
                </p>
                <div className="text-[9px] sm:text-[10px] text-purple-600">
                  Visit store to recharge
                </div>
              </div>

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
                  Earn surabhi coins on referral recharge and amount spent by referral during sales.
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
                  Earn Seva Coins on every recharge and amount spent during sales
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
