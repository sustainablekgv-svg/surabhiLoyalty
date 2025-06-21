import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingCart, 
  Search, 
  DollarSign,
  MapPin,
  Calendar,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw,
  Printer,
  Eye
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

export interface Transaction {
  id: string;
  customerName: string;
  mobile: string;
  storeLocation: string;
  amount: number;
  staffInWork: string;
  paymentMethod: 'wallet' | 'cash' | 'mixed';
  surabhiCoinsUsed: number;
  surabhiCoinsEarned: number;
  goSevaContribution: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface StoreType {
  id: string;
  name: string;
  location: string;
  address: string;
  contactNumber: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export const SalesManagement = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch transactions from Firestore
  const fetchTransactions = async () => {
    try {
      const transactionsRef = collection(db, 'transactions');
      const snapshot = await getDocs(transactionsRef);
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
      })) as Transaction[];
      setTransactions(transactionsData);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch stores from Firestore
  const fetchStores = async () => {
    try {
      const storesRef = collection(db, 'stores');
      const snapshot = await getDocs(storesRef);
      const storesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as StoreType[];
      // Only include active stores in the filter options
      setStores(storesData.filter(store => store.status === 'active'));
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to load store locations');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTransactions(), fetchStores()]);
    };
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.mobile.includes(searchTerm);
    const matchesStore = filterStore === 'all' || transaction.storeLocation === filterStore;
    const matchesPayment = filterPayment === 'all' || transaction.paymentMethod === filterPayment;
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    
    return matchesSearch && matchesStore && matchesPayment && matchesStatus;
  });

  const totalStats = {
    totalSales: transactions.reduce((sum, t) => sum + t.amount, 0),
    totalTransactions: transactions.length,
    totalSurabhiCoinsUsed: transactions.reduce((sum, t) => sum + (t.surabhiCoinsUsed || 0), 0),
    totalSurabhiCoinsEarned: transactions.reduce((sum, t) => sum + (t.surabhiCoinsEarned || 0), 0),
    totalGoSevaContribution: transactions.reduce((sum, t) => sum + (t.goSevaContribution || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Management</h2>
          <p className="text-gray-600">View and manage all sales transactions</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
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
                {(searchTerm || filterStore !== 'all' || filterPayment !== 'all' || filterStatus !== 'all') && 
                  ' (filtered)'}
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
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.name}>
                      {store.name} ({store.location})
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

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
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
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <Search className="h-8 w-8" />
              <p>No transactions found</p>
              {(searchTerm || filterStore !== 'all' || filterPayment !== 'all' || filterStatus !== 'all') && (
                <Button variant="ghost" onClick={() => {
                  setSearchTerm('');
                  setFilterStore('all');
                  setFilterPayment('all');
                  setFilterStatus('all');
                }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => {
                const store = stores.find(s => s.name === transaction.storeLocation);
                
                return (
                  <div key={transaction.id} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4 hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0 w-full lg:w-auto">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                        <h3 className="font-medium text-gray-900">{transaction.customerName}</h3>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant={
                            transaction.status === 'completed' ? 'default' : 
                            transaction.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {transaction.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {transaction.paymentMethod}
                          </Badge>
                          {transaction.staffInWork && (
                            <Badge variant="outline" className="text-xs">
                              Staff: {transaction.staffInWork}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="text-gray-600">
                          <span className="font-medium">Amount:</span> ₹{transaction.amount}
                        </div>
                        <div className="text-amber-600">
                          <span className="font-medium">Coins Used:</span> {transaction.surabhiCoinsUsed || 0}
                        </div>
                        <div className="text-purple-600">
                          <span className="font-medium">Coins Earned:</span> {transaction.surabhiCoinsEarned || 0}
                        </div>
                        <div className="text-red-600">
                          <span className="font-medium">Go Seva:</span> ₹{transaction.goSevaContribution || 0}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {transaction.storeLocation}
                            {store && ` (${store.location})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(transaction.timestamp), 'dd MMM yyyy, hh:mm a')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full lg:w-auto">
                      <Button variant="outline" size="sm" className="w-full lg:w-auto gap-2">
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                      <Button variant="outline" size="sm" className="w-full lg:w-auto gap-2">
                        <Printer className="h-4 w-4" />
                        Receipt
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};