import { format } from 'date-fns';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { CalendarIcon, Filter, Loader2, Search, ShoppingCart, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { CustomerTxType, TransactionsPageProps } from '@/types/types';
const formatTimestamp = (timestamp: Timestamp): string => {
  return format(timestamp.toDate(), 'dd MMM yyyy, hh:mm a');
};

const formatDate = (timestamp: Timestamp): string => {
  return format(timestamp.toDate(), 'dd MMM yyyy');
};

export const TransactionsPage = ({ storeLocation }: TransactionsPageProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [allTransactions, setAllTransactions] = useState<CustomerTxType[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CustomerTxType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'recharges'>('sales');

  // Calculate pagination for filtered results
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredTransactions.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredTransactions.length / recordsPerPage);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Handle records per page change
  const handleRecordsPerPageChange = (value: string) => {
    const newRecordsPerPage = Number(value);
    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1);
  };

  // Fetch all transactions for current store and tab
  const fetchAllTransactions = async () => {
    if (!storeLocation) return;

    setIsLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'CustomerTx'),
        where('storeLocation', '==', storeLocation),
        where('type', '==', activeTab === 'sales' ? 'sale' : 'recharge'),
        where('amount', '>', 0),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedTransactions: CustomerTxType[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();
        fetchedTransactions.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt as Timestamp,
        } as CustomerTxType);
      });

      setAllTransactions(fetchedTransactions);
      setFilteredTransactions(fetchedTransactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again.');
      toast.error('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch transactions when store location or active tab changes
  useEffect(() => {
    setCurrentPage(1);
    fetchAllTransactions();
  }, [storeLocation, activeTab]);



  // Apply filters
  useEffect(() => {
    if (!allTransactions.length) return;

    setIsFiltering(true);
    let result = [...allTransactions];
    console.log('The data in line 112 is', result);

    // Filter by tab
    if (activeTab === 'sales') {
      result = result.filter(tx => tx.type === 'sale');
    } else if (activeTab === 'recharges') {
      result = result.filter(tx => tx.type === 'recharge');
      console.log('the resulrs in line 118 is', result);
    }

    // Search filter (customer name or mobile)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        tx =>
          tx.customerName?.toLowerCase().includes(term) ||
          tx.customerMobile?.toLowerCase().includes(term) ||
          tx.invoiceId?.toLowerCase().includes(term)
      );
    }

    // Date range filter
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      result = result.filter(tx => {
        const txDate = tx.createdAt.toDate();
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      });
    }

    setFilteredTransactions(result);
    setCurrentPage(1);
    setIsFiltering(false);
  }, [searchTerm, startDate, endDate, allTransactions, activeTab]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const calculateTotalAmount = () => {
    return allTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  };

  const calculateTotalRecharges = () => {
    return allTransactions
      .filter(tx => tx.type === 'recharge')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  };

  const calculateTotalSales = () => {
    return allTransactions
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
              Showing {indexOfFirstRecord + 1}-
              {Math.min(indexOfLastRecord, filteredTransactions.length)} of{' '}
              {filteredTransactions.length} transaction(s) for {storeLocation}
            </CardDescription>
          </CardHeader>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Customer</Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by name or mobile..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="pl-12"
                disabled={isLoading}
                max={endDate || undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="pl-12"
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
              <CardTitle className="text-sm font-medium text-blue-600">
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{allTransactions.length}</p>
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
          {activeTab == 'sales' && (
            <Card className="bg-purple-50">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-purple-600">Total Sales</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">₹{calculateTotalSales().toFixed(2)}</p>
              </CardContent>
            </Card>
          )}
          {activeTab == 'recharges' && (
            <Card className="bg-amber-50">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-amber-600">
                  Total Recharges
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">₹{calculateTotalRecharges().toFixed(2)}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Transaction List with Tabs */}
      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'sales' | 'recharges')}>
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
                    {allTransactions.length === 0
                      ? 'No sales recorded for this store yet.'
                      : 'No sales match your current filters.'}
                  </p>
                  {allTransactions.length > 0 && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
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
                          Surabhi
                        </TableHead>
                        <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                          Seva
                        </TableHead>
                        <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                          Cash
                        </TableHead>
                        <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                          Store
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
                      {currentRecords
                        .filter(tx => tx.type === 'sale')
                        .map(tx => (
                          <TableRow key={tx.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              <span className="font-bold">{tx.invoiceId || 'N/A'}</span>
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="font-bold">{tx.customerName}</span>
                            </TableCell>
                            <TableCell className="py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              {tx.customerMobile}
                            </TableCell>
                            <TableCell className="font-bold">₹{tx.amount?.toFixed(2)}</TableCell>
                            <TableCell className="py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              {tx.paymentMethod === 'mixed' ? 'mixed' : tx.paymentMethod || 'cash'}
                            </TableCell>
                            <TableCell>
                              {tx.walletDeduction ? Number(tx.walletDeduction).toFixed(2) : '0.00'}
                            </TableCell>
                            <TableCell>
                              {tx.surabhiUsed ? Number(tx.surabhiUsed).toFixed(2) : '0.00'}
                            </TableCell>
                            <TableCell>
                              {tx.sevaEarned ? Number(tx.sevaEarned).toFixed(2) : '0.00'}
                            </TableCell>
                            <TableCell>
                              ₹{tx.cashPayment ? Number(tx.cashPayment).toFixed(2) : '0.00'}
                            </TableCell>
                            <TableCell>{tx.storeLocation}</TableCell>
                            <TableCell className="py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              {formatTimestamp(tx.createdAt)}
                            </TableCell>
                            <TableCell className="py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              {tx.processedBy || 'system'}
                            </TableCell>
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
                    {allTransactions.length === 0
                      ? 'No recharges recorded for this store yet.'
                      : 'No recharges match your current filters.'}
                  </p>
                  {allTransactions.length > 0 && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
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
                          Date
                        </TableHead>
                        <TableHead className="whitespace-nowrap py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                          Staff
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRecords
                        .filter(tx => tx.type === 'recharge')
                        .map(tx => (
                          <TableRow key={tx.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              <span className="font-bold">{tx.customerName}</span>
                            </TableCell>
                            <TableCell>{tx.customerMobile}</TableCell>
                            <TableCell className="font-bold py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              ₹{tx.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {tx.storeName ? `${tx.storeName}` : tx.storeLocation}
                            </TableCell>
                            <TableCell className="py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              {tx.surabhiEarned ? Number(tx.surabhiEarned).toFixed(2) : '0.00'}
                            </TableCell>
                            <TableCell className="py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm">
                              ₹{tx.sevaEarned ? Number(tx.sevaEarned).toFixed(2) : '0.00'}
                            </TableCell>
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
        <div className="flex flex-col xs:flex-row items-center justify-between mt-3 xs:mt-4 gap-2 xs:gap-4">
          <div className="flex items-center gap-1 xs:gap-2">
            <Label htmlFor="recordsPerPage" className="text-xs xs:text-sm">
              Records per page:
            </Label>
            <Select value={recordsPerPage.toString()} onValueChange={handleRecordsPerPageChange}>
              <SelectTrigger className="w-[80px] xs:w-[100px] h-8 xs:h-9 text-xs xs:text-sm">
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

          <div className="flex items-center gap-1 xs:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 xs:h-9 text-xs xs:text-sm px-2 xs:px-3"
            >
              Prev
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
            }).map(number => (
              <Button
                key={number}
                variant={currentPage === number ? 'default' : 'outline'}
                size="sm"
                onClick={() => paginate(number)}
                className="h-8 xs:h-9 w-8 xs:w-9 p-0 text-xs xs:text-sm"
              >
                {number}
              </Button>
            ))}

            {totalPages > 5 && currentPage < totalPages - 2 && <span className="px-2">...</span>}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <Button variant="outline" size="sm" onClick={() => paginate(totalPages)}>
                {totalPages}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 xs:h-9 text-xs xs:text-sm px-2 xs:px-3"
            >
              Next
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            Showing {indexOfFirstRecord + 1}-
            {Math.min(indexOfLastRecord, filteredTransactions.length)} of{' '}
            {filteredTransactions.length} records
          </div>
        </div>
      )}
    </div>
  );
};
