import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea';
import { 
  Heart, 
  TrendingUp, 
  Calendar, 
  Users,
  DollarSign,
  Gift,
  History,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface GoSevaTransaction {
  id: string;
  type: 'contribution' | 'allocation';
  amount: number;
  description: string;
  date: string;
  userName?: string;
}

export const GoSevaPool = () => {
  const [currentPool, setCurrentPool] = useState(11473);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationDescription, setAllocationDescription] = useState('');
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  
  const [transactions, setTransactions] = useState<GoSevaTransaction[]>([
    {
      id: '1',
      type: 'contribution',
      amount: 125,
      description: 'Wallet recharge contribution',
      date: '2024-06-15',
      userName: 'Amit Patel'
    },
    {
      id: '2',
      type: 'allocation',
      amount: -500,
      description: 'Donated to local charity',
      date: '2024-06-14'
    },
    {
      id: '3',
      type: 'contribution',
      amount: 90,
      description: 'Wallet recharge contribution',
      date: '2024-06-14',
      userName: 'Sneha Singh'
    }
  ]);

  const monthlyStats = {
    totalContributions: 15420,
    totalAllocations: 5000,
    netPool: currentPool,
    contributorCount: 234,
    avgContribution: 65.9
  };

  const handleAllocation = () => {
    const amount = parseFloat(allocationAmount);
    if (!amount || amount <= 0 || amount > currentPool) {
      toast.error('Please enter a valid allocation amount');
      return;
    }

    if (!allocationDescription.trim()) {
      toast.error('Please provide a description for the allocation');
      return;
    }

    const newTransaction: GoSevaTransaction = {
      id: Date.now().toString(),
      type: 'allocation',
      amount: -amount,
      description: allocationDescription,
      date: new Date().toISOString().split('T')[0]
    };

    setTransactions([newTransaction, ...transactions]);
    setCurrentPool(currentPool - amount);
    setAllocationAmount('');
    setAllocationDescription('');
    setIsAllocationDialogOpen(false);
    toast.success(`₹${amount} allocated successfully`);
  };

  const resetMonthlyPool = () => {
    // This would typically reset the pool at the beginning of each month
    toast.success('Monthly pool reset completed');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Seva Pool Management</h2>
          <p className="text-gray-600">Manage community contribution pool and allocations</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600">
                <Gift className="h-4 w-4 mr-2" />
                Allocate Funds
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Allocate Seva Funds</DialogTitle>
                <DialogDescription>
                  Allocate funds from the Seva pool for community welfare
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Available Pool: ₹{currentPool.toLocaleString()}</strong>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Allocation Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={allocationAmount}
                    onChange={(e) => setAllocationAmount(e.target.value)}
                    max={currentPool}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Purpose/Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the allocation purpose"
                    value={allocationDescription}
                    onChange={(e) => setAllocationDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleAllocation} className="flex-1">
                    Allocate Funds
                  </Button>
                  <Button variant="outline" onClick={() => setIsAllocationDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Pool Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-red-50 border-red-200 md:col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-600">Current Pool</span>
            </div>
            <p className="text-2xl font-bold text-red-900">₹{currentPool.toLocaleString()}</p>
            <p className="text-xs text-red-600 mt-1">Available for allocation</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Monthly Contributions</span>
            </div>
            <p className="text-xl font-bold text-green-900">₹{monthlyStats.totalContributions.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Contributors</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{monthlyStats.contributorCount}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Avg Contribution</span>
            </div>
            <p className="text-xl font-bold text-purple-900">₹{monthlyStats.avgContribution}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Total Allocated</span>
            </div>
            <p className="text-xl font-bold text-amber-900">₹{monthlyStats.totalAllocations.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-600" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Latest contributions and allocations
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">June 2024</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    transaction.type === 'contribution' 
                      ? 'bg-green-100' 
                      : 'bg-red-100'
                  }`}>
                    {transaction.type === 'contribution' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <Gift className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {transaction.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{transaction.date}</span>
                      {transaction.userName && (
                        <>
                          <span>•</span>
                          <span>{transaction.userName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-bold ${
                    transaction.amount > 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount).toLocaleString()}
                  </p>
                  <Badge variant={transaction.type === 'contribution' ? 'default' : 'destructive'} className="mt-1">
                    {transaction.type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
