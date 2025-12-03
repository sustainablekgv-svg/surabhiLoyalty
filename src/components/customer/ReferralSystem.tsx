import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import {
  Calendar,
  Coins,
  Copy,
  CreditCard,
  Phone,
  RefreshCw,
  Share2,
  Store,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '../ui/badge';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';

interface ReferralSystemProps {
  userMobile: string;
  userName: string;
  userId: string; // Add this new prop
}

interface ReferredCustomer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  walletRechargeDone: boolean;
  saleEligibility: boolean;
  surabhiBalance: number;
  sevaCoinsTotal: number;
  createdAt: any;
  lastTransactionDate: any;
}

export const ReferralSystem = ({ userMobile, userName, userId }: ReferralSystemProps) => {
  const { isLoading: authLoading } = useAuth();
  const [referredCustomers, setReferredCustomers] = useState<ReferredCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralIncome, setReferralIncome] = useState(0);
  const [userData, setUserData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchReferralData = async () => {
    try {
      // Fetch current user data to get referralIncome
      const docRef = doc(db, 'Customers', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const customerData = docSnap.data();
        setUserData(customerData);
        setReferralIncome(customerData.referralSurabhi || 0);

        // Fetch referred customers using the data directly from docSnap
        const referredCustomersQuery = query(
          collection(db, 'Customers'),
          where('referredBy', '==', customerData.customerMobile)
        );
        const referredCustomersSnapshot = await getDocs(referredCustomersQuery);

        const customersData: ReferredCustomer[] = [];
        referredCustomersSnapshot.forEach(doc => {
          const data = doc.data();
          customersData.push({
            name: data.customerName,
            mobile: data.customerMobile,
            email: data.customerEmail,
            storeLocation: data.storeLocation,
            walletBalance: data.walletBalance,
            walletRechargeDone: data.walletRechargeDone,
            saleEligibility: data.saleEligibility,
            surabhiBalance: data.surabhiBalance,
            sevaCoinsTotal: data.sevaCoinsTotal,
            createdAt: data.createdAt,
            lastTransactionDate: data.lastTransactionDate,
          });
        });

        setReferredCustomers(customersData);
      }
    } catch (error) {
      // console.error('Error fetching referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [userId]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setLoading(true);

      // Re-fetch referral data
      await fetchReferralData();

      // Show success message after a brief delay
      setTimeout(() => {
        toast.success('Referral data refreshed successfully');
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      toast.error('Failed to refresh referral data');
      setIsRefreshing(false);
    }
  };

  const totalReferrals = referredCustomers.length;
  // const activeReferrals = referredCustomers.filter(c => c.registered).length;
  // const totalReferralEarnings = referredCustomers.reduce((sum, customer) => {
  //   return sum + (customer.sevaCoinsTotal);
  // }, 0);
  // console.log('The referaals are', referredCustomers);

  const copyReferralNumber = async () => {
    try {
      await navigator.clipboard.writeText(userMobile);
      toast.success('Referral number copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy referral number');
    }
  };

  const shareReferral = async () => {
    const shareText = `Join ${userName}'s network on our loyalty program! Use my referral number ${userMobile} when signing up to get benefits. I've earned ${referralIncome} Surabhi Coins in referral bonuses so far!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Our Rewards Program',
          text: shareText,
        });
      } catch (err) {
        // Fallback to copying
        copyReferralNumber();
      }
    } else {
      copyReferralNumber();
    }
  };

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4 xs:py-6 sm:py-8">
        <div className="animate-spin rounded-full h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 xs:space-y-5 sm:space-y-6">
      <div className="flex items-center justify-between mb-3 xs:mb-4 sm:mb-5">
        <div className="flex items-center gap-1.5 xs:gap-2">
          <div className="bg-green-100 p-1.5 xs:p-2 sm:p-2.5 rounded-full">
            <Share2 className="h-3.5 xs:h-4 sm:h-5 w-3.5 xs:w-4 sm:w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">
              Referral Program
            </h2>
            <p className="text-[10px] xs:text-xs text-gray-600">
              Invite friends and earn on their spendings
              {userData?.demoStore && (
                <Badge className="bg-black text-white text-[6px] ml-2  xs:text-[7px] sm:text-[8px] rounded-full px-1 xs:px-1.5 sm:px-2">
                  Demo Customer
                </Badge>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 xs:gap-4 sm:gap-6">
        <Card className="bg-blue-50 border-blue-200 shadow-lg">
          <CardContent className="p-3 xs:p-4 sm:p-6">
            <div className="flex items-center gap-2 xs:gap-3 mb-2 xs:mb-3">
              <div className="bg-blue-100 p-1 xs:p-1.5 rounded-full">
                <Users className="h-3 w-3 xs:h-4 xs:w-4 text-blue-600" />
              </div>
              <span className="text-xs xs:text-sm font-medium text-blue-600">Total Referrals</span>
            </div>
            <div className="text-xl xs:text-2xl sm:text-3xl font-bold text-blue-900 mb-0.5 xs:mb-1">
              {totalReferrals}
            </div>
            <div className="text-[10px] xs:text-xs text-blue-700">Total referred</div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200 shadow-lg">
          <CardContent className="p-3 xs:p-4 sm:p-6">
            <div className="flex items-center gap-2 xs:gap-3 mb-2 xs:mb-3">
              <div className="bg-amber-100 p-1 xs:p-1.5 rounded-full">
                <Coins className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-amber-600" />
              </div>
              <span className="text-xs xs:text-sm font-medium text-amber-600">Referral Income</span>
            </div>
            <div className="text-xl xs:text-2xl sm:text-3xl font-bold text-amber-900 mb-0.5 xs:mb-1">
              {referralIncome}
            </div>
            <div className="text-[10px] xs:text-xs text-amber-700">Lifetime Referral Surabhi</div>
          </CardContent>
        </Card>

        {/* <Card className="bg-purple-50 border-purple-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-purple-100 p-2 rounded-full">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-purple-600">Potential Earnings</span>
            </div>
            <div className="text-3xl font-bold text-purple-900 mb-1">
              {totalReferralEarnings.toFixed(1)}
            </div>
            <div className="text-xs text-purple-700">From current referrals</div>
          </CardContent>
        </Card> */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xs:gap-5 sm:gap-6">
        {/* Referral Number Card */}
        <Card className="shadow-lg border-0 bg-white overflow-hidden">
          <CardHeader className="px-3 xs:px-4 sm:px-6 pt-3 xs:pt-4 sm:pt-6 pb-1 xs:pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-1 xs:gap-1.5 text-sm xs:text-base sm:text-lg">
              <Phone className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-green-600" />
              Your Referral Number
            </CardTitle>
            <CardDescription className="text-xs xs:text-sm">
              Share your mobile number with friends to earn Surabhi Coins
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 xs:space-y-5 sm:space-y-6 px-3 xs:px-4 sm:px-6 pb-3 xs:pb-4 sm:pb-6">
            <div className="p-2 xs:p-3 sm:p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div className="overflow-x-auto">
                  <p className="text-xs xs:text-sm text-gray-600 mb-0.5 xs:mb-1">
                    Your Referral Number
                  </p>
                  <p className="text-lg xs:text-xl sm:text-2xl font-bold text-green-900 font-mono">
                    {userData?.customerMobile}
                  </p>
                </div>
                <Button
                  onClick={copyReferralNumber}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-600 hover:bg-green-50 h-7 xs:h-8 sm:h-9 w-7 xs:w-8 sm:w-9 p-0"
                >
                  <Copy className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 xs:space-y-3 sm:space-y-4">
              <h3 className="font-medium text-gray-900 text-sm xs:text-base">How it works:</h3>
              <div className="space-y-1.5 xs:space-y-2 text-xs xs:text-sm text-gray-600">
                <div className="flex items-start gap-1.5 xs:gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-4 xs:w-5 h-4 xs:h-5 flex items-center justify-center text-[10px] xs:text-xs font-bold mt-0.5">
                    1
                  </div>
                  <p>Share your mobile number with friends</p>
                </div>
                <div className="flex items-start gap-1.5 xs:gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-4 xs:w-5 h-4 xs:h-5 flex items-center justify-center text-[10px] xs:text-xs font-bold mt-0.5">
                    2
                  </div>
                  <p>Ask them to share at Store during their registration</p>
                </div>
                <div className="flex items-start gap-1.5 xs:gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-4 xs:w-5 h-4 xs:h-5 flex items-center justify-center text-[10px] xs:text-xs font-bold mt-0.5">
                    3
                  </div>
                  <p>
                    You earn Surabhi coins on amount spent by them during
                    sales
                  </p>
                </div>
              </div>
            </div>

            {/* <Button
              onClick={shareReferral}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Referral Number
            </Button> */}
          </CardContent>
        </Card>

        {/* Referred Customers List */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="px-3 xs:px-4 sm:px-6 pt-3 xs:pt-4 sm:pt-6 pb-1 xs:pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-1 xs:gap-1.5 text-sm xs:text-base sm:text-lg">
              <Users className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-blue-600" />
              Your Referred Customers
            </CardTitle>
            <CardDescription className="text-xs xs:text-sm">
              Customers who joined using your referral number
            </CardDescription>
          </CardHeader>

          <CardContent className="px-3 xs:px-4 sm:px-6 pb-3 xs:pb-4 sm:pb-6">
            {referredCustomers.length > 0 ? (
              <div className="space-y-2 xs:space-y-3 sm:space-y-4">
                {referredCustomers.map((customer, index) => (
                  <div
                    key={index}
                    className="p-2 xs:p-3 sm:p-4 border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-1 xs:mb-1.5">
                      <div>
                        <h3 className="font-medium text-gray-900 text-xs xs:text-sm">
                          {customer?.name}
                        </h3>
                        {/* <div className="flex items-center gap-2 mt-1">
                          <Badge variant={customer.walletRechargeDone ? 'default' : 'secondary'} className="text-xs">
                            {customer?.walletRechargeDone ? 'Active' : 'Pending'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {customer?.saleEligibility ? 'Eligible' : 'Not Eligible'}
                          </Badge>
                        </div> */}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 xs:gap-2 text-[10px] xs:text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Phone className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                        <span>{customer?.mobile}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Store className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                        <span>{customer?.storeLocation || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                        <span>Joined {formatDate(customer?.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                        <span>₹{customer?.walletBalance.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                        <span>{(customer?.surabhiBalance || 0).toFixed(2)} coins</span>
                      </div>
                      {/* <div className="flex items-center gap-2">
                        {customer.walletRechargeDone ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span>Recharged</span>
                      </div> */}
                    </div>

                    {customer.lastTransactionDate && (
                      <div className="mt-1 xs:mt-1.5 text-[9px] xs:text-[10px] text-gray-500">
                        Last transaction: {formatDate(customer.lastTransactionDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 xs:py-6 sm:py-8 text-gray-500">
                <Users className="h-8 xs:h-10 sm:h-12 w-8 xs:w-10 sm:w-12 mx-auto mb-2 xs:mb-3 sm:mb-4 text-gray-300" />
                <p className="text-base xs:text-lg font-medium mb-1 xs:mb-1.5 sm:mb-2">
                  No referred customers yet
                </p>
                <p className="text-xs xs:text-sm">
                  Share your mobile number to start earning Surabhi Coins!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
