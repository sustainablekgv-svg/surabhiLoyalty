import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  DollarSign,
  MapPin,
  Calendar,
  TrendingUp,
  Users
} from 'lucide-react';

interface Transaction {
  id: string;
  customerName: string;
  mobile: string;
  storeLocation: string;
  amount: number;
  paymentMethod: 'wallet' | 'cash' | 'mixed';
  surabhiCoinsUsed: number;
  surabhiCoinsEarned: number;
  goSevaContribution: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export const SalesManagement = () => {
  const [transactions] = useState<Transaction[]>([
    {
      id: '1',
      customerName: 'John Doe',
      mobile: '7777777777',
      storeLocation: 'Downtown Branch',
      amount: 2500,
      paymentMethod: 'wallet',
      surabhiCoinsUsed: 100,
      surabhiCoinsEarned: 0,
      goSevaContribution: 62.5,
      timestamp: '2024-01-15T10:30:00Z',
      status: 'completed'
    },
    {
      id: '2',
      customerName: 'Priya Sharma',
      mobile: '6666666666',
      storeLocation: 'Mall Branch',
      amount: 1800,
      paymentMethod: 'cash',
      surabhiCoinsUsed: 0,
      surabhiCoinsEarned: 90,
      goSevaContribution: 45,
      timestamp: '2024-01-15T14:20:00Z',
      status: 'completed'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');

  const storeLocations = [
    'Downtown Branch',
    'Mall Branch', 
    'Airport Branch',
    'Central Plaza'
  ];

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.mobile.includes(searchTerm);
    const matchesStore = filterStore === 'all' || transaction.storeLocation === filterStore;
    const matchesPayment = filterPayment === 'all' || transaction.paymentMethod === filterPayment;
    
    return matchesSearch && matchesStore && matchesPayment;
  });

  const totalStats = {
    totalSales: transactions.reduce((sum, t) => sum + t.amount, 0),
    totalTransactions: transactions.length,
    totalSurabhiCoinsUsed: transactions.reduce((sum, t) => sum + t.surabhiCoinsUsed, 0),
    totalSurabhiCoinsEarned: transactions.reduce((sum, t) => sum + t.surabhiCoinsEarned, 0),
    totalGoSevaContribution: transactions.reduce((sum, t) => sum + t.goSevaContribution, 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Management</h2>
          <p className="text-gray-600">View and manage all sales transactions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Total Sales</span>
            </div>
            <p className="text-xl font-bold text-green-900">₹{totalStats.totalSales.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Transactions</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{totalStats.totalTransactions}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Coins Used</span>
            </div>
            <p className="text-xl font-bold text-amber-900">{totalStats.totalSurabhiCoinsUsed}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Coins Earned</span>
            </div>
            <p className="text-xl font-bold text-purple-900">{totalStats.totalSurabhiCoinsEarned}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-600">Go Seva Pool</span>
            </div>
            <p className="text-xl font-bold text-red-900">₹{totalStats.totalGoSevaContribution.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>Sales Transactions</CardTitle>
              <CardDescription>
                {filteredTransactions.length} transactions found
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {storeLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
                <div className="flex-1 min-w-0 w-full lg:w-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                    <h3 className="font-medium text-gray-900">{transaction.customerName}</h3>
                    <div className="flex gap-2">
                      <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                        {transaction.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {transaction.paymentMethod}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="text-gray-600">
                      <span className="font-medium">Amount:</span> ₹{transaction.amount}
                    </div>
                    <div className="text-amber-600">
                      <span className="font-medium">Coins Used:</span> {transaction.surabhiCoinsUsed}
                    </div>
                    <div className="text-purple-600">
                      <span className="font-medium">Coins Earned:</span> {transaction.surabhiCoinsEarned}
                    </div>
                    <div className="text-red-600">
                      <span className="font-medium">Go Seva:</span> ₹{transaction.goSevaContribution}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{transaction.storeLocation}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(transaction.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
