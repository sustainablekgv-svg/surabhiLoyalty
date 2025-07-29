import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Search,
  DollarSign,
  Coins,
  CheckCircle,
  Phone,
  Loader2,
  Mail,
  HandCoins,
  MapPin,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp, doc, getDoc, Timestamp, arrayUnion, increment } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Customer, WalletRechargeProps, ActivityType, StoreType, RechargeRecord, AccountTx, SevaPool, StaffType, CustomerTx } from '@/types/types';
import { FieldValue } from 'firebase/firestore';
import { useAuth } from '@/hooks/auth-context';

function getCurrentQuarterStart(): Date {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  if (month < 3) return new Date(year, 0, 1); // Q1
  if (month < 6) return new Date(year, 3, 1); // Q2
  if (month < 9) return new Date(year, 6, 1); // Q3
  return new Date(year, 9, 1); // Q4
}

function isNewQuarter(customer: Customer): boolean {
  if (!customer.currentQuarterStart) return true;
  const lastQuarterStart = customer.currentQuarterStart.toDate();
  const currentQuarterStart = getCurrentQuarterStart();
  return currentQuarterStart > lastQuarterStart;
}

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

export const WalletRecharge = ({ storeLocation }: WalletRechargeProps) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  console.log("The storeLocation is", user.storeLocation);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // const [staffPin, setStaffPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [storeDetails, setStoreDetails] = useState<StoreType | null>(null);
  // const [hasReferrer, setHasReferrer] = useState<Boolean> (false);

  const [sevaPool, setSevaPool] = useState<SevaPool>({
    currentBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: Timestamp.now(),
    lastAllocatedDate: Timestamp.now()
  });

  // Check if staff and customer are from same store
  const isSameStore = (customer: Customer | null): boolean => {
    if (!customer || !user) return false;
    return customer.storeLocation === user.storeLocation;
  };

  // Get store match status for display
  const getStoreMatchStatus = (customer: Customer | null) => {
    if (!customer || !user) {
      return { isMatch: false, message: 'No customer selected', icon: MapPin, color: 'text-gray-500' };
    }

    const isMatch = customer.storeLocation === user.storeLocation;

    if (isMatch) {
      return {
        isMatch: true,
        message: `Same Store: ${customer.storeLocation}`,
        icon: Shield,
        color: 'text-green-600'
      };
    } else {
      return {
        isMatch: false,
        message: `Different Stores: Staff (${user.storeLocation}) ≠ Customer (${customer.storeLocation})`,
        icon: AlertTriangle,
        color: 'text-red-600'
      };
    }
  };

  // Fetch Seva Pool data
  const fetchData = async () => {
    const poolRef = doc(db, 'SevaPool', 'main');
    const poolSnapshot = await getDoc(poolRef);
    if (poolSnapshot.exists()) {
      const data = poolSnapshot.data();
      const poolData: SevaPool = {
        currentBalance: data.currentBalance ?? 0,
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
  }
  fetchData();
  // Fetch customers and store details from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch store details first
        const q = query(
          collection(db, 'stores'),
          where('name', '==', storeLocation) // exact match
        );

        const querySnapshotStores = await getDocs(q);
        if (!querySnapshotStores.empty) {
          querySnapshotStores.forEach((doc) => {
            setStoreDetails(doc.data() as StoreType);
          });
        } else {
          toast.error('No stores found with that name');
        }

        // Then fetch customers
        const customersCollection = collection(db, 'customers');
        const querySnapshot = await getDocs(customersCollection);
        const customersData = querySnapshot.docs.map(doc => ({
          ...doc.data() as Customer,
          mobile: doc.data().mobile // Using mobile as identifier
        }));
        setCustomers(customersData);
      } catch (error) {
        toast.error('Failed to fetch data');
        console.error('Error fetching data:', error);
      } finally {
        setIsFetchingCustomers(false);
      }
    };

    fetchData();
  }, [storeLocation]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const calculateCommissions = (amount: number) => {
    if (!storeDetails) return { surabhiCoins: 0, sevaAmount: 0 };

    const surabhiCoins = Math.floor(amount * (storeDetails.surabhiCommission / 100));
    const sevaAmount = Math.floor(amount * (storeDetails.sevaCommission / 100));
    const referralAmount = Math.floor(amount * (storeDetails.referralCommission / 100));
    return { surabhiCoins, sevaAmount, referralAmount };
  };

  const rechargeAmountNum = parseFloat(rechargeAmount) || 0;
  const { surabhiCoins: surabhiCoinsEarned, sevaAmount: sevaAmountEarned, referralAmount: referralAmount } = calculateCommissions(rechargeAmountNum);

  const addActivityRecord = async (activityData: Omit<ActivityType, 'id' | 'date'>) => {
    try {
      await addDoc(collection(db, 'Activity'), {
        ...activityData,
        date: new Date()
      });
    } catch (error) {
      console.error('Error adding activity record:', error);
      toast.error('Failed to log activity');
    }
  };

  // const verifyStaffPin = async () => {
  //   return staffPin.length === 4 && /^\d+$/.test(staffPin) && `${import.meta.env.VITE_FIREBASE_API_KEY}`;
  // };

  const needsMonthlyReset = (lastTransactionDate: FieldValue | Date | string | null): boolean => {
    if (!lastTransactionDate) return true;

    let lastDate: Date;

    if (lastTransactionDate instanceof Date) {
      lastDate = lastTransactionDate;
    } else if (typeof lastTransactionDate === 'string') {
      lastDate = new Date(lastTransactionDate);
    } else {
      return false;
    }

    const currentDate = new Date();

    return lastDate.getMonth() !== currentDate.getMonth() ||
      lastDate.getFullYear() !== currentDate.getFullYear();
  };

  const processRecharge = async () => {
    if (!selectedCustomer || !rechargeAmount || !storeDetails) {
      setIsLoading(false);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setIsLoading(true); // Ensure both are set when starting

    try {

      // toast.loading('Processing recharge...');

      // Find customer document by mobile number
      const customersCollection = collection(db, 'customers');
      const q = query(customersCollection, where('mobile', '==', selectedCustomer.mobile));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Customer not found in database');
      }

      const customerDoc = querySnapshot.docs[0];
      const currentData = customerDoc.data() as Customer;

      // Handle lastTransactionDate properly
      const lastTransactionDate = currentData.lastTransactionDate || null;
      const resetMonthlyFields = needsMonthlyReset(lastTransactionDate);
      // const currentTimestamp = new Date();

      // Prepare update data
      const updateData: Partial<Customer> = {
        walletBalance: currentData.walletBalance + rechargeAmountNum,
        surabhiCoins: currentData.surabhiCoins + surabhiCoinsEarned,
        sevaCoinsTotal: (currentData.sevaCoinsTotal || 0) + sevaAmountEarned,
        lastTransactionDate: Timestamp.fromDate(new Date()),
        saleElgibility: true,
        quarterlyPurchaseTotal: (currentData.quarterlyPurchaseTotal || 0) + rechargeAmountNum,
      };

      if (updateData.quarterlyPurchaseTotal >= 2000 && currentData.coinsFrozen) {
        updateData.coinsFrozen = false;
      }

      // Handle monthly fields
      if (resetMonthlyFields) {
        updateData.walletBalanceCurrentMonth = rechargeAmountNum;
        updateData.surabhiCoinsCurrentMonth = surabhiCoinsEarned;
        updateData.sevaCoinsCurrentMonth = sevaAmountEarned;
      } else {
        updateData.walletBalanceCurrentMonth = (currentData.walletBalanceCurrentMonth || 0) + rechargeAmountNum;
        updateData.surabhiCoinsCurrentMonth = (currentData.surabhiCoinsCurrentMonth || 0) + surabhiCoinsEarned;
        updateData.sevaCoinsCurrentMonth = (currentData.sevaCoinsCurrentMonth || 0) + sevaAmountEarned;
      }

      // Update customer document in Firestore
      await updateDoc(customerDoc.ref, updateData);

      const rechargeData: Omit<RechargeRecord, 'id'> = {
        customerMobile: selectedCustomer.mobile,
        customerName: selectedCustomer.name,
        amount: rechargeAmountNum,
        storeLocation: storeLocation,
        staffName: user.name,
        storeName: storeDetails.name,
        surabhiCoinsEarned: surabhiCoinsEarned,
        sevaAmountEarned: sevaAmountEarned,
        timestamp: Timestamp.fromDate(new Date()),
        paymentMethod: 'cash', // Adjust as needed
      };

      const rechargeRef = await addDoc(collection(db, 'recharges'), rechargeData);

      const accountTxData: Omit<AccountTx, 'id'> = {
        date: Timestamp.fromDate(new Date()),
        storeName: storeDetails.name,
        type: 'recharge',
        amount: rechargeAmountNum,
        credit: rechargeAmountNum,
        adminCut: 0,
        debit: 0,
        balance: storeDetails.currentBalance + rechargeAmountNum, // rechargeAmountnUm+previosu Balance storeSummary + credit
        description: `Recharge for ${selectedCustomer.name} (${selectedCustomer.mobile})`,
        settled: false
      };

      await addDoc(collection(db, 'AccountTx'), accountTxData);

      // Update store balance
      const storeQuery = query(
        collection(db, 'stores'),
        where('name', '==', user.storeLocation)
      );
      const storeSnapshot = await getDocs(storeQuery);
      console.log("storeSnapshot in line 330 is", storeSnapshot);
      if (!storeSnapshot.empty) {
        const storeDoc = storeSnapshot.docs[0];
        await updateDoc(storeDoc.ref, {
          currentBalance: accountTxData.balance,
          updatedAt: serverTimestamp()
        });
      }

      // Create CustomerTx record
      const customerTxData: Omit<CustomerTx, 'id'> = {
        createdAt: Timestamp.fromDate(new Date()),
        mobile: selectedCustomer.mobile,
        storeLocation: storeLocation,
        walletCredit: rechargeAmountNum,
        walletDebit: 0,
        walletBalance: currentData.walletBalance + rechargeAmountNum,
        surabhiDebit: 0,
        surabhiCredit: surabhiCoinsEarned,
        surabhiBalance: currentData.surabhiCoins + surabhiCoinsEarned,
        sevaCredit: sevaAmountEarned,
        sevaDebit: 0,
        sevaBalance: (currentData.sevaCoinsCurrentMonth || 0) + sevaAmountEarned,
        sevaTotal: (currentData.sevaCoinsTotal || 0) + sevaAmountEarned
      };

      await addDoc(collection(db, 'CustomerTx'), customerTxData);

      const staffCollection = collection(db, 'staff');
      const staffQuery = query(staffCollection, where('mobile', '==', user.mobile));
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        throw new Error('Staff member not found in database');
      }

      const staffDoc = staffSnapshot.docs[0];
      const staffRef = staffDoc.ref;

      // Validate updateData against StaffType interface
      const staffUpdates: Partial<StaffType> = {
        rechargesCount: increment(1) as unknown as number,
        lastActive: Timestamp.fromDate(new Date())
      };

      await updateDoc(staffRef, staffUpdates);

      // Handle referral Surabhi Coins if customer has a referrer
      if (currentData.referredBy && referralAmount > 0) {
        // Find referrer's document
        const referrerQuery = query(customersCollection, where('mobile', '==', currentData.referredBy));
        const referrerSnapshot = await getDocs(referrerQuery);
        // console.log("The line 188 data is", referrerSnapshot);

        if (!referrerSnapshot.empty) {
          const referrerDoc = referrerSnapshot.docs[0];
          const referrerData = referrerDoc.data() as Customer;

          const newReferredUser = {
            mobile: currentData.mobile,
            name: currentData.name,
            referralDate: new Date(), // Use regular Date here
          };

          console.log('currentData:', currentData);
          console.log('newReferredUser:', newReferredUser);
          console.log('referralAmount:', referralAmount);

          // Update referrer's data
          await updateDoc(referrerDoc.ref, {
            surabhiCoins: increment(referralAmount),
            referralSurabhi: increment(referralAmount),
            referredUsers: arrayUnion(newReferredUser)
          });

          const poolRef = doc(db, 'SevaPool', 'main');
          const poolDoc = await getDoc(poolRef);
          const sevaPool = poolDoc.data();

          await updateDoc(poolRef, {
            currentBalance: (sevaPool?.currentBalance || 0) + sevaAmountEarned,
            totalAllocations: sevaPool.totalAllocations,
            allocationsCurrentMonth: sevaPool.allocationsCurrentMonth,
            lastAllocatedDate: serverTimestamp()
          });

          // Add activity record for referrer
          await addActivityRecord({
            type: 'referral',
            description: `Earned ₹${referralAmount} referral income from ${currentData.name}'s recharge`,
            amount: referralAmount,
            user: currentData.referredBy,
            location: storeLocation
          });
        }
      }

      // If this was their first recharge, add a special activity
      if (currentData.walletRechargeDone === false) {
        await addActivityRecord({
          type: 'signup',
          description: `${selectedCustomer.name} successfully registered`,
          amount: 0,
          user: selectedCustomer.mobile,
          location: storeLocation
        });

        await addActivityRecord({
          type: 'recharge',
          description: `${selectedCustomer.name} recharged for the first time`,
          amount: rechargeAmountNum,
          user: selectedCustomer.mobile,
          location: storeLocation
        });
      }

      // Add activity records for the recharge and commissions
      await addActivityRecord({
        type: 'recharge',
        description: `${selectedCustomer.name} made Wallet recharge of ₹${rechargeAmountNum}`,
        amount: rechargeAmountNum,
        user: selectedCustomer.mobile,
        location: storeLocation
      });

      await addActivityRecord({
        type: 'surabhi_earn',
        description: `${selectedCustomer.name} Earned ${surabhiCoinsEarned} Surabhi Coins from recharge`,
        amount: surabhiCoinsEarned,
        user: selectedCustomer.mobile,
        location: storeLocation
      });

      // Add activity records for the recharge and commissions
      if (selectedCustomer.referredBy) {
        await addActivityRecord({
          type: 'referral',
          description: `${selectedCustomer.referredBy} - Earned Surabhi Referral of ₹${referralAmount}`,
          amount: rechargeAmountNum,
          user: selectedCustomer.referredBy,
          location: storeLocation
        });
      }

      // await addActivityRecord({
      //   type: 'recharge',
      //   description: `Earned ${surabhiCoinsEarned} Surabhi Coins from recharge`,
      //   amount: surabhiCoinsEarned,
      //   user: selectedCustomer.mobile,
      //   location: storeLocation
      // });

      await addActivityRecord({
        type: 'contribution',
        description: `${selectedCustomer.name} contributed ₹${sevaAmountEarned} to Seva Pool from recharge`,
        amount: sevaAmountEarned,
        user: selectedCustomer.mobile,
        location: storeLocation
      });

      // Update local state for selected customer
      const updatedCustomers = customers.map(c => {
        if (c.mobile === selectedCustomer.mobile) {
          return {
            ...c,
            walletBalance: c.walletBalance + rechargeAmountNum,
            surabhiCoins: c.surabhiCoins + surabhiCoinsEarned,
            sevaCoinsTotal: (c.sevaCoinsTotal || 0) + sevaAmountEarned,
            walletBalanceCurrentMonth: resetMonthlyFields
              ? rechargeAmountNum
              : (c.walletBalanceCurrentMonth || 0) + rechargeAmountNum,
            surabhiCoinsCurrentMonth: resetMonthlyFields
              ? surabhiCoinsEarned
              : (c.surabhiCoinsCurrentMonth || 0) + surabhiCoinsEarned,
            sevaCoinsCurrentMonth: resetMonthlyFields
              ? sevaAmountEarned
              : (c.sevaCoinsCurrentMonth || 0) + sevaAmountEarned,
            lastTransactionDate: Timestamp.fromDate(new Date()),
            walletRechargeDone: true
          };
        }
        return c;
      });

      setCustomers(updatedCustomers);

      let successMessage = `₹${rechargeAmountNum.toLocaleString()} recharged successfully!`;
      let successDescription = `Customer earned ${surabhiCoinsEarned} Surabhi Coins and ₹${sevaAmountEarned} Seva Wallet`;

      if (selectedCustomer.referredBy && referralAmount > 0) {
        successDescription += ` | Referrer earned ₹${referralAmount}`;
      }

      toast.success(successMessage, {
        description: successDescription,
      });

      toast.success(`Recharge of ₹${rechargeAmountNum} completed!`, {
        description: `Receipt #${rechargeRef.id}`,
      });

      // Reset form
      setRechargeAmount('');
      setSelectedCustomer(null);
      setSearchTerm('');
      // setStaffPin('');
      setShowConfirmation(false);
    } catch (error) {
      toast.error('Recharge failed. Please try again.');
      console.error('Recharge error:', error);
    } finally {
      setIsProcessing(false);
      setIsLoading(false);
    }
  };

  const handleRechargeClick = () => {
    if (!selectedCustomer || !rechargeAmount) {
      toast.error('Please select a customer and enter recharge amount');
      return;
    }

    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount)) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount < 2000) {
      toast.error('Minimum recharge amount is ₹2,000');
      return;
    }

    if (amount > 50000) {
      toast.error('Maximum recharge amount is ₹50,000');
      return;
    }

    setShowConfirmation(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <Wallet className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wallet Recharge</h2>
          <p className="text-gray-600">Recharge customer wallets at {storeLocation}</p>
          {storeDetails && (
            <div className="flex gap-4 mt-2 text-sm">
              <Badge variant="outline" className="border-green-200 text-red-800">
                Surabhi: {storeDetails.surabhiCommission}%
              </Badge>
              <Badge variant="outline" className="border-blue-200 text-blue-800">
                Referral: {storeDetails.referralCommission}%
              </Badge>
              <Badge variant="outline" className="border-blue-200 text-green-800">
                Cash Only: {storeDetails.cashOnlyCommission}%
              </Badge>
              <Badge variant="outline" className="border-blue-200 text-purple-800">
                Seva: {storeDetails.sevaCommission}%
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Selection */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Select Customer
            </CardTitle>
            <CardDescription>
              Search by name, mobile or email to find customers
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, mobile or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {isFetchingCustomers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.mobile}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setRechargeAmount('');
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedCustomer?.mobile === customer.mobile
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{customer.name}</h3>
                            {(() => {
                              const storeMatch = isSameStore(customer);
                              return (
                                <Badge
                                  variant={storeMatch ? "default" : "destructive"}
                                  className={`group text-xs px-2 py-0.5 ${storeMatch
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                                    }`}
                                >
                                  {storeMatch ? (
                                    <>
                                      <Shield className="h-3 w-3 mr-1 text-green-800 group-hover:text-green-400 transition-colors duration-200" />
                                      Same Store
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Other Store
                                    </>
                                  )}
                                </Badge>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-3 w-3" />
                            <span>{customer.mobile}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{customer.storeLocation}</span>
                          </div>
                          {customer.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <Mail className="h-3 w-3" />
                              <span>{customer.email}</span>
                            </div>
                          )}
                          {customer.referredBy && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <HandCoins className="h-3 w-3" />
                              <span>{customer.referredBy}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">
                            ₹{customer.walletBalance.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">Current Balance</p>
                          <p className="text-sm font-medium text-amber-600 mt-1">
                            {customer.surabhiCoins} Surabhi
                          </p>
                          <p className="text-sm font-medium text-amber-600 mt-1">
                            {customer.referralSurabhi > 0 ? customer.referralSurabhi : 0} Referral
                          </p>
                          {customer.sevaCoinsTotal && customer.sevaCoinsTotal > 0 && (
                            <p className="text-sm font-medium text-blue-600 mt-1">
                              ₹{customer.sevaCoinsTotal} Seva
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredCustomers.length === 0 && searchTerm && !isFetchingCustomers && (
                    <div className="text-center py-8 text-gray-500">
                      <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No customers found</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recharge Form */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Recharge Details
            </CardTitle>
            <CardDescription>
              Enter recharge amount (minimum ₹2,000)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {selectedCustomer ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Selected Customer</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <p className="text-sm text-blue-700">{selectedCustomer.mobile}</p>
                      {selectedCustomer.email && (
                        <p className="text-sm text-blue-700">{selectedCustomer.email}</p>
                      )}
                      {selectedCustomer.coinsFrozen && (
                        <Badge variant="destructive" className="mt-1">
                          Coins Frozen
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge variant="secondary" className="mb-1">
                        ₹{selectedCustomer.walletBalance.toLocaleString()}
                      </Badge>
                      {selectedCustomer.sevaCoinsTotal && selectedCustomer.sevaCoinsTotal > 0 && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          ₹{selectedCustomer.sevaCoinsTotal} Seva
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Store Match Status */}
                <div className={`p-4 rounded-lg border-2 transition-colors duration-200 ${getStoreMatchStatus(selectedCustomer).isMatch
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getStoreMatchStatus(selectedCustomer).isMatch
                      ? 'bg-green-100'
                      : 'bg-red-100'
                      }`}>
                      {(() => {
                        const IconComponent = getStoreMatchStatus(selectedCustomer).icon;
                        return <IconComponent className={`h-5 w-5 ${getStoreMatchStatus(selectedCustomer).isMatch
                          ? 'text-green-600'
                          : 'text-red-600'
                          }`} />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-medium ${getStoreMatchStatus(selectedCustomer).isMatch
                        ? 'text-green-900'
                        : 'text-red-900'
                        }`}>
                        {getStoreMatchStatus(selectedCustomer).isMatch ? 'Same Store Access' : 'Different Store Warning'}
                      </h4>
                      <p className={`text-sm ${getStoreMatchStatus(selectedCustomer).isMatch
                        ? 'text-green-700'
                        : 'text-red-700'
                        }`}>
                        {getStoreMatchStatus(selectedCustomer).message}
                      </p>
                      {!getStoreMatchStatus(selectedCustomer).isMatch && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          ⚠️ Recharge blocked: Only same store staff can process recharges
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Recharge Amount (₹)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount (₹2,000 - ₹50,000)"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="pl-10 h-12"
                      min="2000"
                      max="50000"
                      step="100"
                    />
                  </div>
                  {rechargeAmountNum > 0 && rechargeAmountNum < 2000 && (
                    <p className="text-sm text-red-500">Minimum recharge amount is ₹2,000</p>
                  )}
                </div>

                {rechargeAmountNum >= 2000 && storeDetails && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">Reward Breakdown</h3>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-900">Wallet Balance</span>
                        </div>
                        <span className="font-bold text-purple-600">+₹{rechargeAmountNum.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-900">
                            Surabhi Coins ({storeDetails.surabhiCommission}%)
                          </span>
                        </div>
                        <span className="font-bold text-amber-600">+{surabhiCoinsEarned}</span>
                      </div>

                      {selectedCustomer.referredBy && <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <HandCoins className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">
                            Referral Coins ({storeDetails.referralCommission}%)
                          </span>
                        </div>
                        <span className="font-bold text-green-600">+{referralAmount} to {selectedCustomer.referredBy}</span>
                      </div>
                      }

                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            Seva Wallet ({storeDetails.sevaCommission}%)
                          </span>
                        </div>
                        <span className="font-bold text-blue-600">+₹{sevaAmountEarned}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleRechargeClick}
                  disabled={isLoading || !rechargeAmount || rechargeAmountNum < 2000 || !storeDetails || !isSameStore(selectedCustomer)}
                  className={`w-full h-12 font-medium transition-all ${isSameStore(selectedCustomer)
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Recharge ₹{rechargeAmountNum.toLocaleString()}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Select a Customer</p>
                <p className="text-sm">Choose a customer from the list to proceed with recharge</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Recharge</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium">Customer Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Name:</div>
                <div>{selectedCustomer?.name}</div>
                <div className="text-gray-500">Mobile:</div>
                <div>{selectedCustomer?.mobile}</div>
                <div className="text-gray-500">Email:</div>
                <div>{selectedCustomer?.email || 'N/A'}</div>
                <div className="text-gray-500">Current Balance:</div>
                <div>₹{selectedCustomer?.walletBalance.toLocaleString()}</div>
                <div className="text-gray-500">Current Coins:</div>
                <div>{selectedCustomer?.surabhiCoins}</div>
                {selectedCustomer?.sevaCoinsTotal && (
                  <>
                    <div className="text-gray-500">Seva Wallet:</div>
                    <div>₹{selectedCustomer.sevaCoinsTotal}</div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Recharge Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500"> Recharge Amount:</div>
                <div className="font-medium">₹{rechargeAmountNum.toLocaleString()}</div>
                <div className="text-gray-500">Surabhi Coins Earned:</div>
                <div className="font-medium">+{surabhiCoinsEarned}</div>
                <div className="text-gray-500">Referral Surabhi Coins:</div>
                <div className="font-medium">+₹{referralAmount}</div>
                <div className="text-gray-500">Seva Amount:</div>
                <div className="font-medium">+₹{sevaAmountEarned}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={processRecharge}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                'Confirm Recharge'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};