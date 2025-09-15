import { format } from 'date-fns';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  DollarSign,
  Gift,
  Heart,
  History,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/auth-context'; // Import useAuth hook
import { db } from '@/lib/firebase';
import { CustomerTxType, SevaPoolType, StaffType } from '@/types/types';
import {
  useCustomers,
  useSevaPool,
  useTransactions,
  useInvalidateQueries,
} from '@/hooks/useFirebaseQueries';
import { useDebouncedSearch } from '@/hooks/useDebounce';

interface Customer {
  id?: string;
  name: string;
  mobile: string;
  storeLocation: string;
  sevaCoinsCurrentMonth: number;
  sevaCoinsTotal: number;
  demoStore: boolean;
}

// Safe timestamp conversion utility
function safeConvertToTimestamp(date: any): Timestamp {
  if (date instanceof Timestamp) {
    return date;
  }
  if (date?.toDate instanceof Function) {
    return Timestamp.fromDate(date.toDate());
  }
  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  }
  if (typeof date === 'string' || typeof date === 'number') {
    try {
      return Timestamp.fromDate(new Date(date));
    } catch {
      return Timestamp.now();
    }
  }
  return Timestamp.now();
}

// Safe date formatting utility
function safeFormatDate(date: any, dateFormat: string = 'dd MMM yyyy'): string {
  try {
    let jsDate: Date;
    if (date instanceof Timestamp) {
      jsDate = date.toDate();
    } else if (date instanceof Date) {
      jsDate = date;
    } else if (date?.toDate instanceof Function) {
      jsDate = date.toDate();
    } else {
      jsDate = new Date(date);
    }
    return format(jsDate, dateFormat);
  } catch {
    return 'Invalid date';
  }
}

export const GoSevaPool = () => {
  const { user } = useAuth(); // Get current user from auth context

  // Use caching hooks
  const { data: sevaPoolData, isLoading: sevaPoolLoading } = useSevaPool();
  const { data: customersData, isLoading: customersLoading } = useCustomers();
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions();
  const { invalidateSevaPool, invalidateCustomers, invalidateTransactions } =
    useInvalidateQueries();

  const [adminDetails, setAdminDetails] = useState<StaffType | null>(null);

  const [selectedStoreLocation, setSelectedStoreLocation] = useState<string>('All Locations');

  // Derived state from cached data
  const sevaPool = sevaPoolData || {
    currentSevaBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: Timestamp.now(),
    lastAllocatedDate: Timestamp.now(),
  };

  const customers = customersData || [];
  const transactions = transactionsData || [];
  const loading = sevaPoolLoading || customersLoading || transactionsLoading;

  // Get unique store locations
  const storeLocations = [
    'All Locations',
    ...new Set(customers.map(c => c.storeLocation).filter(Boolean)),
  ];

  // Filter transactions by store location
  const filteredTransactions =
    selectedStoreLocation === 'All Locations'
      ? transactions
      : transactions.filter(tx => tx.storeLocation === selectedStoreLocation);

  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationDescription, setAllocationDescription] = useState('');
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [selectedStoreForAllocation, setSelectedStoreForAllocation] = useState<string>('');

  // Fetch admin details
  const fetchAdminDetails = async () => {
    if (!user || user.role !== 'admin') return;

    try {
      const staffRef = collection(db, 'staff');
      const q = query(
        staffRef,
        where('staffMobile', '==', user.mobile),
        where('role', '==', 'admin')
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const staffDoc = querySnapshot.docs[0];
        setAdminDetails({
          id: staffDoc.id,
          ...staffDoc.data(),
        } as StaffType);
      }
    } catch (error) {
      // console.error('Error fetching admin details:', error);
    }
  };

  // Refresh data by invalidating caches
  const handleRefresh = async () => {
    try {
      await Promise.all([invalidateSevaPool(), invalidateCustomers(), invalidateTransactions()]);
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    }
  };

  // Store seva balances state
  const [storeSevaBalances, setStoreSevaBalances] = useState<{ [key: string]: number }>({});

  // Calculate top customers from cached transactions data
  const topCustomers = React.useMemo(() => {
    if (!transactions.length) return [];

    const customerContributions = transactions
      .filter(tx => tx.paymentMethod !== 'admin')
      .reduce((acc: Record<string, Customer>, tx) => {
        const mobile = tx.customerMobile;
        if (!acc[mobile]) {
          acc[mobile] = {
            name: tx.customerName,
            mobile,
            storeLocation: tx.storeLocation,
            sevaCoinsCurrentMonth: 0,
            sevaCoinsTotal: tx.sevaTotal || 0,
            demoStore: tx.demoStore || false,
          };
        }
        // Add sevaEarned if it exists
        if (tx.sevaEarned && tx.sevaEarned > 0) {
          acc[mobile].sevaCoinsCurrentMonth += tx.sevaEarned;
        }
        // Add sevaDebit if it exists (for transactions where seva coins were used)
        if (tx.sevaDebit && tx.sevaDebit > 0) {
          acc[mobile].sevaCoinsCurrentMonth += tx.sevaDebit;
        }
        return acc;
      }, {});

    return Object.values(customerContributions).sort(
      (a: Customer, b: Customer) => b.sevaCoinsCurrentMonth - a.sevaCoinsCurrentMonth
    );
  }, [transactions]);

  // Fetch store seva balances
  const fetchStoreSevaBalances = async () => {
    try {
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const storeBalances: { [key: string]: number } = {};

      storesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.storeName && data.storeSevaBalance !== undefined) {
          storeBalances[data.storeName] = data.storeSevaBalance;
        }
      });

      setStoreSevaBalances(storeBalances);
    } catch (error) {
      console.error('Error fetching store balances:', error);
    }
  };

  // Fetch admin details and store balances on mount
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAdminDetails();
      fetchStoreSevaBalances();
    }
  }, [user]);

  const handleAllocation = async () => {
    const amount = parseFloat(allocationAmount);

    if (!selectedStoreForAllocation) {
      toast.error('Please select a store for allocation');
      return;
    }

    const storeSevaBalance = storeSevaBalances[selectedStoreForAllocation] || 0;

    if (!amount || amount <= 0 || amount > storeSevaBalance) {
      toast.error(
        `Please enter a valid allocation amount (max: ₹${storeSevaBalance.toLocaleString()})`
      );
      return;
    }

    if (!allocationDescription.trim()) {
      toast.error('Please enter a description for the allocation');
      return;
    }

    if (!user || !adminDetails) {
      toast.error('Admin details not available');
      return;
    }

    try {
      // Update Seva Pool
      const poolRef = doc(db, 'SevaPool', 'main');
      const poolDoc = await getDoc(poolRef);
      const currentSevaPool = poolDoc.data();

      await updateDoc(poolRef, {
        currentSevaBalance: (currentSevaPool?.currentSevaBalance || 0) - amount,
        totalAllocations: (currentSevaPool?.totalAllocations || 0) + amount,
        allocationsCurrentMonth: (currentSevaPool?.allocationsCurrentMonth || 0) + amount,
        lastAllocatedDate: serverTimestamp(),
      });

      // Update store's Seva balance
      const storeQuery = query(
        collection(db, 'stores'),
        where('storeName', '==', selectedStoreForAllocation)
      );
      const storeSnapshot = await getDocs(storeQuery);

      if (!storeSnapshot.empty) {
        const storeDoc = storeSnapshot.docs[0];
        const storeData = storeDoc.data();
        await updateDoc(storeDoc.ref, {
          storeSevaBalance: storeSevaBalance - amount,
          storeUpdatedAt: serverTimestamp(),
        });

        // Update local state
        setStoreSevaBalances({
          ...storeSevaBalances,
          [selectedStoreForAllocation]: storeSevaBalance - amount,
        });

        // Store the demoStore value for later use
        var storeDemoStore = storeData.demoStore || false;
      } else {
        toast.error(`Store ${selectedStoreForAllocation} not found`);
        return;
      }

      // Create a record in CustomerTx for the allocation
      const timestamp = Timestamp.now();

      // Generate a unique invoice ID (timestamp + random string)
      const generateInvoiceId = () => {
        const timestamp = new Date().getTime();
        const randomStr = Number(Math.random().toFixed(2))
          .toString(36)
          .substring(2, 8)
          .toUpperCase();
        return `SEVA-${timestamp}-${randomStr}`;
      };

      await addDoc(collection(db, 'CustomerTx'), {
        type: 'seva_allocation', // Use the correct type from the interface
        customerMobile: adminDetails.staffMobile, // Use admin's mobile
        customerName: adminDetails.staffName, // Use admin's name
        storeLocation: selectedStoreForAllocation,
        storeName: selectedStoreForAllocation,
        createdAt: timestamp,
        paymentMethod: 'admin',
        processedBy: adminDetails.staffName,
        invoiceId: generateInvoiceId(),
        amount: amount,
        surabhiEarned: 0,
        sevaEarned: 0,
        referralEarned: 0,
        referredBy: null,
        surabhiUsed: 0,
        walletDeduction: 0,
        cashPayment: 0,
        previousBalance: {
          walletBalance: currentSevaPool?.currentSevaBalance || 0,
          surabhiBalance: 0,
        },
        newBalance: {
          walletBalance: Number(((currentSevaPool?.currentSevaBalance || 0) - amount).toFixed(2)),
          surabhiBalance: 0,
        },
        walletCredit: 0,
        walletDebit: amount, // Debit from the pool
        walletBalance: Number(((currentSevaPool?.currentSevaBalance || 0) - amount).toFixed(2)),
        surabhiDebit: 0,
        surabhiCredit: 0,
        surabhiBalance: 0,
        sevaCredit: 0,
        sevaDebit: amount, // Debit from the pool
        sevaBalance: Number((storeSevaBalances[selectedStoreForAllocation] - amount).toFixed(2)),
        sevaTotal: currentSevaPool?.totalContributions || 0,
        remarks: `${allocationDescription} (from ${selectedStoreForAllocation})`,
        demoStore: storeDemoStore,
      });

      // Also add to Activity log
      await addDoc(collection(db, 'Activity'), {
        type: 'seva_allocation',
        remarks: allocationDescription,
        credit: 0,
        debit: amount,
        amount: amount,
        customerName: adminDetails.staffName,
        customerMobile: adminDetails.staffMobile,
        storeLocation: adminDetails.storeLocation || 'All Stores',
        createdAt: timestamp,
      });

      setAllocationAmount('');
      setAllocationDescription('');
      setIsAllocationDialogOpen(false);
      toast.success(`₹${amount} allocated successfully`);

      // Refresh data to show the new transaction
      await handleRefresh();
      await fetchStoreSevaBalances();
    } catch (error) {
      // console.error('Error allocating funds:', error);
      toast.error('Failed to allocate funds');
    }
  };

  // Note: handleRefresh is already defined above with cache invalidation

  // No useEffect needed - data is automatically fetched by React Query hooks

  const monthlyStats = {
    totalContributions: transactions.reduce(
      (sum, tx) => sum + ((tx.demoStore === false && tx.sevaEarned) || 0),
      0
    ),
    totalAllocations: Number(sevaPool.allocationsCurrentMonth || 0),
    totalContributors: customers.filter(cust => cust.demoStore === false).length,
    avgContribution:
      customers.filter(cust => cust.demoStore === false).length > 0
        ? Number(
            (
              transactions
                .filter(tx => tx.demoStore === false)
                .reduce((sum, tx) => sum + ((tx.demoStore === false && tx.sevaEarned) || 0), 0) /
              customers.filter(cust => cust.demoStore === false).length
            ).toFixed(2)
          )
        : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-4 md:px-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Seva Pool Management</h2>
          <p className="text-sm sm:text-base text-gray-600">
            Manage community contribution pool and allocations
          </p>
          <p className="text-sm sm:text-base text-gray-600">
            This tab shows only Live Stores Details
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>

          <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 flex-1 sm:flex-none">
                <Gift className="h-4 w-4 mr-2" />
                Allocate Funds
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md mx-2 w-[calc(100%-1rem)] sm:w-full">
              <DialogHeader>
                <DialogTitle>Allocate Seva Funds</DialogTitle>
                <DialogDescription>
                  Allocate funds from the Seva pool for community welfare
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="store">Select Store</Label>
                  <select
                    id="store"
                    className="w-full p-2 border rounded-md"
                    value={selectedStoreForAllocation || ''}
                    onChange={e => setSelectedStoreForAllocation(e.target.value)}
                  >
                    <option value="">Select a store</option>
                    {storeLocations.map(store => (
                      <option key={store} value={store}>
                        {store} - ₹{(storeSevaBalances[store] || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>
                      {selectedStoreForAllocation
                        ? `${selectedStoreForAllocation} Seva Balance: ₹${(storeSevaBalances[selectedStoreForAllocation] || 0).toLocaleString()}`
                        : 'Select a store to see available balance'}
                    </strong>
                  </p>
                </div>

                {/* <div className="space-y-2">
                  <Label htmlFor="store">Select Store</Label>
                  <select
                    id="store"
                    className="w-full p-2 border rounded-md"
                    value={selectedStoreForAllocation}
                    onChange={e => setSelectedStoreForAllocation(e.target.value)}
                  >
                    <option value="">Select a store</option>
                    {Object.keys(storeSevaBalances).map(storeName => (
                      <option key={storeName} value={storeName}>
                        {storeName} - ₹{storeSevaBalances[storeName].toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {selectedStoreForAllocation && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Store Seva Balance: ₹{storeSevaBalances[selectedStoreForAllocation]?.toLocaleString() || 0}</strong>
                      </p>
                    </div>
                  )}
                </div> */}

                <div className="space-y-2">
                  <Label htmlFor="amount">Allocation Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={allocationAmount}
                    onChange={e => setAllocationAmount(e.target.value)}
                    max={
                      selectedStoreForAllocation ? storeSevaBalances[selectedStoreForAllocation] : 0
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Purpose/Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the allocation purpose"
                    value={allocationDescription}
                    onChange={e => setAllocationDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleAllocation}
                    className="flex-1"
                    disabled={
                      !selectedStoreForAllocation ||
                      !allocationAmount ||
                      parseFloat(allocationAmount) <= 0 ||
                      parseFloat(allocationAmount) >
                        (storeSevaBalances[selectedStoreForAllocation] || 0)
                    }
                  >
                    Allocate Funds
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsAllocationDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pool Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-red-50 border-red-200 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-600">Current Pool</span>
            </div>
            <p className="text-2xl font-bold text-red-900">
              ₹{(sevaPool.currentSevaBalance || 0).toFixed(2)}
            </p>
            <p className="text-xs text-red-600 mt-1">Available for allocation</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Monthly Contributions</span>
            </div>
            <p className="text-xl font-bold text-green-900">
              ₹{monthlyStats.totalContributions.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Contributors</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{monthlyStats.totalContributors}</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Avg Contribution</span>
            </div>
            <p className="text-xl font-bold text-purple-900">
              ₹{monthlyStats.avgContribution.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Total Allocated</span>
            </div>
            <p className="text-xl font-bold text-amber-900">
              ₹
              {typeof monthlyStats.totalAllocations === 'number'
                ? monthlyStats.totalAllocations.toFixed(2)
                : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-600" />
                Recent Seva Contributions
              </CardTitle>
              <CardDescription>Transactions with Seva contributions this month</CardDescription>
            </div>

            <div className="flex items-center gap-4">
              {/* <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {safeFormatDate(new Date(), 'MMMM yyyy')}
                </span>
              </div> */}

              <div className="flex items-center gap-2">
                <select
                  className="text-sm border rounded-md px-2 py-1 bg-white"
                  value={selectedStoreLocation}
                  onChange={e => setSelectedStoreLocation(e.target.value)}
                >
                  {storeLocations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <History className="h-8 w-8" />
              <p>
                No Seva contributions found for{' '}
                {selectedStoreLocation === 'All Locations' ? 'this month' : selectedStoreLocation}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Store
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seva Earned
                    </th>
                    <td className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seva Debit
                    </td>
                    {/* <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seva Balance</th> */}
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Store Seva
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {safeFormatDate(tx.createdAt)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">
                          {tx.customerName}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">{tx.customerMobile}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {tx.storeName || tx.storeLocation}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        ₹{tx.amount.toFixed(2)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-green-600">
                        ₹{(tx.sevaEarned || 0).toFixed(2)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-red-600">
                        ₹{(tx.sevaDebit || 0).toFixed(2)}
                      </td>
                      {/* <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                        ₹{(tx.sevaBalance || 0).toFixed(2)}
                      </td> */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                        ₹{(tx?.storeSevaBalance || 0).toFixed(2)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {tx.paymentMethod || 'recharge'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Contributors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-600" />
            Top Contributors This Month
          </CardTitle>
          <CardDescription>
            Customers who have contributed the most to the Seva Pool
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <Users className="h-8 w-8" />
              <p>No contributors found for this month</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map(customer => (
                <div
                  key={customer.customerMobile}
                  className="flex flex-col p-4 border rounded-lg gap-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="font-medium text-gray-700">
                        {(customer.customerName || '').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {customer.customerName || ''}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {customer.customerMobile || ''}
                      </p>
                      {customer.storeLocation && (
                        <p className="text-xs text-gray-500">{customer.storeLocation}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-500">Current Month Seva Contribution</p>
                      <p className="font-bold text-green-600">
                        ₹{(customer.sevaBalanceCurrentMonth || 0).toFixed(2)}
                      </p>
                    </div>
                    {/* <div className="space-y-1">
                      <p className="text-gray-500">Total Seva Contribution</p>
                      <p className="font-medium">
                        ₹{customer.sevaCoinsTotal.toFixed(2)}
                      </p>
                    </div> */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
