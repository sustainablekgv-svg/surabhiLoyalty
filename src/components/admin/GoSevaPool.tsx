import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfMonth, isFirstDayOfMonth } from 'date-fns';
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
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

import { Customer, SevaPool, SevaTransaction } from '@/types/types';

export const GoSevaPool = () => {
  const [sevaPool, setSevaPool] = useState<SevaPool>({
    currentBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: serverTimestamp(),
    lastAllocatedDate: serverTimestamp()
  });
  
  const [transactions, setTransactions] = useState<SevaTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationDescription, setAllocationDescription] = useState('');
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);

  // Fetch data from Firestore
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Check if we need to reset monthly Seva coins
      await checkAndResetMonthlySevaCoins();
      
      // Fetch Seva Pool data
      const poolSnapshot = await getDocs(collection(db, 'SevaPool'));
      if (!poolSnapshot.empty) {
        const poolData = poolSnapshot.docs[0].data() as SevaPool;
        setSevaPool(poolData);
      }
      
      // Fetch transactions
      const transactionsQuery = query(
        collection(db, 'SevaTransaction'),
        where('date', '>=', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SevaTransaction[];
      setTransactions(
        transactionsData.sort((a, b) => {
          const getJsDate = (date: any) => {
            if (date && typeof date === 'object' && typeof date.toDate === 'function') {
              return date.toDate();
            } else if (typeof date === 'string' || typeof date === 'number' || date instanceof Date) {
              return new Date(date);
            }
            return new Date(0); // fallback to epoch if invalid
          };
          return getJsDate(b.date).getTime() - getJsDate(a.date).getTime();
        })
      );
      
      // Fetch customers who have contributed this month
      const customersQuery = query(
        collection(db, 'customers'),
        where('sevaCoinsCurrentMonth', '>', 0)
      );
      const customersSnapshot = await getDocs(customersQuery);
      const customersData = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as unknown as Customer[];
      setCustomers(customersData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Check if it's the first day of month and reset Seva coins if needed
  const checkAndResetMonthlySevaCoins = async () => {
    if (isFirstDayOfMonth(new Date())) {
      try {
        // Get all customers with sevaCoinsCurrentMonth > 0
        const customersQuery = query(
          collection(db, 'customers'),
          where('sevaCoinsCurrentMonth', '>', 0)
        );
        const snapshot = await getDocs(customersQuery);
        
        // Create a batch to update all customers
        const batch = writeBatch(db);
        snapshot.forEach(doc => {
          const customerRef = doc.ref;
          batch.update(customerRef, { 
            sevaCoinsCurrentMonth: 0,
            sevaCoinsTotal: doc.data().sevaCoinsTotal // Keep total count
          });
        });
        
        // Update Seva Pool reset date and reset monthly counts
        const poolRef = doc(collection(db, 'sevaPool'), 'current');
        batch.update(poolRef, { 
          lastResetDate: serverTimestamp(),
          contributionsCurrentMonth: 0,
          allocationsCurrentMonth: 0
        });
        
        await batch.commit();
        toast.success('Monthly Seva coins reset successfully');
      } catch (error) {
        console.error('Error resetting monthly Seva coins:', error);
        toast.error('Failed to reset monthly Seva coins');
      }
    }
  };

  // Handle allocation from Seva Pool
  const handleAllocation = async () => {
    const amount = parseFloat(allocationAmount);
    if (!amount || amount <= 0 || amount > sevaPool.currentBalance) {
      toast.error('Please enter a valid allocation amount');
      return;
    }

    if (!allocationDescription.trim()) {
      toast.error('Please provide a description for the allocation');
      return;
    }

    try {
      // Create new transaction
      const newTransaction: Omit<SevaTransaction, 'id'> = {
        type: 'allocation',
        amount: -amount,
        description: allocationDescription,
        date: serverTimestamp(),
        monthYear: format(new Date(), 'yyyy-MM')
      };

      // Add transaction to Firestore
      const docRef = await addDoc(collection(db, 'sevaTransactions'), newTransaction);
      
      // Update Seva Pool
      const poolRef = doc(collection(db, 'sevaPool'), 'current');
      await updateDoc(poolRef, {
        currentBalance: sevaPool.currentBalance - amount,
        totalAllocations: sevaPool.totalAllocations + amount,
        allocationsCurrentMonth: sevaPool.allocationsCurrentMonth + amount,
        lastAllocatedDate: serverTimestamp()
      });

      // Update local state
      setTransactions([{ id: docRef.id, ...newTransaction }, ...transactions]);
      setSevaPool({
        ...sevaPool,
        currentBalance: sevaPool.currentBalance - amount,
        totalAllocations: sevaPool.totalAllocations + amount,
        allocationsCurrentMonth: sevaPool.allocationsCurrentMonth + amount,
        lastAllocatedDate: serverTimestamp()
      });
      
      setAllocationAmount('');
      setAllocationDescription('');
      setIsAllocationDialogOpen(false);
      toast.success(`₹${amount} allocated successfully`);
    } catch (error) {
      console.error('Error allocating funds:', error);
      toast.error('Failed to allocate funds');
    }
  };

  // Refresh data
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate monthly stats using the sevaPool contributionsCurrentMonth
  const monthlyStats = {
    totalContributions: sevaPool.contributionsCurrentMonth,
    totalAllocations: sevaPool.allocationsCurrentMonth,
    contributorCount: customers.length,
    avgContribution: customers.length > 0 
      ? sevaPool.contributionsCurrentMonth / customers.length
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Go Seva Pool Management</h2>
          <p className="text-gray-600">Manage community contribution pool and allocations</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>

          <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600">
                <Gift className="h-4 w-4 mr-2" />
                Allocate Funds
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Allocate Go Seva Funds</DialogTitle>
                <DialogDescription>
                  Allocate funds from the Go Seva pool for community welfare
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Available Pool: ₹{sevaPool.currentBalance.toLocaleString()}</strong>
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
                    max={sevaPool.currentBalance}
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
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Pool Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-red-50 border-red-200 md:col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-600">Current Pool</span>
            </div>
            <p className="text-2xl font-bold text-red-900">₹{sevaPool.currentBalance.toLocaleString()}</p>
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
            <p className="text-xl font-bold text-blue-900">{monthlyStats.contributorCount}</p>
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
            <p className="text-xl font-bold text-amber-900">₹{monthlyStats.totalAllocations.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-600" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Latest contributions and allocations
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{format(new Date(), 'MMMM yyyy')}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
                <History className="h-8 w-8" />
                <p>No transactions found for this month</p>
              </div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      transaction.type === 'contribution' 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {transaction.type === 'contribution' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <Gift className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>
                          {(() => {
                            // Firestore Timestamp compatibility
                            const dateValue = transaction.date;
                            let jsDate: Date;
                            if (
                              dateValue &&
                              typeof dateValue === 'object' &&
                              typeof (dateValue as any).toDate === 'function'
                            ) {
                              jsDate = (dateValue as any).toDate();
                            } else if (
                              typeof dateValue === 'string' ||
                              typeof dateValue === 'number' ||
                              dateValue instanceof Date
                            ) {
                              jsDate = new Date(dateValue);
                            } else {
                              // Fallback for unsupported types (e.g., FieldValue)
                              return 'N/A';
                            }
                            return format(jsDate, 'dd MMM yyyy');
                          })()}
                        </span>
                        {transaction.customerName && (
                          <>
                            <span>•</span>
                            <span>{transaction.customerName}</span>
                            {transaction.storeLocation && (
                              <>
                                <span>•</span>
                                <span>{transaction.storeLocation}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.amount > 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount).toLocaleString()}
                    </p>
                    <Badge variant={transaction.type === 'contribution' ? 'default' : 'destructive'} className="mt-1">
                      {transaction.type}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
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
            Customers who have contributed to the Seva Pool
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <Users className="h-8 w-8" />
              <p>No contributors found for this month</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map(customer => (
                <div key={customer.mobile} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="font-medium text-gray-700">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.mobile}</p>
                    {customer.storeLocation && (
                      <p className="text-xs text-gray-500">{customer.storeLocation}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      ₹{(customer.sevaCoinsCurrentMonth * 0.075).toFixed(2)}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {customer.sevaCoinsCurrentMonth} coins
                    </Badge>
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