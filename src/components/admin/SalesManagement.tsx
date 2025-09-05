import { format } from 'date-fns';
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase';
import { CustomerTxType, StoreType } from '@/types/types';

export const SalesManagement = () => {
  const [transactions, setTransactions] = useState<CustomerTxType[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separate search terms for transactions and recharges
  const [transactionsSearchTerm, setTransactionsSearchTerm] = useState('');
  const [rechargesSearchTerm, setRechargesSearchTerm] = useState('');

  const [filterStore, setFilterStore] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');

  const [activeTab, setActiveTab] = useState('transactions');

  // Pagination state
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [rechargesPage, setRechargesPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(10);
  const [rechargesPerPage, setRechargesPerPage] = useState(10);

  // Fetch transactions from Firestore
  const fetchTransactions = async () => {
    try {
      const transactionsRef = collection(db, 'CustomerTx');
      const q = query(transactionsRef, where('amount', '>', 0), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || Timestamp.now(),
      })) as CustomerTxType[];
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
        storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
        storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
        walletEnabled: doc.data().walletEnabled || false,
      })) as StoreType[];
      setStores(
        storesData.filter(store => store.storeStatus === 'active' && store.demoStore === false)
      );
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
    setTransactionsPage(1);
    setRechargesPage(1);
    fetchTransactions();
  };

  // Filter transactions (sales)
  const filteredTransactions = transactions.filter(tx => {
    if (tx.type !== 'sale' || tx.demoStore) return false;

    const matchesSearch =
      transactionsSearchTerm === '' ||
      (tx.customerName?.toLowerCase() || '').includes(transactionsSearchTerm.toLowerCase()) ||
      (tx.customerMobile || '').includes(transactionsSearchTerm) ||
      (tx.invoiceId || '').includes(transactionsSearchTerm);
    const matchesStore = filterStore === 'all' || tx.storeLocation === filterStore;
    const matchesPayment = filterPayment === 'all' || tx.paymentMethod === filterPayment;

    return matchesSearch && matchesStore && matchesPayment;
  });

  // Filter recharges
  const filteredRecharges = transactions.filter(tx => {
    if (tx.type !== 'recharge' || tx.demoStore) return false;

    return (
      rechargesSearchTerm === '' ||
      (tx.customerName?.toLowerCase() || '').includes(rechargesSearchTerm.toLowerCase()) ||
      (tx.customerMobile || '').includes(rechargesSearchTerm)
    );
  });

  // Pagination logic for transactions
  const transactionsTotalPages = Number(
    Math.ceil(filteredTransactions.length / transactionsPerPage).toFixed(2)
  );
  const transactionsStartIndex = (transactionsPage - 1) * transactionsPerPage;
  const transactionsEndIndex = transactionsStartIndex + transactionsPerPage;
  const paginatedTransactions = filteredTransactions.slice(
    transactionsStartIndex,
    transactionsEndIndex
  );

  // Pagination logic for recharges
  const rechargesTotalPages = Number(
    Math.ceil(filteredRecharges.length / rechargesPerPage).toFixed(2)
  );
  const rechargesStartIndex = (rechargesPage - 1) * rechargesPerPage;
  const rechargesEndIndex = rechargesStartIndex + rechargesPerPage;
  const paginatedRecharges = filteredRecharges.slice(rechargesStartIndex, rechargesEndIndex);

  const totalStats = {
    totalSales: filteredTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    // totalAdminProfit: filteredTransactions.reduce((sum, t) => sum + Number(t.adminProfit || 0), 0),

    totalTransactions: filteredTransactions.length,
    totalSurabhiCoinsUsed: filteredTransactions.reduce((sum, t) => sum + (t.surabhiUsed || 0), 0),
    totalWalletDeductions: filteredTransactions.reduce(
      (sum, t) => sum + (t.walletDeduction || 0),
      0
    ),
    totalCashPayments: filteredTransactions.reduce((sum, t) => sum + (t.cashPayment || 0), 0),
    totalRecharges: filteredRecharges.reduce((sum, r) => sum + r.amount, 0),
  };

  // Check if wallet is enabled for the selected store
  const selectedStore = stores.find(store => store.storeLocation === filterStore);
  const isWalletEnabled =
    filterStore === 'all'
      ? stores.some(store => store.walletEnabled)
      : selectedStore?.walletEnabled || false;

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
            <p className="text-xl font-bold text-green-900">
              ₹{totalStats.totalSales.toFixed(2).toLocaleString()}
            </p>
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

        {isWalletEnabled && (
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-600">Wallet Used</span>
              </div>
              <p className="text-xl font-bold text-purple-900">
                ₹{totalStats.totalWalletDeductions.toFixed(2).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Coins Used</span>
            </div>
            <p className="text-xl font-bold text-amber-900">
              {totalStats.totalSurabhiCoinsUsed.toFixed(2).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Cash Payments</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              ₹{totalStats.totalCashPayments.toFixed(2).toLocaleString()}
            </p>
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
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search transactions..."
                      value={transactionsSearchTerm}
                      onChange={e => {
                        setTransactionsSearchTerm(e.target.value);
                        setTransactionsPage(1);
                      }}
                      className="pl-14 w-full sm:w-64"
                    />
                  </div>

                  <Select
                    value={filterStore}
                    onValueChange={value => {
                      setFilterStore(value);
                      setTransactionsPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-36 md:w-40 lg:w-48 h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm">
                      <SelectValue placeholder="Filter by store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[10px] xs:text-xs sm:text-sm">
                        All Stores
                      </SelectItem>
                      {stores.map(store => (
                        <SelectItem
                          key={store.id}
                          value={store.storeName}
                          className="text-[10px] xs:text-xs sm:text-sm"
                        >
                          {store.storeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterPayment}
                    onValueChange={value => {
                      setFilterPayment(value);
                      setTransactionsPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-32 md:w-36 lg:w-40 h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm">
                      <SelectValue placeholder="Payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[10px] xs:text-xs sm:text-sm">
                        All Methods
                      </SelectItem>
                      <SelectItem value="wallet" className="text-[10px] xs:text-xs sm:text-sm">
                        Wallet
                      </SelectItem>
                      <SelectItem value="cash" className="text-[10px] xs:text-xs sm:text-sm">
                        Cash
                      </SelectItem>
                      <SelectItem value="mixed" className="text-[10px] xs:text-xs sm:text-sm">
                        Mixed
                      </SelectItem>
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
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setTransactionsSearchTerm('');
                        setFilterStore('all');
                        setFilterPayment('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Invoice ID
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Customer
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Mobile
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Amount
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Payment
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Wallet
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Coins
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Cash
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Store
                          </TableHead>
                          {/* <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Type
                          </TableHead> */}
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Date
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Staff
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map(transaction => (
                          <TableRow key={transaction.invoiceId}>
                            <TableCell>{transaction.invoiceId || 'N/A'}</TableCell>
                            <TableCell className="font-medium">
                              {transaction.customerName}
                              {transaction.type === 'sale' && !transaction.customerMobile && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Guest
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{transaction.customerMobile || 'N/A'}</TableCell>
                            <TableCell className="font-bold">
                              ₹{transaction.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.paymentMethod === 'wallet'
                                    ? 'default'
                                    : transaction.paymentMethod === 'cash'
                                      ? 'secondary'
                                      : 'outline'
                                }
                              >
                                {transaction.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-purple-600">
                              ₹{(transaction.walletDeduction || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-amber-600">
                              {(transaction.surabhiUsed || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              ₹{(transaction.cashPayment || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>{transaction.storeLocation}</TableCell>
                            {/* <TableCell>
                              {transaction.demoStore ? (
                                <Badge variant="destructive" className="text-xs">
                                  Demo
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">
                                  Live
                                </Badge>
                              )}
                            </TableCell> */}
                            <TableCell>
                              {format(transaction.createdAt.toDate(), 'dd MMM yyyy, hh:mm a')}
                            </TableCell>
                            <TableCell>{transaction.processedBy || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Transactions Pagination */}
                  <div className="flex items-center justify-between px-2 mt-4">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                        value={`${transactionsPerPage}`}
                        onValueChange={value => {
                          setTransactionsPerPage(Number(value));
                          setTransactionsPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={transactionsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 30, 40, 50].map(pageSize => (
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
                          onClick={() =>
                            setTransactionsPage(
                              Number(Math.max(1, transactionsPage - 1).toFixed(2))
                            )
                          }
                          disabled={transactionsPage === 1}
                        >
                          <span className="sr-only">Go to previous page</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            setTransactionsPage(
                              Number(
                                Math.min(transactionsTotalPages, transactionsPage + 1).toFixed(2)
                              )
                            )
                          }
                          disabled={
                            transactionsPage === transactionsTotalPages ||
                            transactionsTotalPages === 0
                          }
                        >
                          <span className="sr-only">Go to next page</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setTransactionsPage(transactionsTotalPages)}
                          disabled={
                            transactionsPage === transactionsTotalPages ||
                            transactionsTotalPages === 0
                          }
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
                    {filteredRecharges.length} recharge records (Total: ₹
                    {totalStats.totalRecharges.toFixed(2).toLocaleString()})
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 xs:left-2.5 sm:left-3 top-[7px] xs:top-[9px] sm:top-3 h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                  <Input
                    placeholder="Search recharges..."
                    value={rechargesSearchTerm}
                    onChange={e => {
                      setRechargesSearchTerm(e.target.value);
                      setRechargesPage(1);
                    }}
                    className="pl-7 xs:pl-8 sm:pl-10 w-full sm:w-48 md:w-56 lg:w-64 h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm rounded-[3px] xs:rounded-[4px] sm:rounded"
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
                  <div className="overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Customer
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Mobile
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Invoice ID
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Amount
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Store
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Coins Earned
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Seva Amount
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Type
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Date
                          </TableHead>
                          <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                            Staff
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRecharges.map(recharge => (
                          <TableRow key={recharge.id}>
                            <TableCell className="font-medium">{recharge.customerName}</TableCell>
                            <TableCell>{recharge.customerMobile}</TableCell>
                            <TableCell>{recharge.invoiceId || 'N/A'}</TableCell>
                            <TableCell className="text-green-600">
                              ₹{Number(recharge.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {recharge.storeName} ({recharge.storeLocation})
                            </TableCell>
                            <TableCell>{(recharge.surabhiEarned || 0).toFixed(2)}</TableCell>
                            <TableCell>₹{(recharge.sevaEarned || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              {recharge.demoStore ? (
                                <Badge variant="destructive" className="text-xs">
                                  Demo
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">
                                  Live
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {format(recharge.createdAt.toDate(), 'dd MMM yyyy, hh:mm a')}
                            </TableCell>
                            <TableCell>{recharge.processedBy || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Recharges Pagination */}
                  <div className="flex items-center justify-between px-2 mt-4">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                        value={`${rechargesPerPage}`}
                        onValueChange={value => {
                          setRechargesPerPage(Number(value));
                          setRechargesPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={rechargesPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 30, 40, 50].map(pageSize => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 xs:space-x-4 sm:space-x-6 lg:space-x-8">
                      <div className="flex w-[80px] xs:w-[90px] sm:w-[100px] items-center justify-center text-[10px] xs:text-xs sm:text-sm font-medium">
                        Page {rechargesPage} of {rechargesTotalPages}
                      </div>
                      <div className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-2">
                        <Button
                          variant="outline"
                          className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() => setRechargesPage(1)}
                          disabled={rechargesPage === 1}
                        >
                          <span className="sr-only">Go to first page</span>
                          <ChevronLeft className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                          <ChevronLeft className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 -ml-1.5 xs:-ml-2" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() =>
                            setRechargesPage(Number(Math.max(1, rechargesPage - 1).toFixed(2)))
                          }
                          disabled={rechargesPage === 1}
                        >
                          <span className="sr-only">Go to previous page</span>
                          <ChevronLeft className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() =>
                            setRechargesPage(
                              Number(Math.min(rechargesTotalPages, rechargesPage + 1).toFixed(2))
                            )
                          }
                          disabled={
                            rechargesPage === rechargesTotalPages || rechargesTotalPages === 0
                          }
                        >
                          <span className="sr-only">Go to next page</span>
                          <ChevronRight className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() => setRechargesPage(rechargesTotalPages)}
                          disabled={
                            rechargesPage === rechargesTotalPages || rechargesTotalPages === 0
                          }
                        >
                          <span className="sr-only">Go to last page</span>
                          <ChevronRight className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                          <ChevronRight className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 -ml-1.5 xs:-ml-2" />
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
