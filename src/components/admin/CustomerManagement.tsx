// src/components/CustomerManagement.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { doc, query, updateDoc, where } from 'firebase/firestore';
import { 
  Search, 
  Filter, 
  Users, 
  Phone, 
  MapPin,
  Wallet,
  Coins,
  Eye,
  Loader2,
  Edit
} from 'lucide-react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer, StoreType } from '@/types/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const CustomerManagement = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  // const [filterStatus, setFilterStatus] = useState('all');
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Partial<Customer>>({});

  // Fetch customers from Firestore
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'customers'));
        const customersData: Customer[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          customersData.push({
          name: data.name,
          mobile: data.mobile,
          email: data.email || '',
          storeLocation: data.storeLocation || 'Unassigned',
          walletBalance: data.walletBalance || 0,
          walletRechargeDone: data.walletRechargeDone || false,
          walletBalanceCurrentMonth: data.walletBalanceCurrentMonth || 0,
          role: data.role || 'customer',
          walletId: data.walletId || '',
          surabhiCoins: data.surabhiCoins || 0,
          surabhiCoinsCurrentMonth: data.surabhiCoinsCurrentMonth || 0,
          sevaCoinsTotal: data.sevaCoinsTotal || 0,
          sevaCoinsCurrentMonth: data.sevaCoinsCurrentMonth || 0,
          referredBy: data.referredBy || null,
          saleElgibility: data.saleElgibility || false,
          referralSurabhi: data.referralSurabhi || 0,
          referredUsers: (data.referredUsers || []).map((ref: any) => ({
          mobile: ref.mobile,
          name: ref.name || '',
          referralDate: ref.referralDate || Timestamp.now()
          })),
          registered: data.registered ?? false,
          lastTransactionDate: data.lastTransactionDate || Timestamp.now(),
          createdAt: data.createdAt || Timestamp.now(),
          customerPassword: data.customerPassword || '',
          tpin: data.tpin || '',
          quarterlyPurchaseTotal: data.quarterlyPurchaseTotal || 0,
          coinsFrozen: data.coinsFrozen || false,
          currentQuarterStart: data.currentQuarterStart || null,
          lastQuarterCheck: data.lastQuarterCheck|| null
          });
        });
        setCustomers(customersData);
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchStores = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'stores'));
        const storesData: StoreType[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
        id: doc.id,
        name: data.name,
        storeLocation: data.location || data.storeLocation || '',
        address: data.address || '',
        referralCommission: data.referralCommission ?? 0,
        surabhiCommission: data.surabhiCommission ?? 0,
        sevaCommission: data.sevaCommission ?? 0,
        cashOnlyCommission: data.cashOnlyCommission ?? 0,
        contactNumber: data.contactNumber || '',
        status: data.status === 'active' || data.status === 'inactive' 
        ? data.status 
        : 'inactive', // Default to inactive if invalid status
        createdAt: data.createdAt instanceof Timestamp 
        ? data.createdAt 
        : Timestamp.fromDate(new Date(data.createdAt || new Date())),
        updatedAt: data.updatedAt instanceof Timestamp 
        ? data.updatedAt 
        : Timestamp.fromDate(new Date(data.updatedAt || new Date()))
        };
        });
        setStores(storesData);
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
    fetchStores();
  }, []);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.mobile.includes(searchTerm) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStore = filterStore === 'all' || customer.storeLocation === filterStore;
    // const matchesStatus = filterStatus === 'all' || 
    //                      (filterStatus === 'active' ? customer.registered : !customer.registered);
    
    return matchesSearch && matchesStore;
  });

  // Calculate analytics
  const totalStats = {
    totalCustomers: customers.length,
    registeredCustomers: customers.filter(c => c.registered).length,
    guestCustomers: customers.filter(c => !c.registered).length,
    totalWalletBalance: customers.reduce((sum, c) => sum + c.walletBalance, 0),
    totalSurabhiCoins: customers.reduce((sum, c) => sum + c.surabhiCoins, 0),
    totalSevaCoins: customers.reduce((sum, c) => sum + c.sevaCoinsTotal, 0),
    totalReferrals: customers.reduce((sum, c) => sum + (c.referredUsers?.length || 0), 0),
    activeThisMonth: customers.filter(c => {
      if (!c.lastTransactionDate) return false;
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const lastTxDate = typeof c.lastTransactionDate === 'string'
        ? new Date(c.lastTransactionDate)
        : c.lastTransactionDate;
      return lastTxDate > monthAgo;
    }).length
  };

  const viewCustomerDetails = (customer: Customer) => {
    console.log("Viewing customer details:", customer);
    setSelectedCustomer(customer);
    setIsCustomerDialogOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setEditCustomer(customer);
    setEditedData({
      name: customer.name,
      email: customer.email,
      storeLocation: customer.storeLocation,
      walletBalance: customer.walletBalance,
      surabhiCoins: customer.surabhiCoins,
      sevaCoinsTotal: customer.sevaCoinsTotal,
      registered: customer.registered,
      tpin: customer.tpin
    });
    setIsEditDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedData(prev => ({
      ...prev,
      [name]: name === 'walletBalance' || name === 'surabhiCoins' || name === 'sevaCoinsTotal'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setEditedData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggleChange = (name: string) => {
    setEditedData(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const saveCustomerChanges = async () => {
  if (!editCustomer?.mobile) {
    toast({
      title: "Error",
      description: "No customer mobile number provided",
      variant: "destructive",
    });
    return;
  }

  try {
    setIsSaving(true);
    
    // Query customers by mobile number
    const customersRef = collection(db, 'customers');
    console.log("THe line 219 data is", customersRef);
    const q = query(customersRef, where('mobile', '==', editCustomer.mobile));
    const querySnapshot = await getDocs(q);
        console.log("Query results:", {
        size: querySnapshot.size,
        docs: querySnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
        }))
        });
    
    if (querySnapshot.empty) {
      toast({
        title: "Failure",
        description: "No customer found with this mobile number",
        variant: "destructive",
      });
      return;
    }
    
    // Get the first matching document (assuming mobile numbers are unique)
    const customerDoc = querySnapshot.docs[0];
    
    // Update the document
    await updateDoc(customerDoc.ref, {
      name: editedData.name,
      email: editedData.email,
      storeLocation: editedData.storeLocation,
      walletBalance: editedData.walletBalance,
      surabhiCoins: editedData.surabhiCoins,
      sevaCoinsTotal: editedData.sevaCoinsTotal,
      registered: editedData.registered,
      tpin: editedData.tpin,
      updatedAt: Timestamp.fromDate(new Date())
    });

    // Update local state
    setCustomers(prev => prev.map(c => 
      c.mobile === editCustomer.mobile ? { ...c, ...editedData } : c
    ));

    toast({
      title: "Success",
      description: "Customer details updated successfully",
      variant: "default",
    });
    setIsEditDialogOpen(false);
  } catch (error) {
    console.error("Error updating customer:", error);
    toast({
      title: "Error",
      description: "Failed to update customer details",
      variant: "destructive",
    });
  } finally {
    setIsSaving(false);
  }
};

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Customer Details Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Basic Information</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {selectedCustomer.name}</p>
                    <p><span className="text-muted-foreground">Mobile:</span> {selectedCustomer.mobile}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedCustomer.email || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Store Location:</span> {selectedCustomer.storeLocation}</p>
                    <p><span className="text-muted-foreground">Registered:</span> {selectedCustomer.registered ? 'Yes' : 'No'}</p>
                    <p><span className="text-muted-foreground">Role:</span> {selectedCustomer.role}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium">Wallet Information</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <p><span className="text-muted-foreground">Wallet Balance:</span> ₹{selectedCustomer.walletBalance.toFixed(2)}</p>
                    <p><span className="text-muted-foreground">This Month:</span> ₹{selectedCustomer.walletBalanceCurrentMonth.toFixed(2)}</p>
                    <p><span className="text-muted-foreground">Surabhi Coins:</span> {selectedCustomer.surabhiCoins}</p>
                    <p><span className="text-muted-foreground">This Month:</span> {selectedCustomer.surabhiCoinsCurrentMonth}</p>
                    <p><span className="text-muted-foreground">Seva Coins:</span> {selectedCustomer.sevaCoinsTotal}</p>
                    <p><span className="text-muted-foreground">This Month:</span> {selectedCustomer.sevaCoinsCurrentMonth}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium">Referral Information</h4>
                <div className="space-y-2 mt-2 text-sm">
                  <p><span className="text-muted-foreground">Referred By:</span> {selectedCustomer.referredBy || 'N/A'}</p>
                  <p><span className="text-muted-foreground">Referral Income:</span> {selectedCustomer.referralSurabhi ? `₹${selectedCustomer.referralSurabhi.toFixed(2)}` : 'N/A'}</p>
                  
                  {selectedCustomer.referredUsers && selectedCustomer.referredUsers.length > 0 && (
                    <div>
                      <p className="font-medium mt-2">Referred Users:</p>
                      <div className="border rounded p-2 mt-1">
                        {selectedCustomer.referredUsers.map((user, index) => (
                          <div key={index} className="flex justify-between py-1 border-b last:border-b-0">
                            <span>{user.mobile}</span>
                            <span className="text-muted-foreground">
                            {user.referralDate instanceof Timestamp 
                              ? user.referralDate.toDate().toLocaleString() 
                              : new Date(user.referralDate).toLocaleString()}
                          </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Account Details</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <p><span className="text-muted-foreground">Wallet ID:</span> {selectedCustomer.walletId}</p>
                    <p><span className="text-muted-foreground">Created At:</span> {selectedCustomer.createdAt instanceof Timestamp
                      ? selectedCustomer.createdAt.toDate().toLocaleString()
                      : "N/A"}</p>
                    <p><span className="text-muted-foreground">Last Transaction:</span> {selectedCustomer.lastTransactionDate instanceof Timestamp
                      ? selectedCustomer.lastTransactionDate.toDate().toLocaleString()
                      : "N/A"}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium">Security</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <p><span className="text-muted-foreground">TPIN Set:</span> {selectedCustomer.tpin ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Customer Details</DialogTitle>
            <DialogDescription>
              Make changes to customer profile here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                value={editedData.name || ''}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mobile" className="text-right">
                Mobile
              </Label>
              <Input
                id="mobile"
                value={editCustomer?.mobile || ''}
                className="col-span-3"
                disabled
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={editedData.email || ''}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="storeLocation" className="text-right">
                Store Location
              </Label>
              <Select
                value={editedData.storeLocation || ''}
                onValueChange={(value) => handleSelectChange(value, 'storeLocation')}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.name}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="walletBalance" className="text-right">
                Wallet Balance
              </Label>
              <Input
                id="walletBalance"
                name="walletBalance"
                type="number"
                value={editedData.walletBalance || 0}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="surabhiCoins" className="text-right">
                Surabhi Coins
              </Label>
              <Input
                id="surabhiCoins"
                name="surabhiCoins"
                type="number"
                value={editedData.surabhiCoins || 0}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sevaCoinsTotal" className="text-right">
                Seva Coins
              </Label>
              <Input
                id="sevaCoinsTotal"
                name="sevaCoinsTotal"
                type="number"
                value={editedData.sevaCoinsTotal || 0}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tpin" className="text-right">
                Transaction PIN
              </Label>
              <Input
                id="tpin"
                name="tpin"
                type="text"
                value={editedData.tpin || ''}
                onChange={handleInputChange}
                className="col-span-3"
                placeholder="Set new PIN"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Account Status
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registered"
                  checked={Boolean(editedData.registered) || false}
                  onChange={() => handleToggleChange('registered')}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Label htmlFor="registered">
                  Registered User
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={saveCustomerChanges}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
          <p className="text-gray-600">View and manage all customer accounts</p>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{totalStats.totalCustomers}</p>
              </div>
              <div className="bg-primary/10 p-2 rounded-lg">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-muted-foreground">
                {totalStats.registeredCustomers} registered
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
                <p className="text-2xl font-bold">₹{totalStats.totalWalletBalance.toLocaleString()}</p>
              </div>
              <div className="bg-purple-500/10 p-2 rounded-lg">
                <Wallet className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-muted-foreground">
                {totalStats.activeThisMonth} active this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Loyalty Coins</p>
                <p className="text-2xl font-bold">{totalStats.totalSurabhiCoins.toLocaleString()}</p>
              </div>
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <Coins className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-muted-foreground">
                {totalStats.totalSevaCoins} Seva Coins
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Referrals</p>
                <p className="text-2xl font-bold">{totalStats.totalReferrals}</p>
              </div>
              <div className="bg-green-500/10 p-2 rounded-lg">
                <Users className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-muted-foreground">
                Top referrers
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>Customer Accounts</CardTitle>
              <CardDescription>
                {filteredCustomers.length} customers found
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, mobile or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="w-full sm:w-48">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="All Stores" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.name}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger> */}
                {/* <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Registered</SelectItem>
                  <SelectItem value="inactive">Guests</SelectItem>
                </SelectContent> */}
              {/* </Select> */}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No customers found matching your criteria</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div key={customer.mobile} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
                  <div className="flex-1 min-w-0 w-full lg:w-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                      <h3 className="font-medium text-gray-900">{customer.name}</h3>
                      <div className="flex gap-2">
                        <Badge variant={customer.registered ? 'default' : 'secondary'}>
                          {customer.registered ? 'Registered' : 'Guest'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {customer.referredUsers?.length || 0} referrals
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-3 w-3" />
                        <span>{customer.mobile}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-3 w-3" />
                        <span>{customer.storeLocation}</span>
                      </div>
                      <div className="flex items-center gap-2 text-purple-600">
                        <Wallet className="h-3 w-3" />
                        <span>₹{customer.walletBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-600">
                        <Coins className="h-3 w-3" />
                        <span>{customer.surabhiCoins} coins</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full lg:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 lg:flex-none"
                      onClick={() => viewCustomerDetails(customer)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 lg:flex-none"
                      onClick={() => handleEditClick(customer)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};