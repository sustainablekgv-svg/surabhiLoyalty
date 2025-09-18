// src/components/CustomerManagement.tsx
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { useActiveStores, useCustomers, useInvalidateQueries } from '@/hooks/useFirebaseQueries';
import { useFilterPreferences } from '@/hooks/useLocalStorage';
import { collection, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Coins, Edit, Eye, Filter, Key, Loader2, MapPin, Phone, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { PasswordDecryptor } from './PasswordDecryptor';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { encryptText } from '@/lib/encryption';
import { db } from '@/lib/firebase';
import { CustomerType } from '@/types/types';

export const CustomerManagement = () => {
  // Use cached data with React Query
  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useCustomers();
  const { data: stores = [], isLoading: storesLoading } = useActiveStores();
  const { invalidateCustomers } = useInvalidateQueries();

  // Use cached filter preferences
  const [filterPreferences, setFilterPreferences] = useFilterPreferences({
    startDate: '',
    endDate: '',
    activeTab: 'sales' as const,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const { debouncedSearchTerm } = useDebouncedSearch(searchTerm);
  const [filterStore, setFilterStore] = useState(filterPreferences.storeFilter || 'all');

  // Derived loading state
  const loading = customersLoading || storesLoading;
  const [editCustomer, setEditCustomer] = useState<CustomerType | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Partial<CustomerType>>({});
  const [activeTab, setActiveTab] = useState<'customers' | 'decrypt'>('customers');

  // Update filter preferences when store filter changes
  const updateFilterStore = (value: string) => {
    setFilterStore(value);
    setFilterPreferences(prev => ({ ...prev, storeFilter: value }));
  };

  // Get demo store locations to exclude from analytics
  const demoStoreLocations = stores
    .filter(store => store.demoStore === true)
    .map(store => store.storeName);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch =
      customer.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      customer.customerMobile.includes(debouncedSearchTerm) ||
      customer.customerEmail.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

    const matchesStore = filterStore === 'all' || customer.storeLocation === filterStore;

    return matchesSearch && matchesStore;
  });

  // Filter out customers from demo stores for analytics calculations
  // const nonDemoCustomers = customers.filter(
  //   customer => !demoStoreLocations.includes(customer.storeLocation)
  // );

  // Calculate analytics excluding demo store customers
  const totalStats = {
    totalCustomers: filteredCustomers.filter(customer => customer.demoStore === false).length,
    registeredCustomers: filteredCustomers.filter(
      c => c.walletRechargeDone && c.demoStore === false
    ).length,
    guestCustomers: filteredCustomers.filter(c => !c.walletRechargeDone && c.demoStore === false)
      .length,
    totalWalletBalance: filteredCustomers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + c.walletBalance, 0),
    totalSurabhiCoins: filteredCustomers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + c.surabhiBalance, 0),
    totalSevaCoins: filteredCustomers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + c.sevaTotal, 0),
    totalReferrals: filteredCustomers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + (c.referredUsers?.length || 0), 0),
    activeThisMonth: filteredCustomers
      .filter(cust => cust.demoStore === false)
      .filter(c => {
        if (!c.lastTransactionDate) return false;
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const lastTxDate =
          c.lastTransactionDate instanceof Timestamp
            ? c.lastTransactionDate.toDate()
            : new Date(c.lastTransactionDate);
        return lastTxDate > monthAgo;
      }).length,
  };

  const viewCustomerDetails = (customer: CustomerType) => {
    setSelectedCustomer(customer);
    setIsCustomerDialogOpen(true);
  };

  const handleEditClick = (customer: CustomerType) => {
    setEditCustomer(customer);
    setEditedData({
      customerName: customer.customerName,
      customerEmail: customer.customerEmail,
      storeLocation: customer.storeLocation,
      city: customer.city || 'N/A',
      district: customer.district || 'N/A',
      walletBalance: customer.walletBalance,
      surabhiBalance: customer.surabhiBalance,
      sevaTotal: customer.sevaTotal,
      walletRechargeDone: customer.walletRechargeDone,
      tpin: customer.tpin,
      customerPassword: customer.customerPassword,
    });
    setIsEditDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedData(prev => ({
      ...prev,
      [name]:
        name === 'walletBalance' || name === 'surabhiBalance' || name === 'sevaTotal'
          ? Number(parseFloat(value).toFixed(2)) || 0
          : value,
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setEditedData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveCustomerChanges = async () => {
    if (!editCustomer?.customerMobile) {
      toast({
        title: 'Error',
        description: 'No customer mobile number provided',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      // Query customers by mobile number
      const customersRef = collection(db, 'Customers');
      const q = query(customersRef, where('customerMobile', '==', editCustomer.customerMobile));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          title: 'Failure',
          description: 'No customer found with this mobile number',
          variant: 'destructive',
        });
        return;
      }

      // Get the first matching document (assuming mobile numbers are unique)
      const customerDoc = querySnapshot.docs[0];

      // Prepare update data with encryption for sensitive fields
      const updateData: any = {
        customerName: editedData.customerName,
        customerEmail: editedData.customerEmail,
        storeLocation: editedData.storeLocation,
        city: editedData.city,
        district: editedData.district,
        walletBalance: editedData.walletBalance,
        surabhiBalance: editedData.surabhiBalance,
        sevaTotal: editedData.sevaTotal,
        walletRechargeDone: editedData.walletRechargeDone,
        updatedAt: Timestamp.now(),
      };

      // Only encrypt and update TPIN if it's provided and not empty
      if (editedData.tpin && editedData.tpin.trim() !== '') {
        updateData.tpin = encryptText(editedData.tpin.trim());
      }

      // Only encrypt and update password if it's provided and not empty
      if (editedData.customerPassword && editedData.customerPassword.trim() !== '') {
        updateData.customerPassword = encryptText(editedData.customerPassword.trim());
      }

      // Update the document
      await updateDoc(customerDoc.ref, updateData);

      // Invalidate customers cache to refetch updated data
      invalidateCustomers();

      toast({
        title: 'Success',
        description: 'Customer details updated successfully',
        variant: 'default',
      });
      setIsEditDialogOpen(false);
    } catch (error) {
      // console.error('Error updating customer:', error);
      toast({
        title: 'Error',
        description: 'Failed to update customer details',
        variant: 'destructive',
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
                    <p>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      {selectedCustomer.customerName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Mobile:</span>{' '}
                      {selectedCustomer.customerMobile}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Email:</span>{' '}
                      {selectedCustomer.customerEmail || 'N/A'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Store Location:</span>{' '}
                      {selectedCustomer.storeLocation}
                    </p>
                    <p>
                      <span className="text-muted-foreground">City:</span>{' '}
                      {selectedCustomer?.city || 'N/A'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">District:</span>{' '}
                      {selectedCustomer?.district || 'N/A'}
                    </p>
                    {/* <p><span className="text-muted-foreground">Registered:</span> {selectedCustomer.walletRechargeDone ? 'Yes' : 'No'}</p> */}
                    <p>
                      <span className="text-muted-foreground">Role:</span> {selectedCustomer.role}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium">Wallet Information</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Wallet Balance:</span> ₹
                      {selectedCustomer.walletBalance.toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">This Month:</span> ₹
                      {selectedCustomer.walletBalanceCurrentMonth.toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Surabhi Balance:</span>{' '}
                      {selectedCustomer.surabhiBalance.toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">This Month:</span>{' '}
                      {selectedCustomer.surabhiBalanceCurrentMonth.toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Seva Balance:</span>{' '}
                      {selectedCustomer.sevaTotal.toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">This Month:</span>{' '}
                      {selectedCustomer.sevaBalanceCurrentMonth.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium">Referral Information</h4>
                <div className="space-y-2 mt-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Referred By:</span>{' '}
                    {selectedCustomer.referredBy || 'N/A'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Referral Income:</span>{' '}
                    {selectedCustomer.surabhiReferral
                      ? `₹${selectedCustomer.surabhiReferral.toFixed(2)}`
                      : 'N/A'}
                  </p>

                  {selectedCustomer.referredUsers && selectedCustomer.referredUsers.length > 0 && (
                    <div>
                      <p className="font-medium mt-2">Referred Users:</p>
                      <div className="border rounded p-2 mt-1">
                        {selectedCustomer.referredUsers.map((user, index) => (
                          <div
                            key={index}
                            className="flex justify-between py-1 border-b last:border-b-0"
                          >
                            <span>{user.customerMobile}</span>
                            <span className="text-muted-foreground">
                              {user.createdAt instanceof Timestamp
                                ? user.createdAt.toDate().toLocaleString()
                                : new Date(user.createdAt).toLocaleString()}
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
                    <p>
                      <span className="text-muted-foreground">Wallet ID:</span>{' '}
                      {selectedCustomer.walletId}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Created At:</span>{' '}
                      {selectedCustomer.createdAt instanceof Timestamp
                        ? selectedCustomer.createdAt.toDate().toLocaleString()
                        : 'N/A'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Last Transaction:</span>{' '}
                      {selectedCustomer.lastTransactionDate instanceof Timestamp
                        ? selectedCustomer.lastTransactionDate.toDate().toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium">Security</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Login Password:</span>{' '}
                      {selectedCustomer.customerPassword}
                    </p>
                    <p>
                      <span className="text-muted-foreground">TPIN:</span> {selectedCustomer.tpin}
                    </p>
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

          <div className="grid gap-2 xs:gap-3 sm:gap-4 py-2 xs:py-3 sm:py-4">
            <div className="grid grid-cols-4 items-center gap-2 xs:gap-3 sm:gap-4">
              <Label htmlFor="customerName" className="text-right text-xs xs:text-sm">
                Full Name
              </Label>
              <Input
                id="customerName"
                name="customerName"
                value={editedData.customerName || ''}
                onChange={handleInputChange}
                className="col-span-3 h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerMobile" className="text-right">
                Mobile
              </Label>
              <Input
                id="customerMobile"
                value={editCustomer?.customerMobile || ''}
                className="col-span-3"
                disabled
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerEmail" className="text-right">
                Email
              </Label>
              <Input
                id="customerEmail"
                name="customerEmail"
                type="email"
                value={editedData.customerEmail || ''}
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
                onValueChange={value => handleSelectChange(value, 'storeLocation')}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.storeName}>
                      {store.storeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="city" className="text-right">
                City
              </Label>
              <Input
                id="city"
                name="city"
                value={editedData.city || ''}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="district" className="text-right">
                District
              </Label>
              <Input
                id="district"
                name="district"
                value={editedData.district || ''}
                onChange={handleInputChange}
                className="col-span-3"
              />
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
              <Label htmlFor="surabhiBalance" className="text-right">
                Surabhi Coins
              </Label>
              <Input
                id="surabhiBalance"
                name="surabhiBalance"
                type="number"
                value={editedData.surabhiBalance || 0}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sevaTotal" className="text-right">
                Seva Coins
              </Label>
              <Input
                id="sevaTotal"
                name="sevaTotal"
                type="number"
                value={editedData.sevaTotal || 0}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerPassword" className="text-right">
                Login Password
              </Label>
              <Input
                id="customerPassword"
                name="customerPassword"
                type="text"
                value={editedData.customerPassword || ''}
                onChange={handleInputChange}
                className="col-span-3"
                placeholder="Set new Password"
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveCustomerChanges} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tab Navigation */}
      <div className="flex flex-col xs:flex-row gap-2 xs:gap-4 mb-4 xs:mb-6">
        <div className="flex flex-col xs:flex-row gap-1 xs:gap-2 w-full xs:w-auto">
          <Button
            variant={activeTab === 'customers' ? 'default' : 'outline'}
            onClick={() => setActiveTab('customers')}
            className="h-10 text-xs xs:text-sm w-full xs:w-auto justify-start xs:justify-center"
          >
            <Users className="h-3.5 w-3.5 xs:h-4 xs:w-4 mr-1.5 xs:mr-2" />
            Customer Management
          </Button>
          <Button
            variant={activeTab === 'decrypt' ? 'default' : 'outline'}
            onClick={() => setActiveTab('decrypt')}
            className="h-10 text-xs xs:text-sm w-full xs:w-auto justify-start xs:justify-center"
          >
            <Key className="h-3.5 w-3.5 xs:h-4 xs:w-4 mr-1.5 xs:mr-2" />
            Password Decryptor
          </Button>
        </div>
      </div>

      {activeTab === 'customers' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-between items-start sm:items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Management</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                View and manage all customer accounts
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                This tab shows customers of both live and demo stores
              </p>
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
                  {/* <span className="text-sm text-muted-foreground">
                {totalStats.registeredCustomers} registered
              </span> */}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
                    <p className="text-2xl font-bold">
                      ₹{totalStats.totalWalletBalance.toFixed(2)}
                    </p>
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
                    <p className="text-2xl font-bold">{totalStats.totalSurabhiCoins.toFixed(2)}</p>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-lg">
                    <Coins className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
                {/* <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-muted-foreground">
                {totalStats.totalSevaCoins.toFixed(2)} Seva Coins
              </span>
            </div> */}
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
                  <span className="text-sm text-muted-foreground">Total referrals</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                <div>
                  <CardTitle>Customer Accounts</CardTitle>
                  <CardDescription>{filteredCustomers.length} customers found</CardDescription>
                </div>

                <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
                  <div className="relative w-full xs:w-auto">
                    {/* <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" /> */}
                    <Input
                      placeholder="Search by name, mobile or email"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-14 w-full sm:w-64 h-8 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>

                  <Select value={filterStore} onValueChange={updateFilterStore}>
                    <SelectTrigger className="w-full xs:w-[150px] sm:w-48 h-8 sm:h-10 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <SelectValue placeholder="All Stores" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs sm:text-sm">
                        All Stores
                      </SelectItem>
                      {stores
                        .filter(store => !store.demoStore)
                        .map(store => (
                          <SelectItem
                            key={store.id}
                            value={store.storeName}
                            className="text-xs sm:text-sm"
                          >
                            {store.storeName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No customers found matching your criteria
                    </p>
                  </div>
                ) : (
                  filteredCustomers.map(customer => (
                    <div
                      key={customer.customerMobile}
                      className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg gap-2 sm:gap-4"
                    >
                      <div className="flex-1 min-w-0 w-full lg:w-auto">
                        <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <h3 className="font-medium text-gray-900 text-sm sm:text-base">
                            {customer.customerName}
                          </h3>
                          <div className="flex gap-1 sm:gap-2">
                            {customer.demoStore && (
                              <Badge
                                variant="default"
                                className="text-[10px] sm:text-xs py-0 sm:py-0.5"
                              >
                                Demo
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] sm:text-xs py-0 sm:py-0.5"
                            >
                              {customer.referredUsers?.length || 0} referrals
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-3 text-xs sm:text-sm">
                          <div className="flex items-center gap-1 sm:gap-2 text-gray-600">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{customer.customerMobile}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-gray-600">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{customer.storeLocation}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-purple-600">
                            <Wallet className="h-3 w-3" />
                            <span>₹{customer.walletBalance.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-amber-600">
                            <Coins className="h-3 w-3" />
                            <span>{customer.surabhiBalance.toFixed(2)} coins</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 lg:flex-none h-7 sm:h-8 text-[10px] sm:text-xs"
                          onClick={() => viewCustomerDetails(customer)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span className="hidden xs:inline">View Details</span>
                          <span className="xs:hidden">View</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 lg:flex-none h-7 sm:h-8 text-[10px] sm:text-xs"
                          onClick={() => handleEditClick(customer)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          <span className="hidden xs:inline">Edit</span>
                          <span className="xs:hidden">Edit</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <PasswordDecryptor
          title="Customer Password Decryptor"
          description="Enter an encrypted customer password to view its original value"
          placeholder="Enter encrypted customer password"
        />
      )}
    </div>
  );
};
