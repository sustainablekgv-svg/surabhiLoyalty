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
  Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  surabhiCoins: number;
  createdAt: string;
  role: string;
  walletId: string;
}

interface WalletRechargeProps {
  storeLocation: string;
}

export const WalletRecharge = ({ storeLocation }: WalletRechargeProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch customers from Firestore
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customersCollection = collection(db, 'customers');
        const querySnapshot = await getDocs(customersCollection);
        const customersData = querySnapshot.docs.map(doc => ({
          ...doc.data() as Customer,
          mobile: doc.data().mobile // Using mobile as identifier
        }));
        setCustomers(customersData);
      } catch (error) {
        toast.error('Failed to fetch customers');
        console.error('Error fetching customers:', error);
      } finally {
        setIsFetchingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
 
  const calculateRewards = (amount: number) => {
    return Math.floor(amount * 0.1); // 10% Surabhi coins
  };

  const rechargeAmountNum = parseFloat(rechargeAmount) || 0;
  const surabhiCoinsEarned = calculateRewards(rechargeAmountNum);

  const verifyStaffPin = async () => {
    // In a real app, you would verify the PIN against your staff database
    // This is a simplified version that checks for a 4-digit PIN
    return staffPin.length === 4 && /^\d+$/.test(staffPin) && `${import.meta.env.VITE_FIREBASE_API_KEY}`;
  };

  const processRecharge = async () => {
    if (!selectedCustomer || !rechargeAmount) return;

    setIsProcessing(true);
    const toastId = toast.loading('Verifying staff PIN...');

    try {
      const isValidPin = await verifyStaffPin();
      if (!isValidPin) {
        toast.error('Invalid staff PIN. Please try again.', { id: toastId });
        return;
      }

      toast.loading('Processing recharge...', { id: toastId });

      // Find customer document by mobile number
      const customersCollection = collection(db, 'customers');
      const q = query(customersCollection, where('mobile', '==', selectedCustomer.mobile));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Customer not found in database');
      }

      const customerDoc = querySnapshot.docs[0];
      const currentData = customerDoc.data() as Customer;

      // Update customer document in Firestore
      await updateDoc(customerDoc.ref, {
        walletBalance: currentData.walletBalance + rechargeAmountNum,
        surabhiCoins: currentData.surabhiCoins + surabhiCoinsEarned
      });

      // Update local state
      setCustomers(customers.map(c => 
        c.mobile === selectedCustomer.mobile ? { 
          ...c, 
          walletBalance: c.walletBalance + rechargeAmountNum,
          surabhiCoins: c.surabhiCoins + surabhiCoinsEarned
        } : c
      ));

      toast.success(
        `₹${rechargeAmountNum.toLocaleString()} recharged successfully!`, 
        { 
          description: `Customer earned ${surabhiCoinsEarned} Surabhi Coins`,
          id: toastId
        }
      );
      
      // Reset form
      setRechargeAmount('');
      setSelectedCustomer(null);
      setSearchTerm('');
      setStaffPin('');
      setShowConfirmation(false);
    } catch (error) {
      toast.error('Recharge failed. Please try again.', { id: toastId });
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
    if (isNaN(amount) || amount < 2000 || amount > 50000) {
      toast.error('Please enter a valid amount between ₹2,000 and ₹50,000');
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
                          </div>
                          {customer.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <Mail className="h-3 w-3" />
                              <span>{customer.email}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">
                            ₹{customer.walletBalance.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">Current Balance</p>
                          <p className="text-sm font-medium text-amber-600 mt-1">
                            {customer.surabhiCoins} Coins
                          </p>
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
                    </div>
                    <Badge variant="secondary">
                      ₹{selectedCustomer.walletBalance.toLocaleString()}
                    </Badge>
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
                
                {rechargeAmountNum >= 2000 && (
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
                          <span className="text-sm font-medium text-amber-900">Surabhi Coins (10%)</span>
                        </div>
                        <span className="font-bold text-amber-600">+{surabhiCoinsEarned}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleRechargeClick}
                  disabled={isLoading || !rechargeAmount || rechargeAmountNum < 2000}
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
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
            <DialogDescription>
              Please verify the details and enter your staff PIN to proceed
            </DialogDescription>
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
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Recharge Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Amount:</div>
                <div className="font-medium">₹{rechargeAmountNum.toLocaleString()}</div>
                <div className="text-gray-500">Coins Earned:</div>
                <div className="font-medium">+{surabhiCoinsEarned}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffPin">Staff PIN</Label>
              <Input
                id="staffPin"
                type="password"
                placeholder="Enter 4-digit PIN"
                value={staffPin}
                onChange={(e) => setStaffPin(e.target.value)}
                className="h-12"
                maxLength={4}
              />
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
              disabled={isProcessing || staffPin.length !== 4}
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