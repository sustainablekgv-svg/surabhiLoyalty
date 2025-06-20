import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingCart, 
  Search, 
  DollarSign, 
  Coins,
  Heart,
  Calculator,
  CheckCircle,
  Phone,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  rechargeWallet: number;
  surabhiCoins: number;
  goSevaContribution: number;
}

interface SalesManagementProps {
  storeLocation: string;
}

export const SalesManagement = ({ storeLocation }: SalesManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [saleAmount, setSaleAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [surabhiCoinsToUse, setSurabhiCoinsToUse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock customer data
  const [customers] = useState<Customer[]>([
    {
      id: '1',
      name: 'John Doe',
      mobile: '7777777777',
      rechargeWallet: 5000,
      surabhiCoins: 750,
      goSevaContribution: 125
    },
    {
      id: '2',
      name: 'Priya Sharma',
      mobile: '6666666666',
      rechargeWallet: 3200,
      surabhiCoins: 450,
      goSevaContribution: 80
    }
  ]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm)
  );

  const calculateSale = () => {
    const amount = parseFloat(saleAmount) || 0;
    const coinsToUse = Math.min(parseFloat(surabhiCoinsToUse) || 0, selectedCustomer?.surabhiCoins || 0);
    
    let walletDeduction = 0;
    let cashPayment = 0;
    let surabhiCoinsEarned = 0;
    let goSevaContribution = 0;

    const remainingAmount = amount - coinsToUse;

    if (paymentMethod === 'wallet') {
      if (selectedCustomer && selectedCustomer.rechargeWallet >= remainingAmount) {
        walletDeduction = remainingAmount;
        goSevaContribution = amount * 0.025;
      } else {
        // Insufficient wallet balance
        return null;
      }
    } else if (paymentMethod === 'cash') {
      cashPayment = remainingAmount;
      surabhiCoinsEarned = cashPayment * 0.05; // 5% for cash payments
      goSevaContribution = amount * 0.025;
    } else if (paymentMethod === 'mixed') {
      const availableWallet = selectedCustomer?.rechargeWallet || 0;
      walletDeduction = Math.min(availableWallet, remainingAmount);
      cashPayment = remainingAmount - walletDeduction;
      if (cashPayment > 0) {
        surabhiCoinsEarned = cashPayment * 0.05;
      }
      goSevaContribution = amount * 0.025;
    }

    return {
      totalAmount: amount,
      surabhiCoinsUsed: coinsToUse,
      walletDeduction,
      cashPayment,
      surabhiCoinsEarned,
      goSevaContribution
    };
  };

  const saleCalculation = selectedCustomer && saleAmount ? calculateSale() : null;

  const handleSale = async () => {
    if (!selectedCustomer || !saleAmount || !paymentMethod) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!saleCalculation) {
      toast.error('Invalid sale calculation');
      return;
    }

    if (saleCalculation.walletDeduction > (selectedCustomer.rechargeWallet || 0)) {
      toast.error('Insufficient wallet balance');
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`Sale of ₹${saleAmount} completed successfully!`);
      setSaleAmount('');
      setPaymentMethod('');
      setSurabhiCoinsToUse('');
      setSelectedCustomer(null);
      setSearchTerm('');
    } catch (error) {
      toast.error('Sale failed. Please try again.');
    } finally {
      setIsLoading(false);
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
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedCustomer?.id === customer.id
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
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-green-600">₹{customer.rechargeWallet}</p>
                      <p className="text-amber-600">{customer.surabhiCoins} coins</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            {selectedCustomer ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Customer Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Wallet</p>
                      <p className="font-bold">₹{selectedCustomer.rechargeWallet}</p>
                    </div>
                    <div>
                      <p className="text-amber-700">Surabhi Coins</p>
                      <p className="font-bold">{selectedCustomer.surabhiCoins}</p>
                    </div>
                    <div>
                      <p className="text-red-700">Go Seva Total</p>
                      <p className="font-bold">₹{selectedCustomer.goSevaContribution}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Sale Amount (₹)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter sale amount"
                        value={saleAmount}
                        onChange={(e) => setSaleAmount(e.target.value)}
                        className="pl-10 h-12"
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coins">Use Surabhi Coins (Optional)</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="coins"
                        type="number"
                        placeholder="Enter coins to use"
                        value={surabhiCoinsToUse}
                        onChange={(e) => setSurabhiCoinsToUse(e.target.value)}
                        className="pl-10 h-12"
                        max={selectedCustomer.surabhiCoins}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Maximum: {selectedCustomer.surabhiCoins} coins available
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="payment">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
                          <span className="text-sm font-medium text-yellow-900">Surabhi Coins Earned</span>
                          <span className="font-bold text-yellow-600">+{Math.floor(saleCalculation.surabhiCoinsEarned)}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium text-red-900">Go Seva Contribution</span>
                        <span className="font-bold text-red-600">₹{Math.floor(saleCalculation.goSevaContribution)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleSale}
                  disabled={isLoading || !saleAmount || !paymentMethod || !saleCalculation}
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                >
                  {isLoading ? (
                    'Processing Sale...'
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Sale
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Select a Customer</p>
                <p className="text-sm">Choose a customer from the list to process a sale</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
