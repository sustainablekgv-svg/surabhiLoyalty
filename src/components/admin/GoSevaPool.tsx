import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Heart,
  TrendingUp,
  Calendar,
  Users,
  DollarSign,
  Gift,
  History,
  Download,
  Loader2,
  RefreshCw,
  Table
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth-context'; // Import useAuth hook

import { CustomerTxType, SevaPoolType, StaffType } from '@/types/types';

interface Customer {
  id?: string;
  name: string;
  mobile: string;
  storeLocation: string;
  sevaCoinsCurrentMonth: number;
  sevaCoinsTotal: number;
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
  const [adminDetails, setAdminDetails] = useState<StaffType | null>(null);
  const [sevaPool, setSevaPool] = useState<SevaPoolType>({
    currentSevaBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: Timestamp.now(),
    lastAllocatedDate: Timestamp.now()
  });

  const [transactions, setTransactions] = useState<CustomerTxType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationDescription, setAllocationDescription] = useState('');
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);

  // Fetch admin details
  const fetchAdminDetails = async () => {
    if (!user || user.role !== 'admin') return;
    
    try {
      const staffRef = collection(db, 'staff');
      const q = query(staffRef, 
        where('staffMobile', '==', user.mobile),
        where('role', '==', 'admin')
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const staffDoc = querySnapshot.docs[0];
        setAdminDetails({
          id: staffDoc.id,
          ...staffDoc.data()
        } as StaffType);
      }
    } catch (error) {
      console.error('Error fetching admin details:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch admin details if not already fetched
      if (!adminDetails && user) {
        await fetchAdminDetails();
      }
      
      // Fetch Seva Pool data
      const poolRef = doc(db, 'SevaPool', 'main');
      const poolSnapshot = await getDoc(poolRef);
      if (poolSnapshot.exists()) {
        const data = poolSnapshot.data();
        const poolData: SevaPoolType = {
          currentSevaBalance: data.currentBalance ?? 0,
          totalContributions: data.totalContributions ?? 0,
          totalAllocations: data.totalAllocations ?? 0,
          contributionsCurrentMonth: data.contributionsCurrentMonth ?? 0,
          allocationsCurrentMonth: data.allocationsCurrentMonth ?? 0,
          lastResetDate: safeConvertToTimestamp(data.lastResetDate),
          lastAllocatedDate: safeConvertToTimestamp(data.lastAllocatedDate)
        };
        setSevaPool(poolData);
      } else {
        toast.error('Seva Pool document not found');
      }

      // Fetch transactions with seva_contribution type and sevaEarned > 0
      const transactionsQuery = query(
        collection(db, 'CustomerTx'),
        // where('createdAt', '>=', startOfMonth(new Date())),
        // where('type', '==', 'seva_contribution'),
        where('sevaEarned', '>', 0)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionsData = transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          customerMobile: data.customerMobile,
          customerName: data.customerName,
          storeLocation: data.storeLocation,
          storeName: data.storeName,
          createdAt: safeConvertToTimestamp(data.createdAt),
          paymentMethod: data.paymentMethod,
          processedBy: data.processedBy,
          amount: data.amount,
          surabhiEarned: data.surabhiEarned,
          sevaEarned: data.sevaEarned,
          referralEarned: data.referralEarned,
          referredBy: data.referredBy,
          surabhiUsed: data.surabhiUsed,
          walletDeduction: data.walletDeduction,
          cashPayment: data.cashPayment,
          previousBalance: data.previousBalance,
          newBalance: data.newBalance,
          walletCredit: data.walletCredit,
          walletDebit: data.walletDebit,
          walletBalance: data.walletBalance,
          surabhiDebit: data.surabhiDebit,
          surabhiCredit: data.surabhiCredit,
          surabhiBalance: data.surabhiBalance,
          sevaCredit: data.sevaCredit,
          sevaDebit: data.sevaDebit,
          sevaBalance: data.sevaBalance,
          sevaTotal: data.sevaTotal
        } as CustomerTxType;
      });
      setTransactions(transactionsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));

      // Calculate top customers based on sevaEarned
      const customerContributions = transactionsData.reduce((acc: Record<string, Customer>, tx) => {
        const mobile = tx.customerMobile;
        if (!acc[mobile]) {
          acc[mobile] = {
            name: tx.customerName,
            mobile,
            storeLocation: tx.storeLocation,
            sevaCoinsCurrentMonth: 0,
            sevaCoinsTotal: tx.sevaTotal || 0
          };
        }
        acc[mobile].sevaCoinsCurrentMonth += tx.sevaEarned || 0;
        return acc;
      }, {});

      const topCustomers = Object.values(customerContributions)
        .sort((a, b) => b.sevaCoinsCurrentMonth - a.sevaCoinsCurrentMonth)
        .slice(0, 10); // Get top 10 customers

      setCustomers(topCustomers);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAllocation = async () => {
    const amount = parseFloat(allocationAmount);
    if (!amount || amount <= 0 || amount > sevaPool.currentSevaBalance) {
      toast.error('Please enter a valid allocation amount');
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
        currentBalance: (currentSevaPool?.currentBalance || 0) - amount,
        totalAllocations: (currentSevaPool?.totalAllocations || 0) + amount,
        allocationsCurrentMonth: (currentSevaPool?.allocationsCurrentMonth || 0) + amount,
        lastAllocatedDate: serverTimestamp()
      });

      // Create a record in CustomerTx for the allocation
      const timestamp = Timestamp.now();
      await addDoc(collection(db, 'CustomerTx'), {
        type: 'seva_allocation', // Use the correct type from the interface
        customerMobile: adminDetails.staffMobile, // Use admin's mobile
        customerName: adminDetails.staffName, // Use admin's name
        storeLocation: adminDetails.storeLocation,
        storeName: 'Go Seva Pool',
        createdAt: timestamp,
        paymentMethod: 'admin',
        processedBy: adminDetails.staffName,
        amount: amount,
        surabhiEarned: 0,
        sevaEarned: 0,
        referralEarned: 0,
        referredBy: null,
        surabhiUsed: 0,
        walletDeduction: 0,
        cashPayment: 0,
        previousBalance: {
          walletBalance: currentSevaPool?.currentBalance || 0,
          surabhiBalance: 0
        },
        newBalance: {
          walletBalance: (currentSevaPool?.currentBalance || 0) - amount,
          surabhiBalance: 0
        },
        walletCredit: 0,
        walletDebit: amount, // Debit from the pool
        walletBalance: (currentSevaPool?.currentBalance || 0) - amount,
        surabhiDebit: 0,
        surabhiCredit: 0,
        surabhiBalance: 0,
        sevaCredit: 0,
        sevaDebit: amount, // Debit from the pool
        sevaBalance: (currentSevaPool?.currentBalance || 0) - amount,
        sevaTotal: currentSevaPool?.totalContributions || 0,
        remarks: allocationDescription // Add description as remarks
      });

      // Also add to Activity log
      await addDoc(collection(db, 'Activity'), {
        type: 'seva_allocation',
        remarks: allocationDescription,
        amount: amount,
        customerName: adminDetails.staffName,
        customerMobile: adminDetails.staffMobile,
        storeLocation: adminDetails.storeLocation || 'All Stores',
        createdAt: timestamp
      });

      // Update state
      setSevaPool({
        ...sevaPool,
        currentSevaBalance: sevaPool.currentSevaBalance - amount,
        totalAllocations: sevaPool.totalAllocations + amount,
        allocationsCurrentMonth: sevaPool.allocationsCurrentMonth + amount,
        lastAllocatedDate: timestamp
      });

      setAllocationAmount('');
      setAllocationDescription('');
      setIsAllocationDialogOpen(false);
      toast.success(`₹${amount} allocated successfully`);
      
      // Refresh data to show the new transaction
      fetchData();
    } catch (error) {
      console.error('Error allocating funds:', error);
      toast.error('Failed to allocate funds');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [user]); // Re-fetch when user changes

  const monthlyStats = {
    totalContributions: transactions.reduce((sum, tx) => sum + (tx.sevaEarned || 0), 0),
    totalAllocations: Number(sevaPool.allocationsCurrentMonth || 0),
    totalContributors: customers.length,
    avgContribution: customers.length > 0
      ? transactions.reduce((sum, tx) => sum + (tx.sevaEarned || 0), 0) / customers.length
      : 0
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Go Seva Pool Management</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage community contribution pool and allocations</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="flex-1 sm:flex-none">
            {refreshing ? (
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
                <DialogTitle>Allocate Go Seva Funds</DialogTitle>
                <DialogDescription>
                  Allocate funds from the Go Seva pool for community welfare
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Available Pool: ₹{sevaPool.currentSevaBalance.toLocaleString()}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Allocation Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={allocationAmount}
                    onChange={(e) => setAllocationAmount(e.target.value)}
                    max={sevaPool.currentSevaBalance}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Purpose/Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the allocation purpose"
                    value={allocationDescription}
                    onChange={(e) => setAllocationDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleAllocation} className="flex-1">
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
            <p className="text-2xl font-bold text-red-900">₹{sevaPool.currentSevaBalance.toLocaleString()}</p>
            <p className="text-xs text-red-600 mt-1">Available for allocation</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Monthly Contributions</span>
            </div>
            <p className="text-xl font-bold text-green-900">₹{monthlyStats.totalContributions.toLocaleString()}</p>
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
            <p className="text-xl font-bold text-purple-900">₹{monthlyStats.avgContribution.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Total Allocated</span>
            </div>
            <p className="text-xl font-bold text-amber-900">₹{typeof monthlyStats.totalAllocations === 'number' ? monthlyStats.totalAllocations.toLocaleString() : '0'}</p>
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
              <CardDescription>
                Transactions with Seva contributions this month
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{safeFormatDate(new Date(), 'MMMM yyyy')}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <History className="h-8 w-8" />
              <p>No Seva contributions found for this month</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seva Earned</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {safeFormatDate(tx.createdAt)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">{tx.customerName}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{tx.customerMobile}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {tx.storeName || tx.storeLocation}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        ₹{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-green-600">
                        ₹{tx.sevaEarned?.toLocaleString() || 0}
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
                <div key={customer.mobile} className="flex flex-col p-4 border rounded-lg gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="font-medium text-gray-700">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600">{customer.mobile}</p>
                      {customer.storeLocation && (
                        <p className="text-xs text-gray-500">{customer.storeLocation}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-500">Current Month Seva Contribution</p>
                      <p className="font-bold text-green-600">
                        ₹{customer.sevaCoinsCurrentMonth.toFixed(2)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500">Total Seva Contribution</p>
                      <p className="font-medium">
                        ₹{customer.sevaCoinsTotal.toFixed(2)}
                      </p>
                    </div>
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