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
  User,
  UserPlus,
  Loader2,
  Lock
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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Customer, 
  SalesManagementProps, 
  SalesTransaction,
  SevaTransaction,
  ActivityType,
  StoreType
} from '@/types/types';
import { serverTimestamp } from 'firebase/firestore';

export const SalesManagement = ({ storeLocation }: SalesManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [saleAmount, setSaleAmount] = useState<number | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'mixed'>('wallet');
  const [surabhiCoinsToUse, setSurabhiCoinsToUse] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
  const [showTpinInput, setShowTpinInput] = useState(false);
  const [tpin, setTpin] = useState('');
  const [storeDetails, setStoreDetails] = useState<StoreType | null>(null);
   console.log("THe store details are", storeDetails, storeLocation)
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
        console.log("THe line 74 data is", querySnapshotStores);
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
    if (!saleAmount || saleAmount <= 0) return null;

    const coinsToUse = selectedCustomer 
      ? Math.min(surabhiCoinsToUse || 0, selectedCustomer.surabhiCoins || 0)
      : 0;

    let walletDeduction = 0;
    let cashPayment = 0;
    let surabhiCoinsEarned = 0;
    let goSevaContribution = Math.floor(saleAmount * 0.01); // 1% of total amount for Go Seva

    const remainingAfterCoins = saleAmount - coinsToUse;

    // For new customers (cash only)
    // if (isNewCustomer) {
    //   cashPayment = saleAmount;
    //   surabhiCoinsEarned = Math.floor(cashPayment * 0.015); // 1.5% of cash payment for new customers
    //   return {
    //     totalAmount: saleAmount,
    //     surabhiCoinsUsed: 0,
    //     walletDeduction: 0,
    //     cashPayment,
    //     surabhiCoinsEarned,
    //     goSevaContribution,
    //     isValid: true
    //   };
    // }

    // For registered customers
    if (!selectedCustomer) return null;

    const walletBalance = selectedCustomer.walletBalance || 0;

    // Payment method logic
    if (paymentMethod === 'wallet') {
      if (walletBalance >= remainingAfterCoins) {
        walletDeduction = remainingAfterCoins;
        surabhiCoinsEarned = Math.floor(walletDeduction * 0.025); // 2.5% of wallet payment
      } else {
        return { isValid: false, error: 'Insufficient wallet balance' };
      }
    } 
    else if (paymentMethod === 'cash') {
      cashPayment = remainingAfterCoins;
      surabhiCoinsEarned = Math.floor(cashPayment * 0.02); // 2% of cash payment
    } 
    else if (paymentMethod === 'mixed') {
      walletDeduction = Math.min(walletBalance, remainingAfterCoins);
      cashPayment = remainingAfterCoins - walletDeduction;
      // 2.5% of wallet + 2% of cash
      surabhiCoinsEarned = Math.floor(walletDeduction * 0.025 + cashPayment * 0.02);
    }

    // Add bonus for using Surabhi coins (1% of coins used)
    surabhiCoinsEarned += Math.floor(coinsToUse * 0.01);

    return {
      totalAmount: saleAmount,
      surabhiCoinsUsed: coinsToUse,
      walletDeduction,
      cashPayment,
      surabhiCoinsEarned,
      goSevaContribution,
      isValid: true
    };
  };

  const saleCalculation = saleAmount ? calculateSale() : null;

  const handleNewCustomerSale = async () => {
    if (!newCustomerName || !newCustomerMobile || !saleAmount) {
      toast.error('Please fill all required fields for new customer');
      return;
    }
    if (newCustomerMobile.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Check if customer already exists
      const customerQuery = query(collection(db, 'customers'), where('mobile', '==', newCustomerMobile));
      const querySnapshot = await getDocs(customerQuery);
      
      if (!querySnapshot.empty) {
        toast.error('Customer with this mobile number already exists');
        return;
      }
      
      // Create new customer
      const customerData = {
        name: newCustomerName,
        mobile: newCustomerMobile,
        walletBalance: 0,
        surabhiCoins: saleCalculation?.surabhiCoinsEarned || 0,
        registered: false,
        createdAt: serverTimestamp(),
        lastTransactionDate: serverTimestamp(),
        createdBy: 'system',
        storeLocation,
        role: 'customer',
        walletId: `WALLET-${newCustomerMobile}`,
        tpin: '0000' // Default TPIN
      };
      
      await setDoc(doc(db, 'customers', newCustomerMobile), customerData);
      
      // Record transaction
      const saleData: SalesTransaction = {
        customerName: newCustomerName,
        customerMobile: newCustomerMobile,
        amount: saleAmount,
        paymentMethod: 'cash',
        surabhiCoinsUsed: 0,
        walletDeduction: 0,
        cashPayment: saleAmount,
        storeLocation,
        processedBy: 'system',
        isCustomerRegistered: false,
        createdAt: Timestamp.fromDate(new Date())
      };
      
      await addDoc(collection(db, 'transactions'), saleData);
      
      // Update Seva Pool
      const sevaPoolRef = doc(db, 'SevaPool', 'main');
      const sevaPoolSnap = await getDoc(sevaPoolRef);
      
      const sevaContribution = saleCalculation?.goSevaContribution || 0;
      
      if (sevaPoolSnap.exists()) {
        await updateDoc(sevaPoolRef, {
          currentBalance: increment(sevaContribution),
          totalContributions: increment(sevaContribution),
          contributionsCurrentMonth: increment(sevaContribution),
          lastAllocatedDate: serverTimestamp()
        });
      } else {
        await setDoc(sevaPoolRef, {
          currentBalance: sevaContribution,
          totalContributions: sevaContribution,
          totalAllocations: 0,
          contributionsCurrentMonth: sevaContribution,
          allocationsCurrentMonth: 0,
          lastResetDate: serverTimestamp(),
          lastAllocatedDate: serverTimestamp()
        });
      }
      
      // Record activity
      const activity: ActivityType = {
        id: `act-${Date.now()}`,
        type: 'transaction',
        description: `Purchase of ₹${saleAmount} by new customer ${newCustomerName}`,
        amount: saleAmount,
        user: newCustomerMobile,
        location: storeLocation,
        date: Timestamp.fromDate(new Date())
      };
      
      await addDoc(collection(db, 'Activity'), activity);
      
      toast.success(`Sale of ₹${saleAmount} completed for new customer!`);
      
      // Reset form
      setNewCustomerName('');
      setNewCustomerMobile('');
      setSaleAmount(undefined);
      setIsNewCustomer(false);
      setSearchTerm('');
      
    } catch (error) {
      console.error('Error processing new customer sale:', error);
      toast.error('Sale failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisteredCustomerSale = async () => {
    if (!selectedCustomer || !saleAmount || !saleCalculation || !saleCalculation.isValid) {
      toast.error('Invalid sale calculation');
      return;
    }
    
    if (!tpin || tpin !== selectedCustomer.tpin) {
      toast.error('Please enter the correct TPIN to confirm the sale');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const customerRef = doc(db, 'customers', selectedCustomer.mobile);
      const newWalletBalance = (selectedCustomer.walletBalance || 0) - saleCalculation.walletDeduction;
      const newSurabhiCoins = (selectedCustomer.surabhiCoins || 0) - saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned;

      // Update customer balances
      await updateDoc(customerRef, {
        walletBalance: newWalletBalance,
        surabhiCoins: newSurabhiCoins,
        lastTransactionDate: serverTimestamp()
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
        processedBy: 'system',
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
      
      // Update Seva Pool
      const sevaPoolRef = doc(db, 'SevaPool', 'main');
      const sevaPoolSnap = await getDoc(sevaPoolRef);
      
      if (sevaPoolSnap.exists()) {
        await updateDoc(sevaPoolRef, {
          currentBalance: increment(saleCalculation.goSevaContribution),
          totalContributions: increment(saleCalculation.goSevaContribution),
          contributionsCurrentMonth: increment(saleCalculation.goSevaContribution),
          lastAllocatedDate: serverTimestamp()
        });
      }
      
      // Record Seva transaction
      const today = new Date();
      const monthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      const sevaTransaction: SevaTransaction = {
        id: `seva-${Date.now()}`,
        type: 'contribution',
        amount: saleCalculation.goSevaContribution,
        description: `Contribution from sale by ${selectedCustomer.name}`,
        date: Timestamp.fromDate(new Date()),
        customerMobile: selectedCustomer.mobile,
        customerName: selectedCustomer.name,
        monthYear,
        storeLocation
      };
      
      await addDoc(collection(db, 'SevaTransaction'), sevaTransaction);
      
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
    lastTransactionDate:  Timestamp.fromDate(new Date()) 
  } : c
));
      
      toast.success(`Sale of ₹${saleAmount} completed successfully!`);
      
      // Reset form
      setSaleAmount(undefined);
      setPaymentMethod('wallet');
      setSurabhiCoinsToUse(0);
      setSelectedCustomer(null);
      setSearchTerm('');
      setTpin('');
      setShowTpinInput(false);
      
    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Sale failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSale = async () => {
    if (isNewCustomer) {
      await handleNewCustomerSale();
    } else {
      // Validate payment method before asking for TPIN
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
      
      setShowTpinInput(true);
    }
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
              {isNewCustomer ? 'New Customer Details' : 'Select Customer'}
            </CardTitle>
            <CardDescription>
              {isNewCustomer ? 'Enter details for new customer' : 'Search and select customer for sale transaction'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isNewCustomer ? (
              <>
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
                          setIsNewCustomer(false);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedCustomer?.mobile === customer.mobile
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
                              {customer.registered ? (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Registered</span>
                              ) : (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Guest</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium text-green-600">₹{customer.walletBalance}</p>
                            <p className="text-amber-600">{customer.surabhiCoins} coins</p>
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
                {/* <Button
                  onClick={() => {
                    setIsNewCustomer(true);
                    setSelectedCustomer(null);
                  }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Customer (Cash Only)
                </Button> */}
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newName">Customer Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="newName"
                      placeholder="Enter customer name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newMobile">Mobile Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="newMobile"
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={newCustomerMobile}
                      onChange={(e) => setNewCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>
                <Button
                  onClick={() => setIsNewCustomer(false)}
                  variant="outline"
                  className="w-full"
                >
                  <User className="h-4 w-4 mr-2" />
                  Select Existing Customer
                </Button>
              </div>
            )}
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
            {selectedCustomer || isNewCustomer ? (
              <>
                {selectedCustomer && (
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
                            ? typeof selectedCustomer.lastTransactionDate === 'string'
                              ? new Date(selectedCustomer.lastTransactionDate).toLocaleString()
                              : (selectedCustomer.lastTransactionDate instanceof Date
                                  ? selectedCustomer.lastTransactionDate.toLocaleString()
                                  : 'Invalid date')
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
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
                  
                  {selectedCustomer && (
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
                          <SelectItem value="wallet">Wallet Only</SelectItem>
                          <SelectItem value="cash">Cash Only</SelectItem>
                          <SelectItem value="mixed">Wallet + Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      {paymentMethod === 'wallet' && (
                        <p className="text-xs text-blue-600">
                          Full amount (after coins) will be deducted from wallet
                        </p>
                      )}
                      {paymentMethod === 'mixed' && (
                        <p className="text-xs text-blue-600">
                          Maximum wallet amount will be used first, then cash
                        </p>
                      )}
                    </div>
                  )}
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
                    </div>
                  </div>
                )}
                
                {showTpinInput && selectedCustomer && (
                  <div className="space-y-2">
                    <Label htmlFor="tpin">Enter Customer TPIN *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="tpin"
                        type="password"
                        placeholder="Enter customer TPIN"
                        value={tpin}
                        onChange={(e) => setTpin(e.target.value)}
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Confirm sale with customer's 4-digit TPIN
                    </p>
                  </div>
                )}
                
                {!showTpinInput ? (
                  <Button
                    onClick={handleSale}
                    disabled={isLoading || !saleAmount || 
                      (selectedCustomer && !paymentMethod) ||
                      (isNewCustomer && (!newCustomerName || !newCustomerMobile)) ||
                      (saleCalculation && !saleCalculation.isValid)}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {selectedCustomer ? 'Process Sale' : 'Complete New Customer Sale'}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      onClick={handleRegisteredCustomerSale}
                      disabled={isLoading || tpin.length !== 4}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirm Sale with TPIN
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => setShowTpinInput(false)}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">
                  {isNewCustomer ? 'Enter New Customer Details' : 'Select a Customer'}
                </p>
                <p className="text-sm">
                  {isNewCustomer ? 'Fill in customer details to process sale' : 'Choose a customer from the list to process a sale'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};