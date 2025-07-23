import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History, 
  Search, 
  Filter, 
  Wallet,
  Coins,
  Gift,
  Heart,
  Calendar,
  Download,
  TrendingUp,
  User,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';

interface TransactionHistoryProps {
  userId: string;
}

interface Activity {
  id: string;
  type: 'recharge' | 'surabhi_earn' | 'referral_bonus' | 'goseva_contribution' | 'purchase' | 'signup' | 'allocation';
  amount: number;
  description: string;
  date: Timestamp;
  status: 'completed' | 'pending' | 'failed';
  location?: string;
}

export const TransactionHistory = ({ userId }: TransactionHistoryProps) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        // First get the customer document to get their mobile number
        const customerDoc = await getDoc(doc(db, 'customers', userId));
        if (!customerDoc.exists()) {
          throw new Error('Customer not found');
        }
        
        const customerData = customerDoc.data();
        const mobileNumber = customerData.mobile;
        
        // Then query activities collection by mobile number
        const activitiesQuery = query(
          collection(db, 'Activity'),
          where('user', '==', user.mobile),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(activitiesQuery);
        const activitiesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Activity[];
        
        setActivities(activitiesData);
      } catch (err) {
        setError('Failed to fetch activities');
        console.error('Error fetching activities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [userId]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'recharge':
        return <Wallet className="h-5 w-5 text-purple-600" />;
      case 'surabhi_earn':
        return <Coins className="h-5 w-5 text-amber-600" />;
      case 'referral_bonus':
        return <Gift className="h-5 w-5 text-green-600" />;
      case 'goseva_contribution':
        return <Heart className="h-5 w-5 text-red-600" />;
      case 'purchase':
        return <ArrowDown className="h-5 w-5 text-blue-600" />;
      case 'signup':
        return <User className="h-5 w-5 text-indigo-600" />;
      case 'allocation':
        return <ArrowUp className="h-5 w-5 text-teal-600" />;
      default:
        return <History className="h-5 w-5 text-gray-600" />;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'recharge':
        return 'bg-purple-50 text-purple-600';
      case 'surabhi_earn':
        return 'bg-amber-50 text-amber-600';
      case 'referral_bonus':
        return 'bg-green-50 text-green-600';
      case 'goseva_contribution':
        return 'bg-red-50 text-red-600';
      case 'purchase':
        return 'bg-blue-50 text-blue-600';
      case 'signup':
        return 'bg-indigo-50 text-indigo-600';
      case 'allocation':
        return 'bg-teal-50 text-teal-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  const getActivityLabel = (type: Activity['type']) => {
    switch (type) {
      case 'recharge':
        return 'Wallet Recharge';
      case 'surabhi_earn':
        return 'Surabhi Coins';
      case 'referral_bonus':
        return 'Referral Bonus';
      case 'goseva_contribution':
        return 'Go Seva Contribution';
      case 'purchase':
        return 'Purchase';
      case 'signup':
        return 'Signup Bonus';
      case 'allocation':
        return 'Coins Allocation';
      default:
        return 'Activity';
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || activity.type === filterType;
    const matchesStatus = filterStatus === 'all' || activity.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate summary stats
  // const totalRecharges = activities
  //   .filter(a => a.type === 'recharge')
  //   .reduce((sum, a) => sum + a.amount, 0);
  
  // const totalCoinsEarned = activities
  //   .filter(a => a.type === 'surabhi_earn' || a.type === 'referral_bonus' || a.type === 'signup')
  //   .reduce((sum, a) => sum + a.amount, 0);
  
  // const totalGoSevaContribution = activities
  //   .filter(a => a.type === 'goseva_contribution')
  //   .reduce((sum, a) => sum + a.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p className="text-lg font-medium">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <History className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity History</h2>
          <p className="text-gray-600">View all your transactions and activities</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* <Card className="bg-purple-50 border-purple-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-600">Total Recharges</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">₹{totalRecharges.toLocaleString()}</p>
            <p className="text-xs text-purple-700">Lifetime wallet recharges</p>
          </CardContent>
        </Card> */}
        
        {/* <Card className="bg-amber-50 border-amber-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-600">Coins Earned</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{totalCoinsEarned}</p>
            <p className="text-xs text-amber-700">Total Surabhi Coins earned</p>
          </CardContent>
        </Card> */}
        
        {/* <Card className="bg-red-50 border-red-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-600">Go Seva Contribution</span>
            </div>
            <p className="text-2xl font-bold text-red-900">₹{totalGoSevaContribution.toLocaleString()}</p>
            <p className="text-xs text-red-700">Total community contribution</p>
          </CardContent>
        </Card> */}
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>All Activities</CardTitle>
              <CardDescription>
                {filteredActivities.length} activities found
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter by type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="recharge">Wallet Recharge</SelectItem>
                  <SelectItem value="surabhi_earn">Surabhi Coins</SelectItem>
                  <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
                  <SelectItem value="goseva_contribution">Go Seva</SelectItem>
                  <SelectItem value="purchase">Purchases</SelectItem>
                  <SelectItem value="signup">Signup Bonus</SelectItem>
                  <SelectItem value="allocation">Allocations</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => {
                const { date, time } = formatDate(activity.date);
                const isDebit = activity.type === 'goseva_contribution' || activity.type === 'purchase';
                
                return (
                  <div 
                    key={activity.id} 
                    className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-3 rounded-full ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">
                            {getActivityLabel(activity.type)}
                          </h3>
                          <Badge 
                            variant={
                              activity.status === 'completed' ? 'default' : 
                              activity.status === 'pending' ? 'secondary' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {activity.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{activity.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>{date} at {time}</span>
                          {activity.location && (
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {activity.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-bold text-lg ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                        {isDebit ? '-' : '+'}
                        {activity.type === 'recharge' || activity.type === 'goseva_contribution' || activity.type === 'purchase' 
                          ? `₹${activity.amount}` 
                          : `${activity.amount} coins`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isDebit ? 'Debit' : 'Credit'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500">
                <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No activities found</p>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};