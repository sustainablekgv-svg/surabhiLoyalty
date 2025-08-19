import { format } from 'date-fns';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AccountTxType, StoreAccountsProps } from '@/types/types';

const StoreAccounts = ({ storeLocation, userRole }: StoreAccountsProps & { userRole: string }) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [allTransactions, setAllTransactions] = useState<AccountTxType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTx, setUpdatingTx] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const isAdmin = userRole === 'admin';

  // Calculate pagination for all transactions
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = allTransactions.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(allTransactions.length / recordsPerPage);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Fetch all transactions for current store
  const fetchAllTransactions = async () => {
    if (!user.storeLocation) {
      console.log('No store location provided');
      return;
    }

    setLoading(true);

    try {
      const txQuery = query(
        collection(db, 'AccountTx'),
        where('storeName', '==', user.storeLocation),
        orderBy('createdAt', 'desc')
      );

      const txSnapshot = await getDocs(txQuery);
      const txData: AccountTxType[] = [];

      txSnapshot.forEach(doc => {
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
          adminProfit: data.adminProfit || 0,
          currentBalance: data.currentBalance || 0,
          sevaBalance: data.sevaBalance || 0,
          remarks: data.remarks || '',
          adminCurrentBalance: data.adminCurrentBalance || 0,
          adminCut: data.adminCut || 0,
        });
      });

      setAllTransactions(txData);
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

  // Handle records per page change
  const handleRecordsPerPageChange = (value: string) => {
    const newRecordsPerPage = Number(value);
    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1);
  };

  // Fetch transactions when store location changes
  useEffect(() => {
    setCurrentPage(1);
    fetchAllTransactions();
  }, [storeLocation]);

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts History</CardTitle>
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
              {currentRecords.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell>{formatTimestamp(tx.createdAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        tx.type === 'recharge'
                          ? 'default'
                          : tx.type === 'sale'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.amount >= 0 ? '+' : ''}₹{tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {tx.credit > 0 ? `+₹${tx.credit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {tx.debit > 0 ? `-₹${tx.debit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {tx.currentBalance > 0
                      ? `+₹${tx.currentBalance.toFixed(2)}`
                      : `-₹${tx.currentBalance.toFixed(2)}`}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words max-w-md">
                    {tx.remarks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {allTransactions.length > 0 && (
            <div className="flex flex-col xs:flex-row items-center justify-between mt-4 gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Records per page:</span>
                <select
                  value={recordsPerPage}
                  onChange={e => handleRecordsPerPageChange(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  {[5, 10, 20, 50].map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
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
                {Math.min(indexOfLastRecord, allTransactions.length)} of{' '}
                {allTransactions.length} records
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreAccounts;
