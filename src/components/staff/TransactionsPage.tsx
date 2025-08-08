import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Search, Filter, ShoppingCart, Loader2, Zap, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, getDocs, DocumentData, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { TransactionsPageProps } from '@/types/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { CustomerTxType } from '@/types/types';
const formatTimestamp = (timestamp: Timestamp): string => {
  return format(timestamp.toDate(), 'dd MMM yyyy, hh:mm a');
};

const formatDate = (timestamp: Timestamp): string => {
  return format(timestamp.toDate(), 'dd MMM yyyy');
};

export const TransactionsPage = ({ storeLocation }: TransactionsPageProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [transactions, setTransactions] = useState<CustomerTxType[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CustomerTxType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'recharges'>('sales');

  // Calculate pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredTransactions.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredTransactions.length / recordsPerPage);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Handle records per page change
  const handleRecordsPerPageChange = (value: string) => {
    setRecordsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Fetch all transactions for current store
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!storeLocation) return;

      setIsLoading(true);
      setError(null);

      try {
        const q = query(
          collection(db, 'CustomerTx'),
          where('storeLocation', '==', storeLocation),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedTransactions: CustomerTxType[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedTransactions.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt as Timestamp
          } as CustomerTxType);
        });

        setTransactions(fetchedTransactions);
        setFilteredTransactions(fetchedTransactions);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transactions. Please try again.');
        toast.error('Failed to load transactions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [storeLocation]);

  // Apply filters
  useEffect(() => {
    if (!transactions.length) return;

    setIsFiltering(true);
    let result = [...transactions];
    console.log("The data in line 112 is", result);

    // Filter by tab
    if (activeTab === 'sales') {
      result = result.filter(tx => tx.type === 'sale');
    } else if (activeTab === 'recharges') {
      result = result.filter(tx => tx.type === 'recharge');
      console.log("the resulrs in line 118 is", result)
    }

    // Search filter (customer name or mobile)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.customerName?.toLowerCase().includes(term) ||
          tx.customerMobile?.toLowerCase().includes(term)
      );
    }

    // Date range filter
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      result = result.filter((tx) => {
        const txDate = tx.createdAt.toDate();
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      });
    }

    setFilteredTransactions(result);
    setCurrentPage(1);
    setIsFiltering(false);
  }, [searchTerm, startDate, endDate, transactions, activeTab]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const calculateTotalAmount = () => {
    return filteredTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  };

  const calculateTotalRecharges = () => {
    return filteredTransactions
      .filter(tx => tx.type === 'recharge')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  };

  const calculateTotalSales = () => {
    return filteredTransactions
      .filter(tx => tx.type === 'sale')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600">View transactions and recharges at {storeLocation}</p>
        </div>
      </div>

      {/* Filtering Options */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            Filter Transactions
          </CardTitle>
          <CardHeader>
            <CardDescription>
              Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredTransactions.length)} of {filteredTransactions.length} transaction(s) for {storeLocation}
            </CardDescription>
          </CardHeader>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Customer</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by name or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                max={endDate || undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                min={startDate || undefined}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-full"
              disabled={isLoading || (!searchTerm && !startDate && !endDate)}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      {!isLoading && filteredTransactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-blue-600">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{filteredTransactions.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-green-600">Total Amount</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">₹{calculateTotalAmount().toFixed(2)}</p>
            </CardContent>
          </Card>
          {activeTab=='sales' && <Card className="bg-purple-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-purple-600">Total Sales</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">₹{calculateTotalSales().toFixed(2)}</p>
            </CardContent>
          </Card>}
          {activeTab=='recharges' && <Card className="bg-amber-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-amber-600">Total Recharges</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">₹{calculateTotalRecharges().toFixed(2)}</p>
            </CardContent>
          </Card>}
        </div>
      )}

      {/* Transaction List with Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sales' | 'recharges')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Sales Transactions
          </TabsTrigger>
          <TabsTrigger value="recharges">
            <Zap className="h-4 w-4 mr-2" />
            Wallet Recharges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mt-4">
            <CardContent>
              {error ? (
                <div className="text-center py-8 text-red-500">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                  <p>Loading transactions...</p>
                </div>
              ) : isFiltering ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  <p>Applying filters...</p>
                </div>
              ) : filteredTransactions.filter(tx => tx.type === 'sale').length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No sales transactions found</p>
                  <p className="mb-4">
                    {transactions.length === 0
                      ? 'No sales recorded for this store yet.'
                      : 'No sales match your current filters.'}
                  </p>
                  {transactions.length > 0 && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Surabhi</TableHead>
                        <TableHead>Seva</TableHead>
                        <TableHead>Cash</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRecords
                        .filter(tx => tx.type === 'sale')
                        .map((tx) => (
                          <TableRow key={tx.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              <span className="font-bold">{tx.customerName}</span>
                            </TableCell>
                            <TableCell>{tx.customerMobile}</TableCell>
                            <TableCell className="font-bold">₹{tx.amount?.toFixed(2)}</TableCell>
                            <TableCell>
                              {tx.paymentMethod === 'mixed' ? 'mixed' : tx.paymentMethod || 'cash'}
                            </TableCell>
                            <TableCell>{tx.walletDeduction || 0}</TableCell>
                            <TableCell>{tx.surabhiUsed || 0}</TableCell>
                            <TableCell>{tx.sevaEarned || 0}</TableCell>
                            <TableCell>₹{tx.cashPayment?.toFixed(2) || 0}</TableCell>
                            <TableCell>{tx.storeLocation}</TableCell>
                            <TableCell>{formatTimestamp(tx.createdAt)}</TableCell>
                            <TableCell>{tx.processedBy || 'system'}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recharges">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mt-4">
            <CardContent>
              {error ? (
                <div className="text-center py-8 text-red-500">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                  <p>Loading recharges...</p>
                </div>
              ) : isFiltering ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  <p>Applying filters...</p>
                </div>
              ) : filteredTransactions.filter(tx => tx.type === 'recharge').length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No recharge records found</p>
                  <p className="mb-4">
                    {transactions.length === 0
                      ? 'No recharges recorded for this store yet.'
                      : 'No recharges match your current filters.'}
                  </p>
                  {transactions.length > 0 && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                      {currentRecords
                        .filter(tx => tx.type === 'recharge')
                        .map((tx) => (
                          <TableRow key={tx.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              <span className="font-bold">{tx.customerName}</span>
                            </TableCell>
                            <TableCell>{tx.customerMobile}</TableCell>
                            <TableCell className="font-bold">₹{tx.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              {tx.storeName ? `${tx.storeName}` : tx.storeLocation}
                            </TableCell>
                            <TableCell>{tx.surabhiEarned || 0}</TableCell>
                            <TableCell>₹{tx.sevaEarned?.toFixed(2) || 0}</TableCell>
                            <TableCell>{formatTimestamp(tx.createdAt)}</TableCell>
                            <TableCell>{tx.processedBy || 'system'}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="recordsPerPage">Records per page:</Label>
            <Select
              value={recordsPerPage.toString()}
              onValueChange={handleRecordsPerPageChange}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show first, last and nearby pages
              if (totalPages <= 5) {
                return i + 1;
              }
              if (currentPage <= 3) {
                return i + 1;
              }
              if (currentPage >= totalPages - 2) {
                return totalPages - 4 + i;
              }
              return currentPage - 2 + i;
            }).map((number) => (
              <Button
                key={number}
                variant={currentPage === number ? "default" : "outline"}
                size="sm"
                onClick={() => paginate(number)}
              >
                {number}
              </Button>
            ))}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="px-2">...</span>
            )}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => paginate(totalPages)}
              >
                {totalPages}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredTransactions.length)} of {filteredTransactions.length} records
          </div>
        </div>
      )}
    </div>
  );
};
