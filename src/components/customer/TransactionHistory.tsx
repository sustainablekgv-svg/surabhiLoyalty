import { useState } from 'react';
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
  TrendingUp
} from 'lucide-react';

interface TransactionHistoryProps {
  userId: string;
}

interface Transaction {
  id: string;
  type: 'recharge' | 'surabhi_earn' | 'referral_bonus' | 'goseva_contribution';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export const TransactionHistory = ({ userId }: TransactionHistoryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [transactions] = useState<Transaction[]>([
    {
      id: '1',
      type: 'recharge',
      amount: 500,
      description: 'Wallet recharge at Downtown Branch',
      date: '2024-06-15T14:30:00',
      status: 'completed'
    },
    {
      id: '2',
      type: 'surabhi_earn',
      amount: 50,
      description: 'Surabhi Coins earned on wallet recharge',
      date: '2024-06-15T14:30:00',
      status: 'completed'
    },
    {
      id: '3',
      type: 'goseva_contribution',
      amount: 12.5,
      description: 'Go Seva contribution (2.5%)',
      date: '2024-06-15T14:30:00',
      status: 'completed'
    },
    {
      id: '4',
      type: 'referral_bonus',
      amount: 37.5,
      description: 'Referral bonus from Rohit Kumar purchase',
      date: '2024-06-14T10:15:00',
      status: 'completed'
    },
    {
      id: '5',
      type: 'recharge',
      amount: 1000,
      description: 'Wallet recharge at Downtown Branch',
      date: '2024-06-12T16:45:00',
      status: 'completed'
    },
    {
      id: '6',
      type: 'surabhi_earn',
      amount: 100,
      description: 'Surabhi Coins earned on wallet recharge',
      date: '2024-06-12T16:45:00',
      status: 'completed'
    }
  ]);

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'recharge':
        return Wallet;
      case 'surabhi_earn':
        return Coins;
      case 'referral_bonus':
        return Gift;
      case 'goseva_contribution':
        return Heart;
      default:
        return Wallet;
    }
  };

  const getTransactionColor = (type: Transaction['type']) => {
    switch (type) {
      case 'recharge':
        return 'text-purple-600 bg-purple-50';
      case 'surabhi_earn':
        return 'text-amber-600 bg-amber-50';
      case 'referral_bonus':
        return 'text-green-600 bg-green-50';
      case 'goseva_contribution':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTransactionLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'recharge':
        return 'Wallet Recharge';
      case 'surabhi_earn':
        return 'Surabhi Coins';
      case 'referral_bonus':
        return 'Referral Bonus';
      case 'goseva_contribution':
        return 'Go Seva';
      default:
        return 'Transaction';
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || transaction.type === filterType;
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate summary stats
  const totalRecharges = transactions
    .filter(t => t.type === 'recharge')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalCoinsEarned = transactions
    .filter(t => t.type === 'surabhi_earn' || t.type === 'referral_bonus')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalGoSevaContribution = transactions
    .filter(t => t.type === 'goseva_contribution')
    .reduce((sum, t) => sum + t.amount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <History className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600">View all your rewards and transaction history</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-600">Total Recharges</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">₹{totalRecharges.toLocaleString()}</p>
            <p className="text-xs text-purple-700">Lifetime wallet recharges</p>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-600">Coins Earned</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{totalCoinsEarned}</p>
            <p className="text-xs text-amber-700">Total Surabhi Coins earned</p>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-600">Go Seva Contribution</span>
            </div>
            <p className="text-2xl font-bold text-red-900">₹{totalGoSevaContribution}</p>
            <p className="text-xs text-red-700">Total community contribution</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                {filteredTransactions.length} transactions found
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="recharge">Wallet Recharge</SelectItem>
                  <SelectItem value="surabhi_earn">Surabhi Coins</SelectItem>
                  <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
                  <SelectItem value="goseva_contribution">Go Seva</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => {
              const Icon = getTransactionIcon(transaction.type);
              const colorClass = getTransactionColor(transaction.type);
              const { date, time } = formatDate(transaction.date);
              
              return (
                <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-full ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {getTransactionLabel(transaction.type)}
                        </h3>
                        <Badge 
                          variant={transaction.status === 'completed' ? 'default' : 
                                  transaction.status === 'pending' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>{date} at {time}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      transaction.type === 'goseva_contribution' 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>
                      {transaction.type === 'goseva_contribution' ? '-' : '+'}
                      {transaction.type === 'recharge' || transaction.type === 'goseva_contribution' 
                        ? `₹${transaction.amount}` 
                        : `${transaction.amount} coins`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {transaction.type === 'recharge' ? 'Wallet Credit' :
                       transaction.type === 'surabhi_earn' ? 'Coins Earned' :
                       transaction.type === 'referral_bonus' ? 'Bonus Earned' :
                       'Contributed'}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {filteredTransactions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No transactions found</p>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
