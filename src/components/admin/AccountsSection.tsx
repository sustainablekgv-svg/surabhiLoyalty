'use client';

import { format } from 'date-fns';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { AccountTxType, StoreType } from '@/types/types';

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
  const [selectedStoreForSettlement, setSelectedStoreForSettlement] = useState<StoreType | null>(
    null
  );
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  const fetchStores = async () => {
    try {
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const storesData = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
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
      const txQuery = query(collection(db, 'AccountTx'), orderBy('createdAt', 'desc'));
      const txSnapshot = await getDocs(txQuery);

      // Process transactions
      const transactions: AccountTxType[] = [];
      txSnapshot.forEach(doc => {
        const txData = doc.data();
        const txDate =
          txData.createdAt instanceof Timestamp
            ? txData.createdAt.toDate()
            : new Date(txData.createdAt);

        const tx: AccountTxType = {
          id: doc.id,
          createdAt: txData.createdAt as Timestamp,
          storeName: txData.storeName || '',
          customerName: txData.customerName || '',
          customerMobile: txData.customerMobile || '',
          type: txData.type || 'settlement',
          amount: txData.amount || 0,
          debit: txData.debit || 0, // Keep for backward compatibility
          adminCut: txData.adminCut || 0,
          adminProfit: txData.adminProfit || 0,
          credit: txData.credit || 0, // Keep for backward compatibility
          currentBalance: txData.currentBalance || 0,
          sevaBalance: txData.sevaBalance || 0,
          adminCurrentBalance: txData.adminCurrentBalance || 0,
          remarks: txData.remarks || '',
        };

        transactions.push(tx);
      });

      // Prepare admin deck
      const adminDeck: AdminDeck = {
        recentTransactions: transactions,
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

      // For positive amounts: add to adminCurrentBalance, deduct from storeCurrentBalance
      // For negative amounts: deduct from adminCurrentBalance, add to storeCurrentBalance
      const newStoreBalance = (selectedStoreForSettlement.storeCurrentBalance || 0) - amount;
      const newAdminBalance = (selectedStoreForSettlement.adminCurrentBalance || 0) + amount;

      // Check if the amount is within the allowed range
      if (amount > 0 && amount > (selectedStoreForSettlement.storeCurrentBalance || 0)) {
        toast.error(
          `Amount exceeds store's current balance of ₹${selectedStoreForSettlement.storeCurrentBalance || 0}`
        );
        setIsSubmittingSettlement(false);
        return;
      }

      if (amount < 0 && Math.abs(amount) > (selectedStoreForSettlement.adminCurrentBalance || 0)) {
        toast.error(
          `Amount exceeds admin's current balance of ₹${selectedStoreForSettlement.adminCurrentBalance || 0}`
        );
        setIsSubmittingSettlement(false);
        return;
      }

      // Generate invoice ID for the settlement transaction
      const invoiceId = `STLMNT-${Date.now()}-${Number((Math.random() * 1000).toFixed(2))}`;

      // Create the transaction
      const newTx = {
        createdAt: Timestamp.now(),
        storeName: selectedStoreForSettlement.storeName,
        customerName: 'Admin',
        customerMobile: '',
        type: 'settlement',
        amount: Math.abs(amount),
        debit: amount >= 0 ? Math.abs(amount) : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
        adminCut: 0,
        adminProfit: 0,
        currentBalance: newStoreBalance,
        sevaBalance: selectedStoreForSettlement.storeSevaBalance || 0,
        adminCurrentBalance: newAdminBalance,
        // invoiceId: invoiceId,
        remarks:
          settlementDescription ||
          `Settlement adjustment ${amount >= 0 ? 'from store to admin' : 'from admin to store'} for ${selectedStoreForSettlement.storeName}`,
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
        adminCurrentBalance: newAdminBalance,
        updatedAt: Timestamp.now(),
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

  const filteredTransactions =
    accountData?.recentTransactions.filter(tx => {
      const matchesSearch =
        tx.remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      <div className="flex flex-col items-center justify-center h-64 gap-3 xs:gap-4">
        <p className="text-red-500 text-xs xs:text-sm sm:text-base">{error}</p>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4 justify-between items-start xs:items-center">
        <div>
          <h2 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900">
            Accounts Dashboard
          </h2>
          <p className="text-xs xs:text-sm text-gray-600">Store balances and transaction history</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm"
        >
          {refreshing ? (
            <Loader2 className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
          )}
          <span className="ml-1 xs:ml-1.5 sm:ml-2">Refresh</span>
        </Button>
      </div>

      {/* Store Balances */}
      <Card>
        <CardHeader className="pb-2 xs:pb-4 sm:pb-6">
          <CardTitle className="text-base xs:text-lg sm:text-xl">Store Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-3 sm:gap-4">
            {stores.map(store => (
              <Card key={store.id} className="relative">
                <CardHeader className="pb-1 xs:pb-1.5 sm:pb-2">
                  <CardTitle className="text-sm xs:text-base sm:text-lg">
                    {store.storeName}
                  </CardTitle>
                  <CardDescription className="text-xs xs:text-sm">
                    {store.storeLocation}
                  </CardDescription>
                  <CardDescription className="text-xs xs:text-sm">Admin Profit:</CardDescription>
                  <div
                    className={`text-base xs:text-xl sm:text-2xl font-bold ${(store.adminStoreProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {(store.adminStoreProfit || 0) >= 0 ? '+' : ''}₹
                    {(store.adminStoreProfit || 0).toFixed(2)}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs xs:text-sm">
                    Admin Current Balance:
                  </CardDescription>
                  <div
                    className={`text-base xs:text-xl sm:text-2xl font-bold ${(store.adminCurrentBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {(store.adminCurrentBalance || 0) >= 0 ? '+' : ''}₹
                    {(store.adminCurrentBalance || 0).toFixed(2)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 xs:mt-1.5 sm:mt-2 h-7 xs:h-8 sm:h-9 text-xs xs:text-sm"
                    onClick={() => openSettlementDialog(store)}
                  >
                    <Edit className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 mr-1 xs:mr-1.5 sm:mr-2" />
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
        <DialogContent className="max-w-[90vw] xs:max-w-[85vw] sm:max-w-[500px] p-3 xs:p-4 sm:p-6">
          <DialogHeader className="pb-2 xs:pb-3 sm:pb-4">
            <DialogTitle className="text-base xs:text-lg sm:text-xl">
              Balance Adjustment
            </DialogTitle>
            <DialogDescription className="text-xs xs:text-sm">
              Transfer funds between {selectedStoreForSettlement?.storeName} and Admin account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 xs:space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4 mb-2 xs:mb-3 sm:mb-4">
              <div>
                <Label className="text-xs xs:text-sm">Store Current Balance</Label>
                <div className="text-sm xs:text-base sm:text-lg font-semibold">
                  ₹{selectedStoreForSettlement?.storeCurrentBalance?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <Label className="text-xs xs:text-sm">Admin Current Balance</Label>
                <div className="text-sm xs:text-base sm:text-lg font-semibold">
                  ₹{selectedStoreForSettlement?.adminCurrentBalance?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>

            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2">
              <div className="flex-1 w-full xs:w-auto">
                <Label htmlFor="amount" className="text-xs xs:text-sm">
                  Transfer Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(Number(e.target.value))}
                  placeholder="Enter amount"
                  className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm"
                />
              </div>
              <div className="flex flex-row xs:flex-col gap-1 pt-0 xs:pt-1 w-full xs:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettlementAmount(Math.abs(settlementAmount))}
                  title="Transfer from store to admin"
                  className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm flex-1 xs:flex-auto"
                >
                  <ArrowUp className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 mr-0.5 xs:mr-1" />
                  Store to Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettlementAmount(-Math.abs(settlementAmount))}
                  title="Transfer from admin to store"
                  className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm flex-1 xs:flex-auto"
                >
                  <ArrowDown className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 mr-0.5 xs:mr-1" />
                  Admin to Store
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs xs:text-sm">
                Description
              </Label>
              <Input
                id="description"
                value={settlementDescription}
                onChange={e => setSettlementDescription(e.target.value)}
                placeholder="Reason for adjustment"
                className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm"
              />
            </div>

            {settlementAmount !== 0 && (
              <div className="grid grid-cols-2 gap-4 p-3 border rounded-md bg-gray-50">
                <div>
                  <Label>New Store Balance</Label>
                  <div
                    className={`text-lg font-semibold ${(selectedStoreForSettlement?.storeCurrentBalance || 0) - settlementAmount < 0 ? 'text-red-500' : ''}`}
                  >
                    ₹
                    {(
                      (selectedStoreForSettlement?.storeCurrentBalance || 0) - settlementAmount
                    ).toFixed(2)}
                  </div>
                </div>
                <div>
                  <Label>New Admin Balance</Label>
                  <div
                    className={`text-lg font-semibold ${(selectedStoreForSettlement?.adminCurrentBalance || 0) + settlementAmount < 0 ? 'text-red-500' : ''}`}
                  >
                    ₹
                    {(
                      (selectedStoreForSettlement?.adminCurrentBalance || 0) + settlementAmount
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

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
                disabled={
                  isSubmittingSettlement ||
                  !settlementAmount ||
                  (settlementAmount > 0 &&
                    settlementAmount > (selectedStoreForSettlement?.storeCurrentBalance || 0)) ||
                  (settlementAmount < 0 &&
                    Math.abs(settlementAmount) >
                      (selectedStoreForSettlement?.adminCurrentBalance || 0))
                }
              >
                {isSubmittingSettlement ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : settlementAmount > 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : settlementAmount < 0 ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="ml-2">
                  {settlementAmount > 0
                    ? 'Store → Admin'
                    : settlementAmount < 0
                      ? 'Admin → Store'
                      : 'Apply Adjustment'}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accounts History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-2 xs:gap-3 sm:gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle className="text-base xs:text-lg sm:text-xl">Transaction History</CardTitle>
              <CardDescription className="text-xs xs:text-sm">
                Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
              </CardDescription>
            </div>

            <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 w-full lg:w-auto">
              <div className="relative w-full xs:w-auto">
                <Search className="absolute left-3 xs:left-5 top-1/2 -translate-y-1/2 h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-gray-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 xs:pl-16 w-full xs:w-48 sm:w-64 h-8 xs:h-9 sm:h-10 text-xs xs:text-sm"
                />
              </div>

              <select
                value={selectedStore}
                onChange={e => {
                  setSelectedStore(e.target.value);
                  setCurrentPage(1);
                }}
                className="border rounded-md px-2 xs:px-2.5 sm:px-3 py-1.5 xs:py-2 text-xs xs:text-sm h-8 xs:h-9 sm:h-10 focus:outline-none focus:ring-2 focus:ring-gray-400 w-full xs:w-auto"
              >
                <option value="all">All Stores</option>
                {stores.map(store => (
                  <option key={store.id} value={store.storeName}>
                    {store.storeName}
                  </option>
                ))}
              </select>

              <select
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border rounded-md px-2 xs:px-2.5 sm:px-3 py-1.5 xs:py-2 text-xs xs:text-sm h-8 xs:h-9 sm:h-10 focus:outline-none focus:ring-2 focus:ring-gray-400 w-full xs:w-auto"
              >
                {ITEMS_PER_PAGE_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option} per page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 xs:py-8 sm:py-12 gap-1 xs:gap-2 text-gray-500">
              <Search className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8" />
              <p className="text-xs xs:text-sm sm:text-base">No transactions found</p>
              {(searchTerm || selectedStore !== 'all') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStore('all');
                  }}
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm mt-1 xs:mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table className="min-w-[600px] border-separate border-spacing-0 overflow-hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden md:table-cell text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Date
                    </TableHead>
                    <TableHead className="text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">Store</TableHead>
                    <TableHead className="hidden md:table-cell text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Customer
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Mobile
                    </TableHead>
                    <TableHead className="text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">Type</TableHead>
                    <TableHead className="text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Amount
                    </TableHead>
                    <TableHead className="text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Credit
                    </TableHead>
                    <TableHead className="text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Debit
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4 whitespace-nowrap">
                      Admin Cut
                    </TableHead>
                    <TableHead className="hidden xl:table-cell text-right whitespace-nowrap text-xs xs:text-sm py-2 xs:py-3 sm:py-4">Admin Profit</TableHead>
                    <TableHead className="text-right whitespace-nowrap text-xs xs:text-sm py-2 xs:py-3 sm:py-4">Store Balance</TableHead>
                    <TableHead className="text-right whitespace-nowrap text-xs xs:text-sm py-2 xs:py-3 sm:py-4">Admin Balance</TableHead>
                    <TableHead className="hidden md:table-cell whitespace-nowrap text-xs xs:text-sm py-2 xs:py-3 sm:py-4">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map(tx => (
                    <TableRow key={tx.id} className="group hover:bg-gray-50">
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {formatTradeTimestamp(tx.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        <div>{tx.storeName}</div>
                        <div className="md:hidden text-xs text-gray-500">
                          {formatTradeTimestamp(tx.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {tx.customerName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {tx.customerMobile}
                      </TableCell>
                      <TableCell className="py-2 xs:py-3 sm:py-4">
                        <Badge
                          variant={
                            tx.type === 'recharge'
                              ? 'default'
                              : tx.type === 'sale'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-[10px] xs:text-xs px-1 xs:px-2 py-0.5"
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {/* <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount >= 0 ? '+' : ''} */}
                        ₹{Math.abs(tx.amount).toFixed(2)}
                        {/* </span> */}
                      </TableCell>
                      <TableCell className="text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        <span className={tx.debit >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {tx.debit >= 0 ? '' : '+'}₹{Math.abs(tx.debit).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        <span className={tx.credit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.credit >= 0 ? '+' : ''}₹{Math.abs(tx.credit).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {tx.adminCut > 0 ? `₹${Number(tx.adminCut).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {Number(tx.adminProfit) && tx.adminProfit > 0
                          ? `₹${Number(tx.adminProfit).toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        ₹{tx?.currentBalance?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        ₹{tx?.adminCurrentBalance?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate text-xs xs:text-sm py-2 xs:py-3 sm:py-4">
                        {tx.remarks}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex flex-col xs:flex-row items-center justify-between mt-2 xs:mt-3 sm:mt-4 gap-2 xs:gap-0">
                <div className="text-xs xs:text-sm text-gray-600 order-2 xs:order-1">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-1 xs:gap-1.5 sm:gap-2 order-1 xs:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm px-1.5 xs:px-2 sm:px-3"
                  >
                    <ChevronLeft className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 mr-0.5 xs:mr-1" />
                    <span className="hidden xs:inline">Previous</span>
                    <span className="xs:hidden">Prev</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm px-1.5 xs:px-2 sm:px-3"
                  >
                    <span className="hidden xs:inline">Next</span>
                    <span className="xs:hidden">Next</span>
                    <ChevronRight className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 ml-0.5 xs:ml-1" />
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
