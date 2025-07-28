import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingCart,
  Search,
  DollarSign,
  Coins,
  Calculator,
  CheckCircle,
  Phone,
  Wallet,
  HandCoins,
  Loader2
} from 'lucide-react';
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  increment,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Customer,
  SalesManagementProps,
  SalesTransaction,
  SevaTransaction,
  ActivityType,
  StoreType,
  AccountTx,
  StaffType
} from '@/types/types';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/auth-context';

const calculateAdminCut = (saleAmount: number, storeDetails: StoreType, surabhiCoinsToUse: number) => {
  if (!storeDetails) return 0;
  const remainingAmount = saleAmount - surabhiCoinsToUse;
  const surabhiAmount = Math.floor(remainingAmount * (storeDetails.surabhiCommission / 100));
  const referralAmount = Math.floor(remainingAmount * (storeDetails.referralCommission / 100));
  const sevaAmount = Math.floor(remainingAmount * (storeDetails.sevaCommission / 100));

  return referralAmount + sevaAmount + surabhiAmount;
};

export const SalesManagement = ({ storeLocation }: SalesManagementProps) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  console.log("The user in line 61 is", user);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isRegisteredAtSameStore, setIsRegisteredAtSameStore] = useState<boolean>(false);
  const [saleAmount, setSaleAmount] = useState<number | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'mixed'>('wallet');
  const [surabhiCoinsToUse, setSurabhiCoinsToUse] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
  const [storeDetails, setStoreDetails] = useState<StoreType | null>(null);

  const [showTPINModal, setShowTPINModal] = useState(false);
  const [enteredTPIN, setEnteredTPIN] = useState("");

  const handleSaleWithTPIN = async () => {
    if (selectedCustomer?.tpin) {
      setShowTPINModal(true);
    } else {
      handleSale();
    }
  };

  const verifyTPINAndProcess = () => {
    if (enteredTPIN === selectedCustomer?.tpin) {
      setShowTPINModal(false);
      setEnteredTPIN("");
      handleSale();
    } else {
      toast.error("Invalid TPIN. Please try again.");
      setEnteredTPIN("");
    }
  };

  // Fetch customers from Firestore
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

    const fetchCustomers = async () => {
      setIsFetchingCustomers(true);
      try {
        const q = query(collection(db, 'customers'));
        const querySnapshot = await getDocs(q);
        const customersData: Customer[] = [];
        querySnapshot.forEach((doc) => {
          customersData.push({ id: doc.id, ...doc.data() } as unknown as Customer);
        });
        setCustomers(customersData);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to load customers');
      } finally {
        setIsFetchingCustomers(false);
      }
    };
    fetchCustomers();
    fetchData();
  }, [storeLocation]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm)
  );

  // Automatically use all available Surabhi coins if customer is selected
  useEffect(() => {
    if (selectedCustomer && saleAmount && saleAmount > 0) {
      const maxCoinsToUse = Math.min(selectedCustomer.surabhiCoins, saleAmount);
      setSurabhiCoinsToUse(maxCoinsToUse);
    } else {
      setSurabhiCoinsToUse(0);
    }
  }, [selectedCustomer, saleAmount]);

  // Calculate sale details with accurate payment logic
  const calculateSale = () => {
    if (!saleAmount || saleAmount <= 0 || !storeDetails) return null;

    const coinsToUse = selectedCustomer
      ? Math.min(surabhiCoinsToUse || 0, selectedCustomer.surabhiCoins || 0)
      : 0;

    let walletDeduction = 0;
    let cashPayment = 0;
    let surabhiCoinsEarned = 0;
    let referrerSurabhiCoinsEarned = 0;
    let goSevaContribution = 0;

    const remainingAfterCoins = saleAmount - coinsToUse;

    // For registered customers
    if (!selectedCustomer) return null;

    const walletBalance = selectedCustomer.walletBalance || 0;

    // Payment method logic
    if (paymentMethod === 'wallet') {
      if (walletBalance >= remainingAfterCoins) {
        walletDeduction = remainingAfterCoins;
        referrerSurabhiCoinsEarned = 0;
      } else {
        return { isValid: false, error: 'Insufficient wallet balance' };
      }
    } else if (paymentMethod === 'mixed') {
      if (walletBalance < remainingAfterCoins) {
        cashPayment = saleAmount - walletBalance - coinsToUse;
        // Wallet portion gets surabhi commission, cash portion gets cashOnly commission
        surabhiCoinsEarned = Math.floor(
          cashPayment * (storeDetails.cashOnlyCommission / 100));
        referrerSurabhiCoinsEarned = Math.floor(
          cashPayment * (storeDetails.referralCommission / 100)
        );
        goSevaContribution = Math.floor(cashPayment * (storeDetails.sevaCommission / 100));
      } else {
        return { isValid: false, error: 'Mixed is not needed' };
      }
    } else if (paymentMethod === 'cash') {
      cashPayment = saleAmount - walletBalance - coinsToUse;
      surabhiCoinsEarned = Math.floor(cashPayment * (storeDetails.cashOnlyCommission / 100));
      referrerSurabhiCoinsEarned += Math.floor(cashPayment * (storeDetails.referralCommission / 100));
      goSevaContribution = Math.floor(cashPayment * (storeDetails.sevaCommission / 100));
    }

    return {
      totalAmount: saleAmount,
      surabhiCoinsUsed: coinsToUse,
      walletDeduction,
      cashPayment,
      surabhiCoinsEarned,
      goSevaContribution,
      referrerSurabhiCoinsEarned,
      isValid: true
    };
  };

  const saleCalculation = saleAmount ? calculateSale() : null;

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

  const handleRegisteredCustomerSale = async () => {
    console.log('Searching for customer with mobile:', selectedCustomer.mobile);
    console.log('Selected customer object:', selectedCustomer);
    if (!selectedCustomer || !saleAmount || !saleCalculation || !saleCalculation.isValid) {
      toast.error('Invalid sale calculation');
      return;
    }

    setIsLoading(true);

    try {
      // First check if customer exists in database
      const customersRef = collection(db, "customers");
      const q = query(customersRef, where("mobile", "==", selectedCustomer.mobile));
      const querySnapshot = await getDocs(q);
      console.log('Query snapshot empty:', querySnapshot.empty);
      console.log('Query snapshot size:', querySnapshot.size);
      if (querySnapshot.empty) {
        throw new Error('Customer not found in database');
      }
      console.log("Is it comig here in line 259")
      const newWalletBalance = (selectedCustomer.walletBalance || 0) - saleCalculation.walletDeduction;
      const newSurabhiCoins = (selectedCustomer.surabhiCoins || 0) - saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned;
      console.log("Is it comig here in line 261", newWalletBalance, newSurabhiCoins)
      // Update customer balances
      const customerDoc = querySnapshot.docs[0];
      const customerRef = customerDoc.ref;
      console.log('Customer document in line 266 is', customerRef);

      await updateDoc(customerRef, {
        saleElgibility: true,
        walletBalance: newWalletBalance,
        surabhiCoins: newSurabhiCoins,
        lastTransactionDate: serverTimestamp(),
      });

      // Record transaction
      const saleData: SalesTransaction = {
        customerName: selectedCustomer.name,
        customerMobile: selectedCustomer.mobile,
        amount: saleCalculation.totalAmount,
        paymentMethod,
        surabhiCoinsUsed: saleCalculation.surabhiCoinsUsed,
        walletDeduction: saleCalculation.walletDeduction,
        cashPayment: saleCalculation.cashPayment,
        storeLocation,
        processedBy: user?.name,
        isCustomerRegistered: true,
        previousBalance: {
          wallet: selectedCustomer.walletBalance || 0,
          surabhiCoins: selectedCustomer.surabhiCoins || 0,
        },
        newBalance: {
          wallet: newWalletBalance,
          surabhiCoins: newSurabhiCoins,
        },
        createdAt: Timestamp.fromDate(new Date())
      };

      await addDoc(collection(db, 'transactions'), saleData);

      // Handle Referrer Income 
      if (selectedCustomer.referredBy && saleCalculation.referrerSurabhiCoinsEarned > 0) {
        try {
          // Find referrer's document
          const customersCollection = collection(db, 'customers');
          const referrerQuery = query(
            customersCollection,
            where('mobile', '==', selectedCustomer.referredBy)
          );
          const referrerSnapshot = await getDocs(referrerQuery);

          if (!referrerSnapshot.empty) {
            const referrerDoc = referrerSnapshot.docs[0];
            const referrerData = referrerDoc.data() as Customer;
            const referralAmount = saleCalculation.referrerSurabhiCoinsEarned;

            console.log('Referrer Data:', referrerData);
            console.log('New Referred User:', selectedCustomer.name);
            console.log('Referral Amount:', referralAmount);

            // Safely increment referral amount (handle null/NaN)
            const incrementAmount = Number.isNaN(referralAmount) || referralAmount === null ? 0 : referralAmount;

            // Update referrer's data
            await updateDoc(referrerDoc.ref, {
              referralSurabhi: increment(incrementAmount),
              surabhiCoins: increment(incrementAmount)
            });

            // Add activity record for referrer
            await addActivityRecord({
              type: 'referral',
              description: `${selectedCustomer.referredBy} Earned ₹${incrementAmount} referral income from ${selectedCustomer.name}'s recharge`,
              amount: incrementAmount,
              user: selectedCustomer.referredBy,
              location: selectedCustomer.storeLocation
            });
          } else {
            console.warn(`Referrer with mobile ${selectedCustomer.referredBy} not found`);
          }
        } catch (error) {
          console.error('Error processing referral:', error);
          // Consider adding error handling/retry logic here
        }
      }

      // Add seva contribution activity record for cash and mixed payments
      if ((paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.goSevaContribution > 0) {
        await addActivityRecord({
          type: 'contribution',
          description: `Seva contribution of ₹${saleCalculation.goSevaContribution} from ${selectedCustomer.name}'s purchase`,
          amount: saleCalculation.goSevaContribution,
          user: selectedCustomer.mobile,
          location: storeLocation
        });
      }

      // Add AccountTx record(s) based on payment method
      // if (paymentMethod === "wallet") {
      //   const adminCut = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
      //   const accountTxData: Omit<AccountTx, 'id'> = {
      //     date: Timestamp.fromDate(new Date()),
      //     storeName: storeDetails.name,
      //     type: 'sale',
      //     amount: saleCalculation.totalAmount,
      //     debit: 0,
      //     adminCut: adminCut,
      //     credit: saleCalculation.totalAmount - adminCut,
      //     balance: saleCalculation.totalAmount - adminCut,
      //     description: `Wallet sale for ${selectedCustomer.name} (${selectedCustomer.mobile})`,
      //     settled: false
      //   };
      //   await addDoc(collection(db, 'AccountTx'), accountTxData);
      // } else 
      if (paymentMethod === 'cash') {
        const adminCut = calculateAdminCut(saleCalculation.totalAmount, storeDetails, surabhiCoinsToUse);
        const accountTxData: Omit<AccountTx, 'id'> = {
          date: Timestamp.fromDate(new Date()),
          storeName: storeDetails.name,
          type: 'sale',
          amount: saleCalculation.totalAmount,
          credit: saleCalculation.cashPayment,
          adminCut: adminCut,
          debit: saleCalculation.totalAmount - saleCalculation.surabhiCoinsUsed - adminCut,
          balance: saleCalculation.totalAmount - saleCalculation.cashPayment - saleCalculation.surabhiCoinsUsed - adminCut,
          description: `Cash sale for ${selectedCustomer.name} (${selectedCustomer.mobile})`,
          settled: false
        }
        await addDoc(collection(db, 'AccountTx'), accountTxData);
      } else {
        // Mixed payment - create two separate records

        // 1. Wallet portion record
        // if (saleCalculation.walletDeduction > 0) {
        //   const walletAdminCut = calculateAdminCut(saleCalculation.walletDeduction, storeDetails, saleCalculation.surabhiCoinsUsed);
        //   const walletTxData: Omit<AccountTx, 'id'> = {
        //     date: Timestamp.fromDate(new Date()),
        //     storeName: storeDetails.name,
        //     type: 'sale',
        //     amount: saleCalculation.walletDeduction,
        //     debit: 0,
        //     adminCut: walletAdminCut,
        //     credit: saleCalculation.totalAmount - walletAdminCut,
        //     balance: saleCalculation.walletDeduction - walletAdminCut,
        //     description: `Wallet portion (${saleCalculation.walletDeduction}) of mixed payment for ${selectedCustomer.name}`,
        //     settled: false
        //   };
        //   await addDoc(collection(db, 'AccountTx'), walletTxData);
        // }

        // 2. Cash portion record
        if (saleCalculation.cashPayment > 0) {
          const cashAdminCut = calculateAdminCut(saleCalculation.cashPayment, storeDetails, saleCalculation.surabhiCoinsUsed);
          const cashTxData: Omit<AccountTx, 'id'> = {
            date: Timestamp.fromDate(new Date()),
            storeName: storeDetails.name,
            type: 'sale',
            amount: saleCalculation.cashPayment,
            credit: saleCalculation.cashPayment,
            debit: cashAdminCut,
            balance: saleCalculation.cashPayment - cashAdminCut,
            description: `Cash portion (${saleCalculation.cashPayment}) of mixed payment for ${selectedCustomer.name}`,
            settled: false
          };
          await addDoc(collection(db, 'AccountTx'), cashTxData);
        }
      }

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
        salesCount: increment(1) as unknown as number,
        lastActive: Timestamp.fromDate(new Date())
      };

      await updateDoc(staffRef, staffUpdates);

      // Record activity
      const activity: ActivityType = {
        id: `act-${Date.now()}`,
        type: 'transaction',
        description: `Purchase of ₹${saleCalculation.totalAmount} by ${selectedCustomer.name}`,
        amount: saleCalculation.totalAmount,
        user: selectedCustomer.mobile,
        location: storeLocation,
        date: Timestamp.fromDate(new Date())
      };

      await addDoc(collection(db, 'Activity'), activity);

      // Update local state
      setCustomers(customers.map(c =>
        c.mobile === selectedCustomer.mobile ?
          {
            ...c,
            walletBalance: newWalletBalance,
            surabhiCoins: newSurabhiCoins,
            lastTransactionDate: Timestamp.fromDate(new Date())
          } : c
      ));

      toast.success(`Sale of ₹${saleAmount} completed successfully!`);

      // Reset form
      setSaleAmount(undefined);
      setPaymentMethod('wallet');
      setSurabhiCoinsToUse(0);
      setSelectedCustomer(null);
      setSearchTerm('');

    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Sale failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSale = async () => {
    if (!selectedCustomer || !saleAmount) {
      toast.error('Please select a customer and enter sale amount');
      return;
    }

    if (paymentMethod === 'wallet') {
      const remainingAfterCoins = saleAmount - (saleCalculation?.surabhiCoinsUsed || 0);
      if ((selectedCustomer.walletBalance || 0) < remainingAfterCoins) {
        toast.error('Insufficient wallet balance for this payment method');
        return;
      }
    }

    await handleRegisteredCustomerSale();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Management</h2>
          <p className="text-gray-600">Process customer purchases at {storeLocation}</p>
          {storeDetails && (
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              <Badge variant="outline" className="border-blue-200 text-blue-800">
                Referral: {storeDetails.referralCommission}%
              </Badge>
              <Badge variant="outline" className="border-green-200 text-green-800">
                Surabhi: {storeDetails.surabhiCommission}%
              </Badge>
              <Badge variant="outline" className="border-red-200 text-red-800">
                Cash Only: {storeDetails.cashOnlyCommission}%
              </Badge>
              <Badge variant="outline" className="border-purple-200 text-purple-800">
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
              Search and select customer for sale transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or mobile number"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isFetchingCustomers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.mobile}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      // Check if customer is registered at the same store as the current user
                      const isSameStore = customer.storeLocation === user?.storeLocation;
                      setIsRegisteredAtSameStore(isSameStore);
                      // Reset payment method to cash if not from same store
                      if (!isSameStore) {
                        setPaymentMethod('cash');
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedCustomer?.mobile === customer.mobile
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{customer.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{customer.mobile}</span>
                        </div>
                        {customer.referredBy && <div className="flex items-center gap-2 text-sm text-gray-600">
                          <HandCoins className="h-3 w-3" />
                          <span> {customer.referredBy}</span>
                        </div>}
                      </div>
                      <div className="text-right text-sm">
                        <div className="flex items-center justify-end gap-2 mb-1">
                          {customer.storeLocation === user?.storeLocation ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs font-medium">Same Store</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-orange-600">
                              <Phone className="h-3 w-3" />
                              <span className="text-xs font-medium">Other Store</span>
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-green-600">₹{customer.walletBalance}</p>
                        <p className="text-amber-600">{customer.surabhiCoins} Surabhi coins</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No customers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              Process Sale
            </CardTitle>
            <CardDescription>
              Enter sale details and payment method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedCustomer ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Customer Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Wallet Balance</p>
                      <p className="font-bold">₹{selectedCustomer.walletBalance}</p>
                    </div>
                    <div>
                      <p className="text-amber-700">Surabhi Coins</p>
                      <p className="font-bold">{selectedCustomer.surabhiCoins}</p>
                    </div>
                    <div>
                      <p className="text-purple-700">Last Purchase</p>
                      <p className="font-bold">
                        {selectedCustomer.lastTransactionDate
                          ? selectedCustomer.lastTransactionDate.toDate
                            ? new Date(selectedCustomer.lastTransactionDate.toDate()).toLocaleString()
                            : selectedCustomer.lastTransactionDate instanceof Timestamp
                              ? selectedCustomer.lastTransactionDate.toDate().toLocaleString()
                              : typeof selectedCustomer.lastTransactionDate === 'string'
                                ? new Date(selectedCustomer.lastTransactionDate).toLocaleString()
                                : 'Never'
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Sale Amount (₹) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter sale amount"
                        value={saleAmount || ''}
                        onChange={(e) => setSaleAmount(Number(e.target.value))}
                        className="pl-10 h-12"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  {selectedCustomer && selectedCustomer.surabhiCoins > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="coins">Use Surabhi Coins</Label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="coins"
                          type="number"
                          placeholder="Enter coins to use"
                          value={surabhiCoinsToUse}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const maxCoins = Math.min(
                              selectedCustomer.surabhiCoins,
                              saleAmount || 0
                            );
                            setSurabhiCoinsToUse(Math.max(0, Math.min(value, maxCoins)));
                          }}
                          className="pl-10 h-12"
                          min="0"
                          max={selectedCustomer.surabhiCoins}
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {selectedCustomer.surabhiCoins} coins (Using {surabhiCoinsToUse || 0})
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="payment">Payment Method *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as 'wallet' | 'cash' | 'mixed')}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {isRegisteredAtSameStore && (
                          <SelectItem value="wallet">Wallet Only</SelectItem>
                        )}
                        <SelectItem value="cash">Cash Only</SelectItem>
                        {isRegisteredAtSameStore && (
                          <SelectItem value="mixed">Wallet + Cash</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {paymentMethod === 'wallet' && (
                      <p className="text-xs text-blue-600">
                        Full amount (after coins) will be deducted from wallet
                      </p>
                    )}
                    {paymentMethod === 'cash' && (
                      <p className="text-xs text-blue-600">
                        Full amount (after coins) will be paid in cash
                      </p>
                    )}
                    {paymentMethod === 'mixed' && (
                      <p className="text-xs text-blue-600">
                        Maximum wallet amount will be used first, then cash
                      </p>
                    )}
                  </div>
                </div>

                {saleCalculation && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">Transaction Summary</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium text-purple-900">Total Amount</span>
                        <span className="font-bold text-purple-600">₹{saleCalculation.totalAmount}</span>
                      </div>

                      {saleCalculation.surabhiCoinsUsed > 0 && (
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <span className="text-sm font-medium text-amber-900">Surabhi Coins Used</span>
                          <span className="font-bold text-amber-600">-{saleCalculation.surabhiCoinsUsed}</span>
                        </div>
                      )}

                      {saleCalculation.walletDeduction > 0 && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-medium text-blue-900">Wallet Deduction</span>
                          <span className="font-bold text-blue-600">₹{saleCalculation.walletDeduction}</span>
                        </div>
                      )}

                      {saleCalculation.cashPayment > 0 && (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">Cash Payment</span>
                          <span className="font-bold text-green-600">₹{saleCalculation.cashPayment}</span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.surabhiCoinsEarned > 0 && (
                        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                          <span className="text-sm font-medium text-indigo-900">Surabhi Coins Earned  {paymentMethod === 'cash' || paymentMethod === 'mixed' ? storeDetails.cashOnlyCommission : storeDetails.surabhiCommission}%</span>
                          <span className="font-bold text-indigo-600">+{saleCalculation.surabhiCoinsEarned} </span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.goSevaContribution > 0 && (
                        <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                          <span className="text-sm font-medium text-pink-900">Go Seva Contribution  {storeDetails.sevaCommission}%</span>
                          <span className="font-bold text-pink-600">+{saleCalculation.goSevaContribution} </span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.referrerSurabhiCoinsEarned > 0 && selectedCustomer.referredBy && (
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <span className="text-sm font-medium text-yellow-900">Referral Bonus  {storeDetails.referralCommission}%</span>
                          <span className="font-bold text-yellow-600">+{saleCalculation.referrerSurabhiCoinsEarned} Referral to {selectedCustomer.referredBy} </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <>
                  <Button
                    onClick={handleSaleWithTPIN}
                    disabled={isLoading || !saleAmount ||
                      (selectedCustomer && !paymentMethod) ||
                      (saleCalculation && !saleCalculation.isValid)}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Process Sale
                  </Button>

                  {/* TPIN Verification Modal */}
                  {showTPINModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white p-6 rounded-lg max-w-md w-full">
                        <h3 className="text-lg font-medium mb-4">TPIN Verification</h3>
                        <p className="mb-4">Please enter the customer's TPIN to proceed with the sale.</p>
                        <input
                          type="password"
                          value={enteredTPIN}
                          onChange={(e) => setEnteredTPIN(e.target.value)}
                          className="w-full p-2 border rounded mb-4"
                          placeholder="Enter TPIN"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setShowTPINModal(false);
                              setEnteredTPIN("");
                            }}
                            className="px-4 py-2 border rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={verifyTPINAndProcess}
                            className="px-4 py-2 bg-green-600 text-white rounded"
                          >
                            Verify
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">
                  Select a Customer
                </p>
                <p className="text-sm">
                  Choose a customer from the list to process a sale
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};