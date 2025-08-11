import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Copy, 
  Users, 
  Gift,
  TrendingUp,
  Phone,
  Calendar,
  Wallet,
  Coins,
  CreditCard,
  Store,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';

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

  useEffect(() => {
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
              lastTransactionDate: data.lastTransactionDate
            });
          });

          setReferredCustomers(customersData);
        }
      } catch (error) {
        console.error('Error fetching referral data:', error);
        toast.error('Failed to load referral data');
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, [userId]);

  const totalReferrals = referredCustomers.length;
  // const activeReferrals = referredCustomers.filter(c => c.registered).length;
  // const totalReferralEarnings = referredCustomers.reduce((sum, customer) => {
  //   return sum + (customer.sevaCoinsTotal); 
  // }, 0);
  console.log("The referaals are", referredCustomers)


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
          text: shareText
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
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <Share2 className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Referral Program</h2>
          <p className="text-gray-600">Invite friends and earn on their spendings</p>
        </div>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-blue-600">Total Referrals</span>
            </div>
            <div className="text-3xl font-bold text-blue-900 mb-1">{totalReferrals}</div>
            <div className="text-xs text-blue-700">Total referred</div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-amber-100 p-2 rounded-full">
                <Coins className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-amber-600">Referral Income</span>
            </div>
            <div className="text-3xl font-bold text-amber-900 mb-1">{referralIncome}</div>
            <div className="text-xs text-amber-700">Lifetime Referral Surabhi</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Referral Number Card */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              Your Referral Number
            </CardTitle>
            <CardDescription>
              Share your mobile number with friends to earn Surabhi Coins
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Your Referral Number</p>
                  <p className="text-2xl font-bold text-green-900 font-mono">{userData?.customerMobile}</p>
                </div>
                <Button
                  onClick={copyReferralNumber}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-600 hover:bg-green-50"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">How it works:</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                  <p>Share your mobile number with friends</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                  <p>They register using your number as referral</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                  <p>You earn Surabhi Coins on their purchases</p>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Your Referred Customers
            </CardTitle>
            <CardDescription>
              Customers who joined using your referral number
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {referredCustomers.length > 0 ? (
              <div className="space-y-4">
                {referredCustomers.map((customer, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{customer?.name}</h3>
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
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{customer?.mobile}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        <span>{customer?.storeLocation || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Joined {formatDate(customer?.createdAt)}</span>

                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>₹{customer?.walletBalance.toLocaleString()}</span>
                      </div>
                      {/* <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        <span>{customer?.surabhiBalance?.toLocaleString()} coins</span>
                      </div> */}
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
                      <div className="mt-3 text-xs text-gray-500">
                        Last transaction: {formatDate(customer.lastTransactionDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No referred customers yet</p>
                <p className="text-sm">Share your mobile number to start earning Surabhi Coins!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};