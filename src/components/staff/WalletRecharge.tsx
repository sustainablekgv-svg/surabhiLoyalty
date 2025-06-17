import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Search, 
  DollarSign, 
  Coins,
  Heart,
  TrendingUp,
  CheckCircle,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface WalletRechargeProps {
  storeLocation: string;
}

interface Customer {
  id: string;
  name: string;
  mobile: string;
  rechargeWallet: number;
  surabhiCoins: number;
  goSevaContribution: number;
}

export const WalletRecharge = ({ storeLocation }: WalletRechargeProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock customer data
  const [customers] = useState<Customer[]>([
    {
      id: '1',
      name: 'Amit Patel',
      mobile: '9876543210',
      rechargeWallet: 2500,
      surabhiCoins: 250,
      goSevaContribution: 125
    },
    {
      id: '2',
      name: 'Sneha Singh',
      mobile: '8765432109',
      rechargeWallet: 1800,
      surabhiCoins: 180,
      goSevaContribution: 90
    },
    {
      id: '3',
      name: 'Rahul Gupta',
      mobile: '7654321098',
      rechargeWallet: 3200,
      surabhiCoins: 320,
      goSevaContribution: 160
    }
  ]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm)
  );

  const handleRecharge = async () => {
    if (!selectedCustomer || !rechargeAmount) {
      toast.error('Please select a customer and enter recharge amount');
      return;
    }

    const amount = parseFloat(rechargeAmount);
    if (amount <= 0 || amount > 50000) {
      toast.error('Please enter a valid amount between ₹1 and ₹50,000');
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Calculate rewards
      const surabhiCoinsEarned = Math.floor(amount * 0.1);
      const goSevaContribution = Math.floor(amount * 0.025);
      
      toast.success(`₹${amount} recharged successfully! Earned ${surabhiCoinsEarned} Surabhi Coins`);
      setRechargeAmount('');
      setSelectedCustomer(null);
      setSearchTerm('');
    } catch (error) {
      toast.error('Recharge failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRewards = (amount: number) => {
    return {
      surabhiCoins: Math.floor(amount * 0.1),
      goSevaContribution: Math.floor(amount * 0.025)
    };
  };

  const rechargeAmountNum = parseFloat(rechargeAmount) || 0;
  const rewards = calculateRewards(rechargeAmountNum);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <Wallet className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wallet Recharge</h2>
          <p className="text-gray-600">Recharge customer wallets at {storeLocation}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Selection */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Select Customer
            </CardTitle>
            <CardDescription>
              Search and select customer for wallet recharge
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or mobile number"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedCustomer?.id === customer.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{customer.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-3 w-3" />
                        <span>{customer.mobile}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
                        ₹{customer.rechargeWallet.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Current Balance</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredCustomers.length === 0 && searchTerm && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No customers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recharge Form */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Recharge Details
            </CardTitle>
            <CardDescription>
              Enter recharge amount and process payment
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {selectedCustomer ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Selected Customer</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <p className="text-sm text-blue-700">{selectedCustomer.mobile}</p>
                    </div>
                    <Badge variant="secondary">
                      ₹{selectedCustomer.rechargeWallet.toLocaleString()}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Recharge Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount (₹1 - ₹50,000)"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="pl-10 h-12"
                      min="1"
                      max="50000"
                    />
                  </div>
                </div>
                
                {rechargeAmountNum > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">Reward Breakdown</h3>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-900">Wallet Balance</span>
                        </div>
                        <span className="font-bold text-purple-600">+₹{rechargeAmountNum.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-900">Surabhi Coins (10%)</span>
                        </div>
                        <span className="font-bold text-amber-600">+{rewards.surabhiCoins}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-900">Seva Pool (2.5%)</span>
                        </div>
                        <span className="font-bold text-red-600">₹{rewards.goSevaContribution}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleRecharge}
                  disabled={isLoading || !rechargeAmount || rechargeAmountNum <= 0}
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                >
                  {isLoading ? (
                    'Processing Recharge...'
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Recharge ₹{rechargeAmountNum.toLocaleString()}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Select a Customer</p>
                <p className="text-sm">Choose a customer from the list to proceed with recharge</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
