import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Edit,
  Plus
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

import { AccountTx, StoreSummary, AdminDeck, StoreType } from '@/types/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// // Updated interface to include settlement functionality
// export interface AdminDeck {
//   totalBalance: number;
//   recentTransactions: AccountTx[];
//   shopsSummary: StoreSummary[];
//   walletOverview: {
//     totalCredits: number;
//     totalDebits: number;
//     netFlow: number;
//   };
// }

// Helper function to format Firestore timestamp
const formatTradeTimestamp = (timestamp: Date | Timestamp): string => {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, 'MMM dd, yyyy HH:mm');
};

const Accounts = () => {
  const [accountData, setAccountData] = useState<AdminDeck | null>(null);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [updatingTx, setUpdatingTx] = useState<string | null>(null);
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [settlementDescription, setSettlementDescription] = useState('');
  const [settlementStore, setSettlementStore] = useState('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  const fetchAccountData = async () => {
    try {
      setLoading(true);

      // Fetch stores
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const storesData = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoreType[];
      setStores(storesData);

      // Fetch transactions
      const txQuery = query(
        collection(db, 'AccountTx'),
        orderBy('date', 'desc')
      );
      const txSnapshot = await getDocs(txQuery);

      // Process data
      const transactions: AccountTx[] = [];
      const storeSummaries: Record<string, StoreSummary> = {};
      let totalBalance = 0;
      let totalCredits = 0;
      let totalDebits = 0;

      txSnapshot.forEach(doc => {
        const txData = doc.data();
        const txDate = txData.date instanceof Timestamp ? txData.date.toDate() : new Date(txData.date);

        const tx: AccountTx = {
          id: doc.id,
          ...txData,
          date: Timestamp.fromDate(txDate),
          amount: txData.amount || 0,
          credit: txData.credit || 0,
          debit: txData.debit || 0,
          balance: txData.balance || 0,
          settled: txData.settled || false,
          description: txData.description || '',
          storeName: txData.storeName || '',
          type: txData.type || 'other'
        };

        transactions.push(tx);

        // Update store summary
        if (!storeSummaries[tx.storeName]) {
          storeSummaries[tx.storeName] = {
            storeName: tx.storeName,
            currentBalance: 0
          };
        }

        // Update totals
        totalCredits += tx.credit;
        totalDebits += tx.debit;
        totalBalance += tx.credit - tx.debit;
        storeSummaries[tx.storeName].currentBalance += tx.credit - tx.debit;
      });

      // Prepare admin deck
      const adminDeck: AdminDeck = {
        totalBalance,
        recentTransactions: transactions,
        shopsSummary: Object.values(storeSummaries),
        walletOverview: {
          totalCredits,
          totalDebits,
          netFlow: totalCredits - totalDebits
        }
      };

      setAccountData(adminDeck);

    } catch (err) {
      console.error('Error fetching account data:', err);
      setError('Failed to load account data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAccountData();
  };

  const handleSettledToggle = async (txId: string, settled: boolean) => {
    try {
      setUpdatingTx(txId);
      await updateDoc(doc(db, 'AccountTx', txId), {
        settled
      });
      fetchAccountData(); // Refresh data
    } catch (err) {
      console.error('Error updating transaction:', err);
      toast.error('Failed to update transaction status');
    } finally {
      setUpdatingTx(null);
    }
  };

  const handleAddSettlement = async () => {
    if (!settlementAmount || !settlementStore) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsSubmittingSettlement(true);
      // Create a settlement transaction
      const newTx: Omit<AccountTx, 'id'> = {
        date: Timestamp.now(),
        amount: Math.abs(settlementAmount),
        credit: settlementAmount > 0 ? Math.abs(settlementAmount) : 0,
        debit: settlementAmount < 0 ? Math.abs(settlementAmount) : 0,
        balance: accountData?.totalBalance || 0 + (settlementAmount > 0 ? Math.abs(settlementAmount) : -Math.abs(settlementAmount)),
        settled: true,
        description: settlementDescription || 'Manual settlement adjustment',
        storeName: settlementStore,
        type: 'settlement'
      };

      await addDoc(collection(db, 'AccountTx'), newTx);

      toast.success('Settlement transaction added successfully');
      fetchAccountData();
      setIsSettlementDialogOpen(false);
      resetSettlementForm();
    } catch (err) {
      console.error('Error adding settlement:', err);
      toast.error('Failed to add settlement transaction');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const resetSettlementForm = () => {
    setSettlementAmount(0);
    setSettlementDescription('');
    setSettlementStore('');
  };

  const filteredTransactions = accountData?.recentTransactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.storeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = selectedStore === 'all' || tx.storeName === selectedStore;
    return matchesSearch && matchesStore;
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetchAccountData();
  }, []);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Accounts Dashboard</h2>
          <p className="text-gray-600">Financial overview and transaction history</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="relative">
            <CardTitle className="text-sm font-medium text-gray-500">Total Balance</CardTitle>
            <CardDescription className="text-2xl font-bold">
              ₹{accountData?.totalBalance.toFixed(2) || '0.00'}
            </CardDescription>
            <Dialog open={isSettlementDialogOpen} onOpenChange={setIsSettlementDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-8 w-8"
                  title="Add settlement"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Settlement Transaction</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="store">Store</Label>
                    <Select
                      value={settlementStore}
                      onValueChange={setSettlementStore}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map(store => (
                          <SelectItem key={store.id} value={store.name}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={settlementAmount}
                      onChange={(e) => setSettlementAmount(Number(e.target.value))}
                      placeholder="Enter amount"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Positive for credit, negative for debit
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={settlementDescription}
                      onChange={(e) => setSettlementDescription(e.target.value)}
                      placeholder="Transaction description"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsSettlementDialogOpen(false);
                        resetSettlementForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddSettlement}
                      disabled={isSubmittingSettlement}
                    >
                      {isSubmittingSettlement ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      <span className="ml-2">Add Settlement</span>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Total Credits</CardTitle>
            <CardDescription className="text-2xl font-bold text-green-600">
              +₹{accountData?.walletOverview.totalCredits.toFixed(2) || '0.00'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Total Debits</CardTitle>
            <CardDescription className="text-2xl font-bold text-red-600">
              -₹{accountData?.walletOverview.totalDebits.toFixed(2) || '0.00'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Store Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Store Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {accountData?.shopsSummary.map(store => (
              <div key={store.storeName} className="border rounded-lg p-4">
                <h3 className="font-medium">{store.storeName}</h3>
                <p className={`text-xl mt-2 ${store.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {store.currentBalance >= 0 ? '+' : ''}
                  ₹{store.currentBalance.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accounts History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>Accounts History</CardTitle>
              <CardDescription>
                Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 w-full sm:w-64"
                />
              </div>

              <select
                value={selectedStore}
                onChange={(e) => {
                  setSelectedStore(e.target.value);
                  setCurrentPage(1);
                }}
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="all">All Stores</option>
                {stores.map(store => (
                  <option key={store.id} value={store.name}>{store.name}</option>
                ))}
              </select>

              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                {ITEMS_PER_PAGE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option} per page</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <Search className="h-8 w-8" />
              <p>No transactions found</p>
              {(searchTerm || selectedStore !== 'all') && (
                <Button variant="ghost" onClick={() => {
                  setSearchTerm('');
                  setSelectedStore('all');
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
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    {/* <TableHead>Settled</TableHead> */}
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {formatTradeTimestamp(tx.date)}
                      </TableCell>
                      <TableCell>
                        {tx.storeName}
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
                        {tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{tx.balance.toFixed(2)}
                      </TableCell>
                      {/* <TableCell>
                        {updatingTx === tx.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Checkbox
                            checked={!!tx.settled} 
                            onCheckedChange={(checked) => 
                              handleSettledToggle(tx.id, !!checked)
                            }
                            className="h-5 w-5 rounded-md"
                          />
                        )}
                      </TableCell>   */}
                      <TableCell className="max-w-xs truncate">
                        {tx.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Accounts;