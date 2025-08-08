"use client"

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
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowDown,
  ArrowUp,
  Edit
} from 'lucide-react';
import {
  collection,
  query,
  getDocs,
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  writeBatch,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { AccountTxType, StoreType } from '@/types/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface AdminDeck {
  recentTransactions: AccountTxType[];
}

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
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [settlementDescription, setSettlementDescription] = useState('');
  const [selectedStoreForSettlement, setSelectedStoreForSettlement] = useState<StoreType | null>(null);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  const fetchStores = async () => {
    try {
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const storesData = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoreType[];
      setStores(storesData);
      return storesData;
    } catch (err) {
      console.error('Error fetching stores:', err);
      throw err;
    }
  };

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stores first
      const storesData = await fetchStores();

      // Fetch transactions
      const txQuery = query(
        collection(db, 'AccountTx'),
        orderBy('createdAt', 'desc')
      );
      const txSnapshot = await getDocs(txQuery);

      // Process transactions
      const transactions: AccountTxType[] = [];
      txSnapshot.forEach(doc => {
        const txData = doc.data();
        const txDate = txData.createdAt instanceof Timestamp ? txData.createdAt.toDate() : new Date(txData.createdAt);

        const tx: AccountTxType = {
          id: doc.id,
          createdAt: txData.createdAt as Timestamp,
          storeName: txData.storeName || '',
          customerName: txData.customerName || '',
          customerMobile: txData.customerMobile || '',
          type: txData.type || 'settlement',
          amount: txData.amount || 0,
          debit: txData.debit || 0,
          adminCut: txData.adminCut || 0,
          credit: txData.credit || 0,
          balance: txData.balance || 0,
          remarks: txData.remarks || ''
        };

        transactions.push(tx);
      });

      // Prepare admin deck
      const adminDeck: AdminDeck = {
        recentTransactions: transactions
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

  const handleAddSettlement = async () => {
    if (!settlementAmount || !selectedStoreForSettlement) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsSubmittingSettlement(true);

      const amount = Number(settlementAmount);
      const newStoreBalance = (selectedStoreForSettlement.storeCurrentBalance || 0) + amount;

      // Create the transaction
      const newTx = {
        createdAt: Timestamp.now(),
        storeName: selectedStoreForSettlement.storeName,
        customerName: 'Admin',
        customerMobile: '',
        type: 'settlement',
        amount: Math.abs(amount),
        credit: amount > 0 ? Math.abs(amount) : 0,
        debit: amount < 0 ? Math.abs(amount) : 0,
        adminCut: 0,
        balance: newStoreBalance,
        remarks: settlementDescription || `Settlement adjustment for ${selectedStoreForSettlement.storeName}`
      };

      // Query for the store by name
      const storeQuery = query(
        collection(db, 'stores'),
        where('storeName', '==', selectedStoreForSettlement.storeName)
      );
      const storeSnapshot = await getDocs(storeQuery);
      
      if (storeSnapshot.empty) {
        throw new Error(`Store with name '${selectedStoreForSettlement.storeName}' not found`);
      }
      
      const storeDoc = storeSnapshot.docs[0];
      const storeRef = doc(db, 'stores', storeDoc.id);

      // Update store balance and add transaction in a batch
      const batch = writeBatch(db);

      // Add the new transaction
      const txRef = doc(collection(db, 'AccountTx'));
      batch.set(txRef, newTx);

      // Update store balance
      batch.update(storeRef, {
        storeCurrentBalance: newStoreBalance,
        updatedAt: Timestamp.now()
      });

      await batch.commit();

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
    setSelectedStoreForSettlement(null);
  };

  const openSettlementDialog = (store: StoreType) => {
    setSelectedStoreForSettlement(store);
    setIsSettlementDialogOpen(true);
  };

  const filteredTransactions = accountData?.recentTransactions.filter(tx => {
    const matchesSearch = tx.remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.customerMobile.includes(searchTerm);
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
          <p className="text-gray-600">Store balances and transaction history</p>
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

      {/* Store Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Store Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stores.map(store => (
              <Card key={store.id} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{store.storeName}</CardTitle>
                  <CardDescription>{store.storeLocation}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(store.storeCurrentBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(store.storeCurrentBalance || 0) >= 0 ? '+' : ''}
                    ₹{(store.storeCurrentBalance || 0).toFixed(2)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => openSettlementDialog(store)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Adjust Balance
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settlement Dialog */}
      <Dialog open={isSettlementDialogOpen} onOpenChange={setIsSettlementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adjust Balance for {selectedStoreForSettlement?.storeName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  placeholder="Enter amount"
                />
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettlementAmount(Math.abs(settlementAmount))}
                >
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Credit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettlementAmount(-Math.abs(settlementAmount))}
                >
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Debit
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={settlementDescription}
                onChange={(e) => setSettlementDescription(e.target.value)}
                placeholder="Reason for adjustment"
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
                <span className="ml-2">Apply Adjustment</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accounts History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>Transaction History</CardTitle>
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
                  <option key={store.id} value={store.storeName}>{store.storeName}</option>
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Admin Cut</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {formatTradeTimestamp(tx.createdAt)}
                      </TableCell>
                      <TableCell>
                        {tx.storeName}
                      </TableCell>
                      <TableCell>
                        {tx.customerName}
                      </TableCell>
                      <TableCell>
                        {tx.customerMobile}
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
                      <TableCell className="text-right">
                        {tx.adminCut > 0 ? `₹${tx.adminCut.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {tx.credit > 0 ? `+₹${tx.debit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {tx.debit > 0 ? `-₹${tx.credit.toFixed(2)}` : '-'}
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