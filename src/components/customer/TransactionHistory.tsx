import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { CustomerTxType } from '@/types/types';

interface TransactionHistoryProps {
  userId: string;
}

export const TransactionHistory = ({ userId }: TransactionHistoryProps) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions, setTransactions] = useState<CustomerTxType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const customerDoc = await getDoc(doc(db, 'Customers', userId));
      if (!customerDoc.exists()) {
        throw new Error('Customer not found');
      }

      const mobileNumber = customerDoc.data().customerMobile;

      let txQuery;

      if (isInitial) {
        // Initial query
        txQuery = query(
          collection(db, 'CustomerTx'),
          where('customerMobile', '==', mobileNumber),
          // where('amount', '>', 0),
          orderBy('createdAt', 'desc'),
          limit(recordsPerPage)
        );
      } else {
        // Load more query - start after the last document
        if (!lastVisible) {
          setHasMore(false);
          setLoadingMore(false);
          return;
        }

        txQuery = query(
          collection(db, 'CustomerTx'),
          where('customerMobile', '==', mobileNumber),
          // where('amount', '>', 0),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(recordsPerPage)
        );
      }

      const querySnapshot = await getDocs(txQuery);

      // Check if we have more data to load
      if (querySnapshot.empty || querySnapshot.docs.length < recordsPerPage) {
        setHasMore(false);
      } else {
        // Set the last visible document for pagination
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      const txData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as CustomerTxType),
      })) as CustomerTxType[];

      if (isInitial) {
        setTransactions(txData);
      } else {
        setTransactions(prev => [...prev, ...txData]);
      }
    } catch (err) {
      setError('Failed to fetch transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTransactions(true);
  }, [userId, recordsPerPage]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchTransactions(false);
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const filteredTransactions = transactions.filter(tx =>
    tx.storeLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p className="text-lg font-medium">{error}</p>
        <button
          className="mt-4 px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
          onClick={() => {
            setError(null);
            fetchTransactions(true);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 xs:space-y-5 sm:space-y-6">
      <Card>
        <CardHeader className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 xs:gap-4">
            <CardTitle className="text-base xs:text-lg sm:text-xl">Transaction History</CardTitle>
            <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 xs:left-5 top-1/2 -translate-y-1/2 h-3.5 xs:h-4 w-3.5 xs:w-4 text-gray-400" />
                <Input
                  placeholder="Search by location..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 xs:pl-16 h-9 xs:h-10 text-xs xs:text-sm"
                />
              </div>
              <Select
                value={recordsPerPage.toString()}
                onValueChange={value => {
                  setRecordsPerPage(Number(value));
                  setLastVisible(null);
                  setHasMore(true);
                }}
              >
                <SelectTrigger className="w-full xs:w-[110px] sm:w-[120px] h-9 xs:h-10 text-xs xs:text-sm">
                  <SelectValue placeholder="Records" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map(size => (
                    <SelectItem key={size} value={size.toString()}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 xs:px-4 sm:px-6 pb-3 xs:pb-4 sm:pb-6">
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-gray-50">
                <TableRow className="hover:bg-gray-50">
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium">Invoice ID</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium">Date & Time</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium">Location</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Wallet Credit</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Wallet Debit</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Wallet Balance</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Surabhi Credit</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Surabhi Debit</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Surabhi Balance</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Seva Credit</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Seva Debit</TableHead>
                  {/* <TableHead className="text-right">Seva Current</TableHead> */}
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium text-right">Seva Total</TableHead>
                  <TableHead className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm font-medium">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm">{tx.invoiceId || 'NA'}</TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm">{tx.storeLocation}</TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right">
                        {tx.walletCredit ? formatCurrency(tx.walletCredit) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right">
                        {tx.walletDebit ? formatCurrency(tx.walletDebit) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right font-medium">
                        {formatCurrency(tx.walletBalance)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right">
                        {tx.surabhiCredit ? Number(tx.surabhiCredit).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right">
                        {tx.surabhiDebit ? Number(tx.surabhiDebit).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right font-medium">
                        {Number(tx.surabhiBalance).toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right">
                        {tx.sevaCredit ? Number(tx.sevaCredit).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right">
                        {tx.sevaDebit ? Number(tx.sevaDebit).toFixed(2) : '-'}
                      </TableCell>
                      {/* <TableCell className="text-right font-medium">{tx.sevaBalance}</TableCell> */}
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm text-right font-medium">
                        {Number(tx.sevaTotal).toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 xs:py-3 px-2 xs:px-3 text-xs xs:text-sm">{tx.remarks || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 xs:py-10 sm:py-12 text-gray-500 text-xs xs:text-sm">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Load More Button */}
          {filteredTransactions.length > 0 && (
            <div className="flex justify-center mt-4 xs:mt-5 sm:mt-6">
              {hasMore ? (
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="w-full max-w-xs h-9 xs:h-10 text-xs xs:text-sm"
                >
                  {loadingMore ? (
                    <>
                      <div className="mr-2 h-3.5 xs:h-4 w-3.5 xs:w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More Transactions'
                  )}
                </Button>
              ) : (
                <p className="text-xs xs:text-sm text-gray-500">All transactions loaded</p>
              )}
            </div>
          )}

          {/* Transaction Count */}
          <div className="mt-3 xs:mt-4 text-xs xs:text-sm text-gray-500 text-center">
            Showing {filteredTransactions.length} transaction
            {filteredTransactions.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
