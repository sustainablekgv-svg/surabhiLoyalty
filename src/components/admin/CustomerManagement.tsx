// src/components/CustomerManagement.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Users, 
  Phone, 
  MapPin,
  Wallet,
  Coins,
  Heart,
  Eye,
  Loader2
} from 'lucide-react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Customer, StoreType } from '@/types/types';
export const CustomerManagement = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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
    surabhiCoins: data.surabhiCoins || 0,
    surabhiCoinsCurrentMonth: data.surabhiCoinsCurrentMonth || 0,
    sevaCoinsTotal: data.sevaCoinsTotal || 0,
    sevaCoinsCurrentMonth: data.sevaCoinsCurrentMonth || 0,
    registered: data.registered ?? false,
    createdAt: data.createdAt ?? Timestamp.now(),
    role: data.role || 'customer',
    walletId: data.walletId || '',
    customerPassword: data.customerPassword || '',
    lastTransactionDate: data.lastTransactionDate ?? null, // Keep as Firestore Timestamp or null
    referredBy: data.referredBy || '',
    referredUsers: (data.referredUsers || []).map((ref: any) => ({
      mobile: ref.mobile, // Changed from uid to mobile to match interface
      referralDate: ref.referralDate
    })),
    referralIncome: 0,
    tpin: '',
    walletBalanceCurrentMonth: 0
  });
});
        console.log("The customers information in line 69 is", customersData)
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
        location: data.location,
        address: data.address,
        contactNumber: data.contactNumber,
        status: data.status,
        createdAt: data.createdAt?.toDate(), // Convert Firestore Timestamp to Date
        updatedAt: data.updatedAt?.toDate(),  // Convert Firestore Timestamp to Date
        walletCommission: data.walletCommission ?? 0,
        surabhiCommission: data.surabhiCommission ?? 0,
        sevaCommission: data.sevaCommission ?? 0
      }; 
    })
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
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' ? customer.registered : !customer.registered);
    
    return matchesSearch && matchesStore && matchesStatus;
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

  const viewCustomerDetails = (mobile: string) => {
    navigate(`/customer/${mobile}`);
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
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {totalStats.guestCustomers} guests
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
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Registered</SelectItem>
                  <SelectItem value="inactive">Guests</SelectItem>
                </SelectContent>
              </Select>
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
                      onClick={() => viewCustomerDetails(customer.mobile)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
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