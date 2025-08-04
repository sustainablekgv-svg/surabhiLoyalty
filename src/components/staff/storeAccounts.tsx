import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';


import { AccountTxType, StoreAccountsProps } from '@/types/types';
import { useAuth } from '@/hooks/auth-context';

const StoreAccounts = ({ storeLocation, userRole }: StoreAccountsProps & { userRole: string }) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<AccountTxType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTx, setUpdatingTx] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const isAdmin = userRole === 'admin';

  const fetchTransactions = async () => {
  try {
    setLoading(true);
    console.log('Fetching transactions for store:', user.storeLocation); // Debug log

    if (!user.storeLocation) {
      console.log('No store location provided'); // Debug log
      return;
    }

    const txQuery = query(
      collection(db, 'AccountTx'),
      where('storeName', '==', user.storeLocation),
      orderBy('createdAt', 'desc')
    );

    console.log('Query:', txQuery); // Debug log

    const txSnapshot = await getDocs(txQuery);
    console.log('Snapshot size:', txSnapshot.size); // Debug log

    const txData: AccountTxType[] = [];

    txSnapshot.forEach(doc => {
      console.log('Document:', doc.id, doc.data()); // Debug log
      const data = doc.data();
      txData.push({
        id: doc.id,
        createdAt: data.createdAt,
        storeName: data.storeName,
        customerName: data.customerName,
        customerMobile: data.customerMobile,
        type: data.type,
        amount: data.amount || 0,
        debit: data.debit || 0,
        credit: data.credit || 0,
        balance: data.balance || 0,
        remarks: data.description || '',
        adminCut: data.adminCut || 0
      });
    });

    console.log('Fetched transactions:', txData); // Debug log
    setTransactions(txData);
    setTotalPages(Math.ceil(txData.length / rowsPerPage));

  } catch (err) {
    console.error('Error fetching transactions:', err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  const formatTimestamp = (timestamp: Timestamp): string => {
    return format(timestamp.toDate(), 'MMM dd, yyyy HH:mm');
  };

  // Calculate paginated transactions
  const getPaginatedTransactions = () => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return transactions.slice(startIndex, startIndex + rowsPerPage);
  };

  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing rows per page
    setTotalPages(Math.ceil(transactions.length / value));
  };

  useEffect(() => {
    fetchTransactions();
  }, [storeLocation]);

  useEffect(() => {
    setTotalPages(Math.ceil(transactions.length / rowsPerPage));
  }, [transactions, rowsPerPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{user.storeLocation} Transactions</h2>
        <Button variant="outline" onClick={() => {
          setRefreshing(true);
          fetchTransactions();
        }} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Accounts History</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                className="border rounded-md px-2 py-1 text-sm"
              >
                {[5, 10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getPaginatedTransactions().map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {formatTimestamp(tx.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      tx.type === 'recharge' ? 'default' :
                        tx.type === 'sale' ? 'secondary' : 'outline'
                    }>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.amount >= 0 ? '+' : ''}
                    ₹{tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {tx.credit > 0 ? `+₹${tx.credit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {tx.debit > 0 ? `-₹${tx.debit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{tx.balance.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {tx.remarks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
              {Math.min(currentPage * rowsPerPage, transactions.length)} of{' '}
              {transactions.length} transactions
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-4 text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreAccounts;