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
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer, SalesManagementProps, SalesTransaction } from '@/types/types';

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

  // Function to check and reset monthly values if needed
  const checkAndResetMonthlyValues = (customer: Customer): Customer => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const lastTransactionDate = customer.lastTransactionDate ? 
      new Date(customer.lastTransactionDate) : new Date(0);
      
    if (lastTransactionDate < firstDayOfMonth) {
      return {
        ...customer,
        sevaCoinsCurrentMonth: 0,
        lastTransactionDate: today.toISOString()
      };
    }
    return customer;
  };

  // Fetch customers from Firestore
  useEffect(() => {
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
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm)
  );

  // Automatically set Surabhi coins to use all available coins when customer is selected
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.surabhiCoins > 0 && saleAmount) {
      setSurabhiCoinsToUse(Math.min(selectedCustomer.surabhiCoins, saleAmount));
    } else {
      setSurabhiCoinsToUse(0);
    }
  }, [selectedCustomer, saleAmount]);

  const calculateSale = () => {
    if (!saleAmount || saleAmount <= 0) return null;
    
    const coinsToUse = selectedCustomer 
      ? Math.min(surabhiCoinsToUse || 0, selectedCustomer.surabhiCoins || 0)
      : 0;
      
    let walletDeduction = 0;
    let cashPayment = 0;
    let surabhiCoinsEarned = 0;
    let goSevaContribution = 0;
    const remainingAmount = saleAmount - coinsToUse;

    if (selectedCustomer) {
      // Registered customer flow
      if (paymentMethod === 'wallet') {
        if (selectedCustomer.walletBalance >= remainingAmount) {
          walletDeduction = remainingAmount;
          goSevaContribution = saleAmount * 0.025; // 2.5% for registered
          surabhiCoinsEarned = remainingAmount * 0.025; // 2.5% for wallet payments
        } else {
          // Insufficient wallet balance
          return null;
        }
      } else if (paymentMethod === 'cash') {
        cashPayment = remainingAmount;
        surabhiCoinsEarned = coinsToUse * 0.025 + cashPayment * 0.02; // 2.5% for coins, 2% for cash
        goSevaContribution = saleAmount * 0.025;
      } else if (paymentMethod === 'mixed') {
        const availableWallet = selectedCustomer.walletBalance || 0;
        walletDeduction = Math.min(availableWallet, remainingAmount);
        cashPayment = remainingAmount - walletDeduction;
        // 2.5% for wallet portion and coins, 2% for cash portion
        surabhiCoinsEarned = (coinsToUse + walletDeduction) * 0.025 + cashPayment * 0.02;
        goSevaContribution = saleAmount * 0.025;
      }
    } else {
      // Non-registered customer flow (cash only)
      cashPayment = saleAmount;
      surabhiCoinsEarned = cashPayment * 0.015; // 1.5% for non-registered
      goSevaContribution = 0; // No Go Seva for non-registered
    }

    return {
      totalAmount: saleAmount,
      surabhiCoinsUsed: coinsToUse,
      walletDeduction,
      cashPayment,
      surabhiCoinsEarned: Math.floor(surabhiCoinsEarned),
      goSevaContribution: Math.floor(goSevaContribution)
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
      
      // Create new customer document using mobile as ID
      const customerData = {
        name: newCustomerName,
        mobile: newCustomerMobile,
        walletBalance: 0,
        surabhiCoins: Math.floor(saleAmount * 0.015), // 1.5% for new customers
        sevaCoinsTotal: 0,
        sevaCoinsCurrentMonth: 0,
        registered: false,
        createdAt: new Date().toISOString(),
        lastTransactionDate: new Date().toISOString(),
        createdBy: 'system'
      };
      
      // Add to customers collection with mobile as document ID
      await setDoc(doc(db, 'customers', newCustomerMobile), customerData);
      
      // Record the sale
      const saleData: SalesTransaction = {
        customerId: newCustomerMobile,
        customerName: newCustomerName,
        customerMobile: newCustomerMobile,
        amount: saleAmount,
        paymentMethod: 'cash', // Force cash for new customers
        surabhiCoinsUsed: 0,
        surabhiCoinsEarned: Math.floor(saleAmount * 0.015),
        goSevaContribution: 0,
        storeLocation,
        processedBy: 'system',
        processedAt: new Date().toISOString(),
        walletDeduction: 0,
        cashPayment: saleAmount,
        paymentStatus: 'completed',
        isNewCustomer: true
      };
      
      await addDoc(collection(db, 'sales'), saleData);
      
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
    if (!selectedCustomer || !saleAmount || !paymentMethod) {
      toast.error('Please fill all required fields');
      return;
    }
    
    if (!saleCalculation) {
      toast.error('Invalid sale calculation');
      return;
    }
    
    if (paymentMethod === 'wallet' && saleCalculation.walletDeduction > (selectedCustomer.walletBalance || 0)) {
      toast.error('Insufficient wallet balance');
      return;
    }
    
    setIsLoading(true);
    try {
      // Check and reset monthly values if needed
      const updatedCustomer = checkAndResetMonthlyValues(selectedCustomer);

      // Calculate new values
      const newWalletBalance = updatedCustomer.walletBalance - saleCalculation.walletDeduction;
      const newSurabhiCoins = updatedCustomer.surabhiCoins - saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned;
      const newSevaCoinsTotal = updatedCustomer.sevaCoinsTotal + saleCalculation.goSevaContribution;
      const newSevaCoinsCurrentMonth = updatedCustomer.sevaCoinsCurrentMonth + saleCalculation.goSevaContribution;
      
      // Update customer data using mobile as ID
      const customerRef = doc(db, 'customers', updatedCustomer.mobile);
      await updateDoc(customerRef, {
        walletBalance: newWalletBalance,
        surabhiCoins: newSurabhiCoins,
        sevaCoinsTotal: newSevaCoinsTotal,
        sevaCoinsCurrentMonth: newSevaCoinsCurrentMonth,
        lastTransactionDate: new Date().toISOString()
      });
      
      // Record the sale
      const saleData: SalesTransaction = {
        customerId: updatedCustomer.mobile,
        customerName: updatedCustomer.name,
        customerMobile: updatedCustomer.mobile,
        amount: saleCalculation.totalAmount,
        paymentMethod,
        surabhiCoinsUsed: saleCalculation.surabhiCoinsUsed,
        surabhiCoinsEarned: saleCalculation.surabhiCoinsEarned,
        goSevaContribution: saleCalculation.goSevaContribution,
        storeLocation,
        processedBy: 'system',
        processedAt: new Date().toISOString(),
        walletDeduction: saleCalculation.walletDeduction,
        cashPayment: saleCalculation.cashPayment,
        paymentStatus: 'completed',
        isNewCustomer: false,
        previousBalance: {
          wallet: updatedCustomer.walletBalance,
          surabhiCoins: updatedCustomer.surabhiCoins,
          sevaCoins: updatedCustomer.sevaCoinsTotal
        },
        newBalance: {
          wallet: newWalletBalance,
          surabhiCoins: newSurabhiCoins,
          sevaCoins: newSevaCoinsTotal
        }
      };
      
      await addDoc(collection(db, 'sales'), saleData);
      
      // Update local state
      setCustomers(customers.map(c => 
        c.mobile === updatedCustomer.mobile ? 
        { 
          ...c, 
          walletBalance: newWalletBalance,
          surabhiCoins: newSurabhiCoins,
          sevaCoinsTotal: newSevaCoinsTotal,
          sevaCoinsCurrentMonth: newSevaCoinsCurrentMonth,
          lastTransactionDate: new Date().toISOString()
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
    if (isNewCustomer) {
      await handleNewCustomerSale();
    } else {
      await handleRegisteredCustomerSale();
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
                <Button
                  onClick={() => {
                    setIsNewCustomer(true);
                    setSelectedCustomer(null);
                  }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Customer (Cash Only)
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newName">Customer Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="newName"
                      placeholder="Enter customer name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newMobile">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="newMobile"
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={newCustomerMobile}
                      onChange={(e) => setNewCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-10 h-12"
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
        {/* Sale Processing */}
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
                        <p className="text-red-700">Seva Coins (Month)</p>
                        <p className="font-bold">₹{selectedCustomer.sevaCoinsCurrentMonth}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Sale Amount (₹)</Label>
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
                          onChange={(e) => setSurabhiCoinsToUse(Number(e.target.value))}
                          className="pl-10 h-12"
                          max={selectedCustomer.surabhiCoins}
                          min="0"
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {selectedCustomer.surabhiCoins} coins (Using {surabhiCoinsToUse || 0})
                      </p>
                    </div>
                  )}
                  
                  {selectedCustomer && (
                    <div className="space-y-2">
                      <Label htmlFor="payment">Payment Method</Label>
                      <Select 
                        value={paymentMethod} 
                        onValueChange={(value) => setPaymentMethod(value as 'wallet' | 'cash' | 'mixed')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wallet">Wallet Only</SelectItem>
                          <SelectItem value="cash">Cash Only</SelectItem>
                          <SelectItem value="mixed">Wallet + Cash</SelectItem>
                        </SelectContent>
                      </Select>
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
                      
                      {saleCalculation.surabhiCoinsEarned > 0 && (
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <span className="text-sm font-medium text-yellow-900">
                            {selectedCustomer ? 'Surabhi Coins Earned' : 'Seva Coins Earned'}
                          </span>
                          <span className="font-bold text-yellow-600">+{Math.floor(saleCalculation.surabhiCoinsEarned)}</span>
                        </div>
                      )}
                      
                      {selectedCustomer && saleCalculation.goSevaContribution > 0 && (
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <span className="text-sm font-medium text-red-900">Go Seva Contribution</span>
                          <span className="font-bold text-red-600">₹{Math.floor(saleCalculation.goSevaContribution)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleSale}
                  disabled={isLoading || !saleAmount || 
                    (selectedCustomer && !paymentMethod) ||
                    (isNewCustomer && (!newCustomerName || !newCustomerMobile))}
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Complete Sale
                </Button>
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