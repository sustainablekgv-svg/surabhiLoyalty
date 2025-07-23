import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Eye,
  Wallet,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { collection, getDocs, Timestamp, where, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

import { StoreType, SalesTransaction, RechargeRecord } from '@/types/types';

export const SalesManagement = () => {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separate search terms for transactions and recharges
  const [transactionsSearchTerm, setTransactionsSearchTerm] = useState('');
  const [rechargesSearchTerm, setRechargesSearchTerm] = useState('');

  const [filterStore, setFilterStore] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');

  const [recharges, setRecharges] = useState<RechargeRecord[]>([]);
  const [activeTab, setActiveTab] = useState('transactions');

  // Pagination state
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [rechargesPage, setRechargesPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(10);
  const [rechargesPerPage, setRechargesPerPage] = useState(10);

  // Fetch transactions from Firestore
  const fetchTransactions = async () => {
    try {
      const transactionsRef = collection(db, 'transactions');
      const snapshot = await getDocs(transactionsRef);
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || Timestamp.now()
      })) as SalesTransaction[];
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
      setStores(storesData.filter(store => store.status === 'active'));
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to load store locations');
    }
  };

  // Fetch recharges from Firestore
  const fetchRecharges = async () => {
    try {
      const rechargesRef = collection(db, 'recharges');
      const querySnapshot = await getDocs(rechargesRef);
      
      const rechargesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp || Timestamp.now()
      })) as RechargeRecord[];
      
      setRecharges(rechargesData);
    } catch (err) {
      console.error('Error fetching recharges:', err);
      setError('Failed to load recharge data');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTransactions(), fetchStores(), fetchRecharges()]);
    };
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTransactionsPage(1);
    setRechargesPage(1);
    fetchTransactions();
    fetchRecharges();
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.customerName.toLowerCase().includes(transactionsSearchTerm.toLowerCase());
                        //  transaction.customerMobile.includes(transactionsSearchTerm);
    const matchesStore = filterStore === 'all' || transaction.storeLocation === filterStore;
    const matchesPayment = filterPayment === 'all' || transaction.paymentMethod === filterPayment;
    
    return matchesSearch && matchesStore && matchesPayment;
  });

  const filteredRecharges = recharges.filter(recharge => {
    return recharge.customerName.toLowerCase().includes(rechargesSearchTerm.toLowerCase()) ||
           recharge.customerMobile.includes(rechargesSearchTerm);
  });

  // Pagination logic for transactions
  const transactionsTotalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
  const transactionsStartIndex = (transactionsPage - 1) * transactionsPerPage;
  const transactionsEndIndex = transactionsStartIndex + transactionsPerPage;
  const paginatedTransactions = filteredTransactions.slice(transactionsStartIndex, transactionsEndIndex);

  // Pagination logic for recharges
  const rechargesTotalPages = Math.ceil(filteredRecharges.length / rechargesPerPage);
  const rechargesStartIndex = (rechargesPage - 1) * rechargesPerPage;
  const rechargesEndIndex = rechargesStartIndex + rechargesPerPage;
  const paginatedRecharges = filteredRecharges.slice(rechargesStartIndex, rechargesEndIndex);

  const totalStats = {
    totalSales: transactions.reduce((sum, t) => sum + t.amount, 0),
    totalTransactions: transactions.length,
    totalSurabhiCoinsUsed: transactions.reduce((sum, t) => sum + (t.surabhiCoinsUsed || 0), 0),
    totalWalletDeductions: transactions.reduce((sum, t) => sum + (t.walletDeduction || 0), 0),
    totalCashPayments: transactions.reduce((sum, t) => sum + (t.cashPayment || 0), 0),
    totalRecharges: recharges.reduce((sum, r) => sum + r.amount, 0)
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
        
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Wallet Used</span>
            </div>
            <p className="text-xl font-bold text-purple-900">₹{totalStats.totalWalletDeductions.toLocaleString()}</p>
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
        
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Cash Payments</span>
            </div>
            <p className="text-xl font-bold text-gray-900">₹{totalStats.totalCashPayments.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="recharges">Recharges</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                <div>
                  <CardTitle>Sales Transactions</CardTitle>
                  <CardDescription>
                    {filteredTransactions.length} transactions found
                    {(transactionsSearchTerm || filterStore !== 'all' || filterPayment !== 'all') && 
                      ' (filtered)'}
                  </CardDescription>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search transactions..."
                      value={transactionsSearchTerm}
                      onChange={(e) => {
                        setTransactionsSearchTerm(e.target.value);
                        setTransactionsPage(1);
                      }}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  
                  <Select value={filterStore} onValueChange={(value) => {
                    setFilterStore(value);
                    setTransactionsPage(1);
                  }}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.name}>
                          {store.name} ({store.storeLocation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterPayment} onValueChange={(value) => {
                    setFilterPayment(value);
                    setTransactionsPage(1);
                  }}>
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
              {filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
                  <Search className="h-8 w-8" />
                  <p>No transactions found</p>
                  {(transactionsSearchTerm || filterStore !== 'all' || filterPayment !== 'all') && (
                    <Button variant="ghost" onClick={() => {
                      setTransactionsSearchTerm('');
                      setFilterStore('all');
                      setFilterPayment('all');
                    }}>
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Coins</TableHead>
                        <TableHead>Cash</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            {transaction.customerName}
                            {!transaction.isCustomerRegistered && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Guest
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {transaction.customerMobile}
                          </TableCell>
                          <TableCell className="font-bold">
                            ₹{transaction.amount}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              transaction.paymentMethod === 'wallet' ? 'default' :
                              transaction.paymentMethod === 'cash' ? 'secondary' : 'outline'
                            }>
                              {transaction.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-purple-600">
                            ₹{transaction.walletDeduction}
                          </TableCell>
                          <TableCell className="text-amber-600">
                            {transaction.surabhiCoinsUsed}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            ₹{transaction.cashPayment}
                          </TableCell>
                          <TableCell>
                            {transaction.storeLocation}
                          </TableCell>
                          <TableCell>
                            {format(transaction.createdAt.toDate(), 'dd MMM yyyy, hh:mm a')}
                          </TableCell>
                          <TableCell>
                            {transaction.processedBy}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Transactions Pagination */}
                  <div className="flex items-center justify-between px-2 mt-4">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                        value={`${transactionsPerPage}`}
                        onValueChange={(value) => {
                          setTransactionsPerPage(Number(value));
                          setTransactionsPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={transactionsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8">
                      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {transactionsPage} of {transactionsTotalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setTransactionsPage(1)}
                          disabled={transactionsPage === 1}
                        >
                          <span className="sr-only">Go to first page</span>
                          <ChevronLeft className="h-4 w-4" />
                          <ChevronLeft className="h-4 w-4 -ml-2" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setTransactionsPage(Math.max(1, transactionsPage - 1))}
                          disabled={transactionsPage === 1}
                        >
                          <span className="sr-only">Go to previous page</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setTransactionsPage(Math.min(transactionsTotalPages, transactionsPage + 1))}
                          disabled={transactionsPage === transactionsTotalPages || transactionsTotalPages === 0}
                        >
                          <span className="sr-only">Go to next page</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setTransactionsPage(transactionsTotalPages)}
                          disabled={transactionsPage === transactionsTotalPages || transactionsTotalPages === 0}
                        >
                          <span className="sr-only">Go to last page</span>
                          <ChevronRight className="h-4 w-4" />
                          <ChevronRight className="h-4 w-4 -ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recharges">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                <div>
                  <CardTitle>Wallet Recharges</CardTitle>
                  <CardDescription>
                    {filteredRecharges.length} recharge records (Total: ₹{totalStats.totalRecharges.toLocaleString()})
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search recharges..."
                    value={rechargesSearchTerm}
                    onChange={(e) => {
                      setRechargesSearchTerm(e.target.value);
                      setRechargesPage(1);
                    }}
                    className="pl-10 w-full sm:w-64"
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {filteredRecharges.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
                  <Search className="h-8 w-8" />
                  <p>No recharge records found</p>
                  {rechargesSearchTerm && (
                    <Button variant="ghost" onClick={() => setRechargesSearchTerm('')}>
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Coins Earned</TableHead>
                        <TableHead>Seva Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRecharges.map((recharge) => (
                        <TableRow key={recharge.id}>
                          <TableCell className="font-medium">
                            {recharge.customerName}
                          </TableCell>
                          <TableCell>
                            {recharge.customerMobile}
                          </TableCell>
                          <TableCell className="text-green-600">
                            ₹{recharge.amount}
                          </TableCell>
                          <TableCell>
                            {recharge.storeName} ({recharge.storeLocation})
                          </TableCell>
                          <TableCell>
                            {recharge.surabhiCoinsEarned}
                          </TableCell>
                          <TableCell>
                            ₹{recharge.sevaAmountEarned}
                          </TableCell>
                          <TableCell>
                            {format(recharge.timestamp.toDate(), 'dd MMM yyyy, hh:mm a')}
                          </TableCell>
                          <TableCell>
                            {recharge.staffName}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Recharges Pagination */}
                  <div className="flex items-center justify-between px-2 mt-4">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                        value={`${rechargesPerPage}`}
                        onValueChange={(value) => {
                          setRechargesPerPage(Number(value));
                          setRechargesPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={rechargesPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8">
                      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {rechargesPage} of {rechargesTotalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setRechargesPage(1)}
                          disabled={rechargesPage === 1}
                        >
                          <span className="sr-only">Go to first page</span>
                          <ChevronLeft className="h-4 w-4" />
                          <ChevronLeft className="h-4 w-4 -ml-2" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setRechargesPage(Math.max(1, rechargesPage - 1))}
                          disabled={rechargesPage === 1}
                        >
                          <span className="sr-only">Go to previous page</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setRechargesPage(Math.min(rechargesTotalPages, rechargesPage + 1))}
                          disabled={rechargesPage === rechargesTotalPages || rechargesTotalPages === 0}
                        >
                          <span className="sr-only">Go to next page</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setRechargesPage(rechargesTotalPages)}
                          disabled={rechargesPage === rechargesTotalPages || rechargesTotalPages === 0}
                        >
                          <span className="sr-only">Go to last page</span>
                          <ChevronRight className="h-4 w-4" />
                          <ChevronRight className="h-4 w-4 -ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};