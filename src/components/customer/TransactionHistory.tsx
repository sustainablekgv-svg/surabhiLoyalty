import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, getDoc, doc, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TransactionHistoryProps {
  userId: string;
}
import { CustomerTxType } from '@/types/types';

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
        ...(doc.data() as CustomerTxType)
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
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Transaction History</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={recordsPerPage.toString()}
                onValueChange={(value) => {
                  setRecordsPerPage(Number(value));
                  setLastVisible(null);
                  setHasMore(true);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Records" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Wallet Credit</TableHead>
                  <TableHead className="text-right">Wallet Debit</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                  <TableHead className="text-right">Surabhi Credit</TableHead>
                  <TableHead className="text-right">Surabhi Debit</TableHead>
                  <TableHead className="text-right">Surabhi Balance</TableHead>
                  <TableHead className="text-right">Seva Credit</TableHead>
                  <TableHead className="text-right">Seva Debit</TableHead>
                  <TableHead className="text-right">Seva Current</TableHead>
                  <TableHead className="text-right">Seva Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(tx.createdAt)}</TableCell>
                      <TableCell>{tx.storeLocation}</TableCell>
                      <TableCell className="text-right">{tx.walletCredit ? formatCurrency(tx.walletCredit) : '-'}</TableCell>
                      <TableCell className="text-right">{tx.walletDebit ? formatCurrency(tx.walletDebit) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(tx.walletBalance)}</TableCell>
                      <TableCell className="text-right">{tx.surabhiCredit || '-'}</TableCell>
                      <TableCell className="text-right">{tx.surabhiDebit || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{tx.surabhiBalance}</TableCell>
                      <TableCell className="text-right">{tx.sevaCredit || '-'}</TableCell>
                      <TableCell className="text-right">{tx.sevaDebit || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{tx.sevaBalance}</TableCell>
                      <TableCell className="text-right font-medium">{tx.sevaTotal}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Load More Button */}
          {filteredTransactions.length > 0 && (
            <div className="flex justify-center mt-6">
              {hasMore ? (
                <Button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  variant="outline"
                  className="w-full max-w-xs"
                >
                  {loadingMore ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More Transactions'
                  )}
                </Button>
              ) : (
                <p className="text-sm text-gray-500">All transactions loaded</p>
              )}
            </div>
          )}
          
          {/* Transaction Count */}
          <div className="mt-4 text-sm text-gray-500 text-center">
            Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};