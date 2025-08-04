import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';
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
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const customerDoc = await getDoc(doc(db, 'Customers', userId));
        if (!customerDoc.exists()) {
          throw new Error('Customer not found');
        }

        const mobileNumber = customerDoc.data().mobile;
        const txQuery = query(
          collection(db, 'CustomerTx'),
          where('mobile', '==', mobileNumber),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(txQuery);
        const txData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CustomerTxType[];

        setTransactions(txData);
      } catch (err) {
        setError('Failed to fetch transactions');
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [userId]);

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
    tx.storeLocation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredTransactions.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredTransactions.length / recordsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

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
          onClick={() => window.location.reload()}
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
                {currentRecords.length > 0 ? (
                  currentRecords.map((tx) => (
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

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows per page:</span>
              <Select
                value={recordsPerPage.toString()}
                onValueChange={(value) => {
                  setRecordsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={recordsPerPage} />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};