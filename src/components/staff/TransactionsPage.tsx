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
import { CalendarIcon, Search, Filter, ShoppingCart, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface SalesTransaction {
  id?: string;
  customerName: string;
  customerMobile: string;
  amount: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
  paymentMethod: 'cash' | 'wallet' | 'mixed';
  storeLocation: string;
  processedBy: string;
  isCustomerRegistered: boolean;
  previousBalance?: {
    wallet: number;
    surabhiCoins: number;
  };
  newBalance?: {
    wallet: number;
    surabhiCoins: number;
  };
  createdAt?: any; // Firestore FieldValue or Timestamp
}

interface TransactionsPageProps {
  storeLocation: string;
}

export const TransactionsPage = ({ storeLocation }: TransactionsPageProps) => {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<SalesTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all transactions for current store
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!storeLocation) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const q = query(
          collection(db, 'transactions'), 
          where('storeLocation', '==', storeLocation)
        );
        const querySnapshot = await getDocs(q);
        const txns: SalesTransaction[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as DocumentData;
          const processedBy = data.processedBy ? data.processedBy : data.createdAt?.toDate() || new Date();
          
          txns.push({ 
            id: doc.id,
            customerName: data.customerName || '',
            customerMobile: data.customerMobile || '',
            amount: data.amount || 0,
            surabhiCoinsUsed: data.surabhiCoinsUsed || 0,
            walletDeduction: data.walletDeduction || 0,
            cashPayment: data.cashPayment || 0,
            paymentMethod: data.paymentMethod || 'cash',
            storeLocation: data.storeLocation,
            processedBy: processedBy instanceof Date ? processedBy.toISOString() : processedBy,
            isCustomerRegistered: data.isCustomerRegistered || false,
            previousBalance: data.previousBalance,
            newBalance: data.newBalance,
            createdAt: data.createdAt
          });
        });

        // Sort by date (newest first)
        txns.sort((a, b) => 
          new Date(b.processedBy).getTime() - new Date(a.processedBy).getTime()
        );

        setTransactions(txns);
        setFilteredTransactions(txns);
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

    // Search filter (name or mobile)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.customerName?.toLowerCase().includes(term) ||
          tx.customerMobile?.includes(term)
      );
    }

    // Date range filter
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      result = result.filter((tx) => {
        const txDate = new Date(tx.processedBy);
        
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      });
    }

    setFilteredTransactions(result);
    setIsFiltering(false);
  }, [searchTerm, startDate, endDate, transactions]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const calculateTotal = (field: keyof SalesTransaction) => {
    return filteredTransactions.reduce((sum, tx) => sum + (Number(tx[field]) || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600">View sales transactions at {storeLocation}</p>
        </div>
      </div>

      {/* Filtering Options */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            Filter Transactions
          </CardTitle>
          <CardDescription>Apply filters to narrow down results</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Customer Name / Mobile</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search..."
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
              <CardTitle className="text-sm font-medium text-green-600">Total Sales</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">₹{calculateTotal('amount').toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-purple-600">Coins Used</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{calculateTotal('surabhiCoinsUsed')}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-amber-600">Wallet Deductions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">₹{calculateTotal('walletDeduction').toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction List */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sales Transactions</CardTitle>
              <CardDescription>
                Showing {filteredTransactions.length} transaction(s) for {storeLocation}
              </CardDescription>
            </div>
            {/* {!isLoading && filteredTransactions.length > 0 && (
              <Button variant="outline" size="sm" disabled>
                Export CSV
              </Button>
            )} */}
          </div>
        </CardHeader>
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
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No transactions found</p>
              <p className="mb-4">
                {transactions.length === 0 
                  ? 'No transactions recorded for this store yet.'
                  : 'No transactions match your current filters.'}
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
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Coins Used</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Cash Paid</TableHead>
                    <TableHead className="text-right">Wallet Deducted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
  // Safely parse the date and handle invalid dates
  const processedDate = tx.processedBy ? new Date(tx.processedBy) : null;
  const formattedDate = processedDate && !isNaN(processedDate.getTime()) 
    ? format(processedDate, 'MMM dd, yyyy hh:mm a') 
    : 'Invalid date';

  return (
    <TableRow key={tx.id} className="hover:bg-gray-50">
      <TableCell>
        {formattedDate}
      </TableCell>
      <TableCell className="font-medium">{tx.customerName || '-'}</TableCell>
      <TableCell>{tx.customerMobile || '-'}</TableCell>
      <TableCell className="text-right">₹{Number(tx.amount).toFixed(2)}</TableCell>
      <TableCell className="text-right">{tx.surabhiCoinsUsed || 0}</TableCell>
      <TableCell>{tx.paymentMethod || '-'}</TableCell>
      <TableCell className="text-right">
        {tx.cashPayment ? `₹${Number(tx.cashPayment).toFixed(2)}` : '-'}
      </TableCell>
      <TableCell className="text-right">
        {tx.walletDeduction ? `₹${Number(tx.walletDeduction).toFixed(2)}` : '-'}
      </TableCell>
    </TableRow>
  );
})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};