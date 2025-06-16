import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  UserPlus,
  Wallet,
  Activity
} from 'lucide-react';

interface StaffStatsProps {
  storeLocation: string;
}

export const StaffStats = ({ storeLocation }: StaffStatsProps) => {
  const stats = [
    {
      title: 'Store Customers',
      value: '156',
      change: '+8 this week',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: "Today's Recharges",
      value: '₹12,450',
      change: '23 transactions',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'New Registrations',
      value: '8',
      change: 'This week',
      icon: UserPlus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Active Wallets',
      value: '142',
      change: '91% of customers',
      icon: Wallet,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ];

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Wallet Recharge</p>
                    <p className="text-xs text-gray-600">Amit Patel - 2 min ago</p>
                  </div>
                </div>
                <span className="font-bold text-green-600">₹500</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">New Registration</p>
                    <p className="text-xs text-gray-600">Sneha Gupta - 15 min ago</p>
                  </div>
                </div>
                <span className="text-xs text-blue-600 font-medium">New</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Wallet Recharge</p>
                    <p className="text-xs text-gray-600">Rahul Singh - 32 min ago</p>
                  </div>
                </div>
                <span className="font-bold text-purple-600">₹1,200</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Top Customers
            </CardTitle>
            <CardDescription>
              Most active customers this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Amit Patel</p>
                  <p className="text-xs text-gray-600">5 transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-600">₹2,500</p>
                  <p className="text-xs text-gray-600">Total recharge</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Priya Sharma</p>
                  <p className="text-xs text-gray-600">4 transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">₹1,800</p>
                  <p className="text-xs text-gray-600">Total recharge</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Rohit Kumar</p>
                  <p className="text-xs text-gray-600">3 transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">₹1,500</p>
                  <p className="text-xs text-gray-600">Total recharge</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
