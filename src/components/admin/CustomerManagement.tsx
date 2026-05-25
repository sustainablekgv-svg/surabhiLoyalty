// src/components/CustomerManagement.tsx
import { addDoc, collection, doc, getDoc, getDocs, collectionGroup, increment, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import {
    Coins,
    Edit,
    Eye,
    Filter,
    Key,
    Loader2,
    MapPin,
    Phone,
    RefreshCw,
    Search,
    ShoppingCart,
    Truck,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';

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
import { PasswordInput } from '@/components/ui/password-input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { useActiveStores, useCustomers, useInvalidateQueries } from '@/hooks/useFirebaseQueries';
import { useFilterPreferences } from '@/hooks/useLocalStorage';
import { decryptText, encryptText, isEncrypted } from '@/lib/encryption';
import { db } from '@/lib/firebase';
import { CustomerType } from '@/types/types';
import { TransactionHistory } from '../customer/TransactionHistory';
import { notifyCustomerCartReminderSms } from '@/services/saleSmsNotification';

export const CustomerManagement = () => {
  // ==========================================
  // 1. Hook Declarations (React Query & Cache Hooks)
  // ==========================================
  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useCustomers();
  const { data: stores = [], isLoading: storesLoading } = useActiveStores();
  const { invalidateCustomers } = useInvalidateQueries();

  // ==========================================
  // 2. State Declarations & Local Storage Hooks
  // ==========================================
  const [filterPreferences, setFilterPreferences] = useFilterPreferences({
    startDate: '',
    endDate: '',
    activeTab: 'sales' as const,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const { debouncedSearchTerm } = useDebouncedSearch(searchTerm);
  const [filterStore, setFilterStore] = useState(filterPreferences.storeFilter || 'all');
  const [editCustomer, setEditCustomer] = useState<CustomerType | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Partial<CustomerType>>({});
  const [activeTab, setActiveTab] = useState<'customers' | 'decrypt' | 'carts'>('customers');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shippingAdjustment, setShippingAdjustment] = useState<number>(0);
  const [customerCarts, setCustomerCarts] = useState<any[]>([]);
  const [loadingCarts, setLoadingCarts] = useState(false);
  const [sendingSmsForCustomer, setSendingSmsForCustomer] = useState<string | null>(null);
  const [timeTick, setTimeTick] = useState(0);
  const [cartSearchQuery, setCartSearchQuery] = useState('');
  const [cartVisibleCount, setCartVisibleCount] = useState(5);
  const cartSentinelRef = useRef<HTMLDivElement | null>(null);

  // ==========================================
  // 3. Derived Variables & Computed Properties
  // ==========================================
  const loading = customersLoading || storesLoading;

  const demoStoreLocations = stores
    .filter(store => store.demoStore === true)
    .map(store => store.storeName);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch =
      customer.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      customer.customerMobile.includes(debouncedSearchTerm) ||
      (customer.customerEmail && customer.customerEmail.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

    const matchesStore = filterStore === 'all' || customer.storeLocation === filterStore;

    return matchesSearch && matchesStore;
  });

  const totalStats = {
    totalCustomers: customers.filter(customer => customer.demoStore === false).length,
    registeredCustomers: customers.filter(
      c => c.walletRechargeDone && c.demoStore === false
    ).length,
    guestCustomers: customers.filter(c => !c.walletRechargeDone && c.demoStore === false)
      .length,
    totalWalletBalance: customers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + (c.walletBalance || 0), 0),
    totalSurabhiCoins: customers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + (c.surabhiBalance || 0), 0),
    totalSevaCoins: customers
      .filter(cust => cust.demoStore === false)
      .reduce((sum, c) => sum + (c.sevaTotal || 0), 0),
    totalReferrals: customers
      .filter(cust => cust.demoStore === false && cust.referredBy !== null && cust.referredBy !== '')
      .length,
    activeThisMonth: customers
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

  // ==========================================
  // 4. Helper Functions & Event Handlers
  // ==========================================
  const getRelativeTime = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const now = new Date();
    const addedDate = new Date(dateString);
    const diffMs = now.getTime() - addedDate.getTime();
    
    if (diffMs < 0) return 'just now';
    
    const totalMins = Math.floor(diffMs / 60000);
    if (totalMins < 1) return 'just now';
    
    const days = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mins = totalMins % 60;
    
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (mins > 0) parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);
    
    return parts.join(', ') + ' ago';
  };

  const fetchCustomerCarts = async () => {
    try {
      setLoadingCarts(true);
      const cartQuery = query(collectionGroup(db, 'cart'));
      const querySnapshot = await getDocs(cartQuery);
      
      const cartsData: any[] = [];
      const productCache: Record<string, any> = {};

      for (const docSnap of querySnapshot.docs) {
        const rawItems = docSnap.data().items || [];
        if (rawItems.length > 0) {
          // Parse customerId from path to be robust
          const pathParts = docSnap.ref.path.split('/');
          const customerId = pathParts[1]; // Customers/{customerId}/cart/items
          
          if (customerId) {
            // Enrich items with images from products collection if missing
            const enrichedItems = [];
            for (const item of rawItems) {
              let imageUrl = item.image || '';
              if (!imageUrl && item.productId) {
                if (productCache[item.productId]) {
                  imageUrl = productCache[item.productId].image || '';
                } else {
                  try {
                    const prodDoc = await getDoc(doc(db, 'products', item.productId));
                    if (prodDoc.exists()) {
                      const prodData = prodDoc.data();
                      productCache[item.productId] = prodData;
                      imageUrl = prodData.image || '';
                    }
                  } catch (err) {
                    console.error('Error fetching product for image enrichment:', err);
                  }
                }
              }
              enrichedItems.push({
                ...item,
                image: imageUrl,
              });
            }

            // Find in cache first
            let customerInfo = customers.find(c => c.id === customerId);
            
            // If not in cache, fetch directly from Firestore to support newly registered/missed records
            if (!customerInfo) {
              try {
                const custDoc = await getDoc(doc(db, 'Customers', customerId));
                if (custDoc.exists()) {
                  customerInfo = {
                    id: custDoc.id,
                    ...custDoc.data()
                  } as any;
                }
              } catch (err) {
                console.error('Error fetching customer doc directly:', err);
              }
            }
            
            cartsData.push({
              customerId,
              items: enrichedItems,
              customerName: customerInfo?.customerName || 'Guest Customer',
              customerMobile: customerInfo?.customerMobile || '',
            });
          }
        }
      }
      setCustomerCarts(cartsData);
    } catch (error) {
      console.error('Error fetching customer carts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch customer carts',
        variant: 'destructive',
      });
    } finally {
      setLoadingCarts(false);
    }
  };

  const handleSendReminder = async (customerMobile: string, customerName: string, itemCount: number) => {
    if (!customerMobile) {
      toast({
        title: 'Error',
        description: 'Customer mobile is not available',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSendingSmsForCustomer(customerMobile);
      
      const result = await notifyCustomerCartReminderSms({
        phone: customerMobile,
        customerName,
        itemCount,
        url: 'https://www.sustainablekgv.com/shop',
      });
      
      if (!result.success) {
        throw new Error(result.reason || 'Failed to send SMS');
      }

      // Log this activity to firestore
      await addDoc(collection(db, 'Activity'), {
        type: 'cart_reminder_sms',
        remarks: `Sent cart reminder SMS to ${customerName} (${customerMobile}) for ${itemCount} items`,
        customerName,
        customerMobile,
        createdAt: Timestamp.now(),
        demoStore: false
      });

      toast({
        title: 'Success',
        description: `SMS reminder sent successfully to ${customerName}`,
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error sending cart reminder SMS:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send SMS reminder. Please check your credentials.',
        variant: 'destructive',
      });
    } finally {
      setSendingSmsForCustomer(null);
    }
  };

  const updateFilterStore = (value: string) => {
    setFilterStore(value);
    setFilterPreferences(prev => ({ ...prev, storeFilter: value }));
  };

  const viewCustomerDetails = (customer: CustomerType) => {
    setSelectedCustomer(customer);
    setIsCustomerDialogOpen(true);
  };

  const getReferralCount = (mobile: string) => {
    return customers.filter(c => c.referredBy === mobile && c.demoStore === false).length;
  };

  const handleEditClick = (customer: CustomerType) => {
    setEditCustomer(customer);
    setEditedData({
      customerName: customer.customerName,
      customerEmail: customer.customerEmail,
      dateOfBirth: customer.dateOfBirth || '',
      storeLocation: customer.storeLocation,
      city: customer.city || 'N/A',
      district: customer.district || 'N/A',
      walletBalance: customer.walletBalance,
      surabhiBalance: customer.surabhiBalance,
      sevaTotal: customer.sevaTotal,
      shippingBalance: customer.shippingBalance || 0,
      walletRechargeDone: customer.walletRechargeDone,
      tpin: customer.tpin ? (isEncrypted(customer.tpin) ? decryptText(customer.tpin) : customer.tpin) : '',
      customerPassword: customer.customerPassword ? (isEncrypted(customer.customerPassword) ? decryptText(customer.customerPassword) : customer.customerPassword) : '',
    });
    setShippingAdjustment(0);
    setIsEditDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const isNumericField =
      name === 'walletBalance' ||
      name === 'surabhiBalance' ||
      name === 'sevaTotal' ||
      name === 'shippingBalance';

    if (isNumericField) {
      const parsed = parseFloat(value);
      const numeric = Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
      setEditedData(prev => ({
        ...prev,
        [name]: numeric,
      }));
      return;
    }

    setEditedData(prev => ({
      ...prev,
      [name]: value,
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

      const customerDoc = querySnapshot.docs[0];

      const updateData: any = {
        customerName: editedData.customerName,
        customerEmail: editedData.customerEmail,
        storeLocation: editedData.storeLocation,
        city: editedData.city,
        district: editedData.district,
        walletBalance: editedData.walletBalance,
        surabhiBalance: editedData.surabhiBalance,
        sevaTotal: editedData.sevaTotal,
        shippingBalance: increment(shippingAdjustment),
        walletRechargeDone: editedData.walletRechargeDone,
        updatedAt: Timestamp.now(),
      };

      if (shippingAdjustment !== 0) {
          if (shippingAdjustment > 0) {
              updateData.shippingCredit = increment(shippingAdjustment);
          } else {
              updateData.shippingDebit = increment(Math.abs(shippingAdjustment));
          }
      }

      if (editedData.tpin && editedData.tpin.trim() !== '') {
        updateData.tpin = encryptText(editedData.tpin.trim());
      }

      if (editedData.customerPassword && editedData.customerPassword.trim() !== '') {
        updateData.customerPassword = encryptText(editedData.customerPassword.trim());
      }

      await updateDoc(customerDoc.ref, updateData);

      invalidateCustomers();

      if (shippingAdjustment !== 0) {
          await addDoc(collection(db, 'Activity'), {
              type: 'shipping_adjustment',
              remarks: `Admin adjusted shipping balance by ${shippingAdjustment > 0 ? '+' : ''}${shippingAdjustment} for ${editedData.customerName}`,
              amount: shippingAdjustment,
              customerName: editedData.customerName,
              customerMobile: editCustomer.customerMobile,
              storeLocation: editedData.storeLocation,
              createdAt: Timestamp.now(),
              demoStore: editCustomer.demoStore || false
          });
      }

      toast({
        title: 'Success',
        description: 'Customer details updated successfully',
        variant: 'default',
      });
      setIsEditDialogOpen(false);
      setShippingAdjustment(0);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update customer details',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      invalidateCustomers();

      setTimeout(() => {
        toast({
          title: 'Success',
          description: 'Customer data refreshed successfully',
          variant: 'default',
        });
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh customer data',
        variant: 'destructive',
      });
      setIsRefreshing(false);
    }
  };

  // ==========================================
  // 5. Effects (React Lifecycle Events)
  // ==========================================
  useEffect(() => {
    if (activeTab === 'carts') {
      fetchCustomerCarts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'carts') return;
    const interval = setInterval(() => {
      setTimeTick((prev) => prev + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'carts' || !cartSentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCartVisibleCount((prev) => prev + 5);
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = cartSentinelRef.current;
    observer.observe(currentSentinel);
    return () => observer.unobserve(currentSentinel);
  }, [activeTab, cartSentinelRef.current]);


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
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details">
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
                    {selectedCustomer.dateOfBirth && (
                      <p>
                        <span className="text-muted-foreground">Date of Birth:</span>{' '}
                        {new Date(selectedCustomer.dateOfBirth).toLocaleDateString()}
                      </p>
                    )}
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
                      {(selectedCustomer.walletBalance || 0).toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">This Month:</span> ₹
                      {(selectedCustomer.walletBalanceCurrentMonth || 0).toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Surabhi Balance:</span>{' '}
                      {(selectedCustomer.surabhiBalance || 0).toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">This Month:</span>{' '}
                      {(selectedCustomer.surabhiBalanceCurrentMonth || 0).toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Seva Balance:</span>{' '}
                      {(selectedCustomer.sevaTotal || 0).toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Shipping Balance:</span> ₹
                      {(selectedCustomer.shippingBalance || 0).toFixed(2)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">This Month:</span> ₹
                      {(selectedCustomer.shippingBalanceCurrentMonth || 0).toFixed(2)}
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
                    <span className="text-muted-foreground">Total Referred:</span>{' '}
                    {getReferralCount(selectedCustomer.customerMobile)} users
                  </p>
                  <p>
                    <span className="text-muted-foreground">Referral Income:</span>{' '}
                    {selectedCustomer.surabhiReferral
                      ? `₹${selectedCustomer.surabhiReferral.toFixed(2)}`
                      : 'N/A'}
                  </p>

                  {/* List of referred users (subset from customers list) */}
                  {(() => {
                    const referredOnes = customers.filter(c => c.referredBy === selectedCustomer.customerMobile);
                    if (referredOnes.length > 0) {
                      return (
                        <div>
                          <p className="font-medium mt-2">Referred Users:</p>
                          <div className="border rounded p-2 mt-1 max-h-40 overflow-y-auto">
                            {referredOnes.map((user, index) => (
                              <div
                                key={index}
                                className="flex justify-between py-1 border-b last:border-b-0"
                              >
                                <span>{user.customerName} ({user.customerMobile})</span>
                                <span className="text-muted-foreground">
                                  {user.createdAt instanceof Timestamp
                                    ? user.createdAt.toDate().toLocaleDateString()
                                    : 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
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
                      {selectedCustomer.customerPassword
                        ? (isEncrypted(selectedCustomer.customerPassword) ? decryptText(selectedCustomer.customerPassword) : selectedCustomer.customerPassword)
                        : 'N/A'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">TPIN:</span>{' '}
                      {selectedCustomer.tpin ? (isEncrypted(selectedCustomer.tpin) ? decryptText(selectedCustomer.tpin) : selectedCustomer.tpin) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
              
              <TabsContent value="ledger">
                <div className="py-4">
                  <TransactionHistory userId={selectedCustomer.id} demoStore={selectedCustomer.demoStore || false} />
                </div>
              </TabsContent>
            </Tabs>
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
              <Label htmlFor="dateOfBirth" className="text-right">
                Date of Birth
              </Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={editedData.dateOfBirth || ''}
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
                step="any"
                value={editedData.walletBalance ?? 0}
                onChange={handleInputChange}
                className="col-span-3"
                placeholder="Negative values allowed (admin override)"
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
                step="any"
                value={editedData.surabhiBalance ?? 0}
                onChange={handleInputChange}
                className="col-span-3"
                placeholder="Negative values allowed (admin override)"
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
                step="any"
                value={editedData.sevaTotal ?? 0}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shippingBalance" className="text-right">
                Current Shipping Bal
              </Label>
              <Input
                id="shippingBalance"
                value={(editedData.shippingBalance ?? 0).toFixed(2)}
                className="col-span-3"
                disabled
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shippingAdjustment" className="text-right text-indigo-600 font-bold">
                Adjust Shipping (±)
              </Label>
              <Input
                id="shippingAdjustment"
                name="shippingAdjustment"
                type="number"
                step="any"
                value={shippingAdjustment}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  setShippingAdjustment(Number.isFinite(parsed) ? parsed : 0);
                }}
                className="col-span-3 border-indigo-200 focus:ring-indigo-500"
                placeholder="Ex: +10 or -5 (negatives allowed)"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerPassword" className="text-right">
                Login Password
              </Label>
              <PasswordInput
                id="customerPassword"
                name="customerPassword"
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
              <PasswordInput
                id="tpin"
                name="tpin"
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
          <Button
            variant={activeTab === 'carts' ? 'default' : 'outline'}
            onClick={() => setActiveTab('carts')}
            className="h-10 text-xs xs:text-sm w-full xs:w-auto justify-start xs:justify-center"
          >
            <ShoppingCart className="h-3.5 w-3.5 xs:h-4 xs:w-4 mr-1.5 xs:mr-2" />
            Cart Tracking (SMS)
          </Button>
        </div>
      </div>

      {activeTab === 'customers' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-between items-start sm:items-center">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Management</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
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
                              {getReferralCount(customer.customerMobile)} referrals
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
                            <span>₹{(customer.walletBalance || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-amber-600">
                            <Coins className="h-3 w-3" />
                            <span>{(customer.surabhiBalance || 0).toFixed(2)} coins</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-indigo-600">
                            <Truck className="h-3 w-3" />
                            <span>₹{(customer.shippingBalance || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-blue-600">
                            <ShoppingCart className="h-3 w-3" />
                            <span>₹{(customer.cumTotal || 0).toFixed(2)}</span>
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
      ) : activeTab === 'carts' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Cart Tracking & Reminders</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Monitor active shopping carts and send SMS recovery notifications
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCustomerCarts}
              disabled={loadingCarts}
              className="flex items-center gap-2 w-full md:w-auto justify-center"
            >
              <RefreshCw className={`h-4 w-4 ${loadingCarts ? 'animate-spin' : ''}`} />
              Refresh Carts
            </Button>
          </div>

          {/* Search Carts Input */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone, product name, brand..."
              value={cartSearchQuery}
              onChange={(e) => {
                setCartSearchQuery(e.target.value);
                setCartVisibleCount(5); // Reset visible count on new search
              }}
              className="w-full h-11 pl-10 pr-10 rounded-full border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent shadow-sm"
            />
            {cartSearchQuery && (
              <button
                onClick={() => {
                  setCartSearchQuery('');
                  setCartVisibleCount(5);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {loadingCarts ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : (
            (() => {
              const cartsWithCustomerInfo = customerCarts.map(cartData => {
                return {
                  ...cartData,
                  customerName: cartData.customerName || 'Guest Customer',
                  customerMobile: cartData.customerMobile || '',
                };
              }).filter(c => c.items.length > 0);

              let filteredCarts = cartsWithCustomerInfo;

              if (cartSearchQuery.trim()) {
                const fuse = new Fuse(cartsWithCustomerInfo, {
                  keys: [
                    'customerName',
                    'customerMobile',
                    'items.name',
                    'items.brandName'
                  ],
                  threshold: 0.3,
                });
                const searchResults = fuse.search(cartSearchQuery.trim());
                filteredCarts = searchResults.map(res => res.item);
              }

              if (filteredCarts.length === 0) {
                return (
                  <Card className="border border-dashed border-gray-200">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <ShoppingCart className="h-12 w-12 text-gray-300 mb-4" />
                      <h3 className="font-semibold text-gray-700 text-lg mb-1">No Active Carts Found</h3>
                      <p className="text-sm text-gray-500 max-w-sm">
                        {cartSearchQuery ? 'No carts match your search terms.' : 'There are currently no customers with items pending in their shopping carts.'}
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              const paginatedCarts = filteredCarts.slice(0, cartVisibleCount);

              return (
                <div className="space-y-6">
                  {paginatedCarts.map(cart => {
                    const totalCartValue = cart.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                    return (
                      <Card key={cart.customerId} className="border border-gray-150 shadow-sm overflow-hidden hover:border-purple-200 transition-all duration-200">
                        <CardHeader className="bg-gradient-to-r from-purple-50/50 to-amber-50/30 border-b border-gray-100 p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 text-base sm:text-lg">
                                  {cart.customerName}
                                </span>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 font-semibold border-purple-200">
                                  {cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)} items
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600">
                                <span className="flex items-center gap-1 font-medium">
                                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                                  {cart.customerMobile || 'No Phone Number'}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className="font-semibold text-purple-600">
                                  Value: ₹{totalCartValue.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            
                            <Button
                              onClick={() => handleSendReminder(cart.customerMobile, cart.customerName, cart.items.length)}
                              disabled={sendingSmsForCustomer === cart.customerMobile || !cart.customerMobile}
                              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm font-semibold rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 shadow-sm transition-all duration-150"
                            >
                              {sendingSmsForCustomer === cart.customerMobile ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Phone className="h-4 w-4" />
                                  Remind via SMS
                                </>
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cart.items.map((item: any, index: number) => (
                              <div key={`${item.productId}-${index}`} className="flex items-center gap-3 p-3 bg-gray-50/70 border border-gray-100 rounded-lg hover:bg-white hover:shadow-sm transition-all duration-150">
                                <div className="h-14 w-14 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-400">
                                      <ShoppingCart className="h-6 w-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-800 text-sm truncate">{item.name}</h4>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <span className="font-semibold text-gray-700">Qty: {item.quantity}</span>
                                    <span>•</span>
                                    <span className="font-medium text-purple-600">₹{item.price} each</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
                                    <span>Added:</span>
                                    <span>
                                      {item.addedAt ? getRelativeTime(item.addedAt) : 'Before update (N/A)'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Infinite Scroll Sentinel element */}
                  {cartVisibleCount < filteredCarts.length && (
                    <div
                      ref={cartSentinelRef}
                      className="flex justify-center items-center py-6 text-gray-400 text-xs font-semibold gap-2 animate-pulse"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                      Loading more active carts...
                    </div>
                  )}
                </div>
              );
            })()
          )}
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
