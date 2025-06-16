import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Copy, 
  Users, 
  Gift,
  TrendingUp,
  Star,
  Phone,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface ReferralSystemProps {
  userId: string;
  userName: string;
}

interface Referral {
  id: string;
  name: string;
  mobile: string;
  joinDate: string;
  totalPurchases: number;
  bonusEarned: number;
  status: 'active' | 'inactive';
}

export const ReferralSystem = ({ userId, userName }: ReferralSystemProps) => {
  const [referrals] = useState<Referral[]>([
    {
      id: '1',
      name: 'Rohit Kumar',
      mobile: '9998887776',
      joinDate: '2024-05-15',
      totalPurchases: 2500,
      bonusEarned: 187.5,
      status: 'active'
    },
    {
      id: '2',
      name: 'Kavya Singh',
      mobile: '8887776665',
      joinDate: '2024-04-20',
      totalPurchases: 1800,
      bonusEarned: 135,
      status: 'active'
    },
    {
      id: '3',
      name: 'Arjun Malhotra',
      mobile: '7776665554',
      joinDate: '2024-03-10',
      totalPurchases: 3200,
      bonusEarned: 240,
      status: 'active'
    }
  ]);

  const referralCode = `REF${userId.toUpperCase()}2024`;
  const totalReferrals = referrals.length;
  const totalBonusEarned = referrals.reduce((sum, ref) => sum + ref.bonusEarned, 0);
  const activeReferrals = referrals.filter(ref => ref.status === 'active').length;

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success('Referral code copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy referral code');
    }
  };

  const shareReferralCode = async () => {
    const shareText = `Join ${userName}'s favorite loyalty program and start earning rewards! Use my referral code: ${referralCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Loyalty Rewards Program',
          text: shareText
        });
      } catch (err) {
        // Fallback to copying
        copyReferralCode();
      }
    } else {
      copyReferralCode();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <Share2 className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Referral System</h2>
          <p className="text-gray-600">Invite friends and earn 7.5% on their purchases</p>
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
            <div className="text-xs text-blue-700">{activeReferrals} active members</div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-100 p-2 rounded-full">
                <Gift className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-green-600">Total Bonus Earned</span>
            </div>
            <div className="text-3xl font-bold text-green-900 mb-1">{totalBonusEarned}</div>
            <div className="text-xs text-green-700">Surabhi Coins earned</div>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-purple-100 p-2 rounded-full">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-purple-600">This Month</span>
            </div>
            <div className="text-3xl font-bold text-purple-900 mb-1">87.5</div>
            <div className="text-xs text-purple-700">Bonus coins earned</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Referral Code Card */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-600" />
              Your Referral Code
            </CardTitle>
            <CardDescription>
              Share this code with friends to earn rewards
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-amber-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Your Referral Code</p>
                  <p className="text-2xl font-bold text-purple-900 font-mono">{referralCode}</p>
                </div>
                <Button
                  onClick={copyReferralCode}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
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
                  <p>Share your referral code with friends</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                  <p>They register using your code</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                  <p>You earn 7.5% Surabhi Coins on their purchases</p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={shareReferralCode}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Referral Code
            </Button>
          </CardContent>
        </Card>

        {/* Referral List */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Your Referrals
            </CardTitle>
            <CardDescription>
              Friends you've successfully referred
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {referrals.length > 0 ? (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{referral.name}</h3>
                        <Badge variant={referral.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {referral.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{referral.mobile}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Joined {referral.joinDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{referral.bonusEarned} coins</p>
                      <p className="text-xs text-gray-500">Bonus earned</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No referrals yet</p>
                <p className="text-sm">Start sharing your referral code to earn bonus rewards!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
