
import { useState } from 'react';
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
  Filter
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'signup' | 'transaction' | 'recharge' | 'referral';
  description: string;
  amount?: number;
  user: string;
  location: string;
  timestamp: string;
}

export const AdminRecentActivity = () => {
  const [filter, setFilter] = useState('all');
  
  const activities: Activity[] = [
    {
      id: '1',
      type: 'signup',
      description: 'New User Registration',
      user: 'John Doe',
      location: 'Downtown Branch',
      timestamp: '5 minutes ago'
    },
    {
      id: '2',
      type: 'recharge',
      description: 'Wallet Recharge',
      amount: 2000,
      user: 'Priya Sharma',
      location: 'Mall Branch',
      timestamp: '12 minutes ago'
    },
    {
      id: '3',
      type: 'transaction',
      description: 'Purchase Transaction',
      amount: 1500,
      user: 'Amit Patel',
      location: 'Downtown Branch',
      timestamp: '18 minutes ago'
    },
    {
      id: '4',
      type: 'referral',
      description: 'Referral Bonus',
      amount: 150,
      user: 'Sneha Singh',
      location: 'Airport Branch',
      timestamp: '25 minutes ago'
    }
  ];

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'signup':
        return <UserPlus className="h-4 w-4 text-purple-600" />;
      case 'transaction':
        return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'recharge':
        return <Wallet className="h-4 w-4 text-amber-600" />;
      case 'referral':
        return <Gift className="h-4 w-4 text-blue-600" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'signup':
        return 'bg-purple-50';
      case 'transaction':
        return 'bg-green-50';
      case 'recharge':
        return 'bg-amber-50';
      case 'referral':
        return 'bg-blue-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
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
                <SelectValue placeholder="Filter activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="signup">User Signups</SelectItem>
                <SelectItem value="transaction">Transactions</SelectItem>
                <SelectItem value="recharge">Recharges</SelectItem>
                <SelectItem value="referral">Referrals</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
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
                  {activity.type === 'referral' ? `${activity.amount} Coins` : `₹${activity.amount}`}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};