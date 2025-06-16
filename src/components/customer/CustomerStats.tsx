import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Wallet, 
  Coins, 
  Heart, 
  TrendingUp, 
  Gift,
  Target,
  Star,
  Award
} from 'lucide-react';

interface CustomerStatsProps {
  userId: string;
}

export const CustomerStats = ({ userId }: CustomerStatsProps) => {
  // Mock data - in real app, this would come from API
  const customerData = {
    rechargeWallet: 2500,
    surabhiCoins: 250,
    goSevaContribution: 125,
    totalReferrals: 3,
    memberSince: '2024-01-15',
    loyaltyLevel: 'Silver',
    nextLevelProgress: 65
  };

  const stats = [
    {
      title: 'Recharge Wallet',
      value: `₹${customerData.rechargeWallet.toLocaleString()}`,
      description: 'Available for purchases',
      icon: Wallet,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Surabhi Coins',
      value: customerData.surabhiCoins.toLocaleString(),
      description: '10% earned on recharges',
      icon: Coins,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'Go Seva Contribution',
      value: `₹${customerData.goSevaContribution}`,
      description: 'Community welfare fund',
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Total Referrals',
      value: customerData.totalReferrals.toString(),
      description: 'Friends you referred',
      icon: Gift,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Loyalty Level Card */}
      <Card className="shadow-xl border-0 bg-gradient-to-r from-purple-600 to-amber-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-full">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Loyalty Level: {customerData.loyaltyLevel}</h2>
                <p className="text-purple-100">Member since {customerData.memberSince}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-white/20 px-3 py-1 rounded-full">
                <span className="text-sm font-medium">Next: Gold</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress to Gold Level</span>
              <span>{customerData.nextLevelProgress}%</span>
            </div>
            <Progress value={customerData.nextLevelProgress} className="bg-white/20" />
            <p className="text-xs text-purple-100">₹1,500 more to reach Gold level</p>
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
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Wallet className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Wallet Recharged</p>
                    <p className="text-xs text-gray-600">2 hours ago</p>
                  </div>
                </div>
                <span className="font-bold text-green-600">+₹500</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <Coins className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Surabhi Coins Earned</p>
                    <p className="text-xs text-gray-600">2 hours ago</p>
                  </div>
                </div>
                <span className="font-bold text-amber-600">+50 coins</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Gift className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Referral Bonus</p>
                    <p className="text-xs text-gray-600">1 day ago</p>
                  </div>
                </div>
                <span className="font-bold text-purple-600">+37.5 coins</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
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
                <p className="text-sm text-purple-700 mb-2">Earn 10% Surabhi Coins on every recharge</p>
                <div className="text-xs text-purple-600">Visit store to recharge</div>
              </div>
              
              <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Gift className="h-4 w-4 text-green-600" />
                  </div>
                  <h3 className="font-medium text-green-900">Refer Friends</h3>
                </div>
                <p className="text-sm text-green-700 mb-2">Earn 7.5% on friend's purchases</p>
                <div className="text-xs text-green-600">Share your referral code</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
