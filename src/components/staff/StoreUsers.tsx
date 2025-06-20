import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Search, 
  Phone, 
  Wallet,
  Coins,
  Heart,
  TrendingUp,
  Eye,
  Calendar,
  Filter,
  UserCheck,
  UserX,
  Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase'; // Your Firebase initialization file
import { collection, query, where, getDocs } from 'firebase/firestore';

import {Customer, StoreUsersProps} from "@/types/types"


export const StoreUsers = ({ storeLocation }: StoreUsersProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Create a reference to the customers collection
        const customersRef = collection(db, 'customers');
        
        // Create a query based on store location
        const q = query(
          customersRef, 
          where('storeLocation', '==', storeLocation)
        );
        
        // Execute the query
        const querySnapshot = await getDocs(q);
        
        // Map the documents to our customer interface
        const customersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as unknown as Customer[];
        
        setCustomers(customersData);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError('Failed to load customers. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [storeLocation]);

  const filteredCustomers = customers.filter(customer => {
    // Search term filter
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile.includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all';
    
    // Registration filter
    const matchesRegistration = 
      registrationFilter === 'all' || 
      (registrationFilter === 'registered' && customer.registered) ||
      (registrationFilter === 'unregistered' && !customer.registered);
    
    return matchesSearch && matchesStatus && matchesRegistration;
  });

  const stats = {
    totalUsers: customers.length,
    registeredUsers: customers.filter(c => c.registered).length,
    totalWallet: customers.reduce((sum, c) => sum + c.walletBalance, 0),
    totalCoins: customers.reduce((sum, c) => sum + c.surabhiCoins, 0),
    currentMonthCoins: customers.reduce((sum, c) => sum + c.sevaCoinsCurrentMonth, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading customers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <Users className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Store Customers</h2>
          <p className="text-gray-600">Manage customers registered at {storeLocation}</p>
        </div>
      </div>

      {/* Store Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Total Customers</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalUsers}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Registered</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{stats.registeredUsers}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Total Wallet</span>
            </div>
            <p className="text-xl font-bold text-purple-900">₹{stats.totalWallet.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">This Month Coins</span>
            </div>
            <p className="text-xl font-bold text-amber-900">{stats.currentMonthCoins.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <CardTitle>Customer List</CardTitle>
                <CardDescription>
                  {filteredCustomers.length} customers at {storeLocation}
                </CardDescription>
              </div>
              
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-500">Filters:</span>
              </div>
              
              {/* <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select> */}

              <Select value={registrationFilter} onValueChange={(value: 'all' | 'registered' | 'unregistered') => setRegistrationFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Registration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="unregistered">Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <div key={customer.mobile} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
                <div className="flex-1 min-w-0 w-full lg:w-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                    <h3 className="font-medium text-gray-900">{customer.name}</h3>
                    <div className="flex gap-2">
                      {/* <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge> */}
                      <Badge variant={customer.registered ? 'default' : 'outline'}>
                        {customer.registered ? (
                          <UserCheck className="h-3 w-3 mr-1" />
                        ) : (
                          <UserX className="h-3 w-3 mr-1" />
                        )}
                        {customer.registered ? 'Registered' : 'Unregistered'}
                      </Badge>
                      {/* {customer.totalReferrals > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {customer.totalReferrals} referrals
                        </Badge>
                      )} */}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-3 w-3" />
                      <span>{customer.mobile}</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-600">
                      <Wallet className="h-3 w-3" />
                      <span>₹{customer.walletBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-600">
                      <Coins className="h-3 w-3" />
                      <span>{customer.surabhiCoins} (Total)</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                      <Coins className="h-3 w-3" />
                      <span>{customer.sevaCoinsCurrentMonth} (This Month)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {/* <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Joined: {customer.createdAt}</span>
                    </div> */}
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Last: {customer.lastTransactionDate}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full lg:w-auto">
                  <Button variant="outline" size="sm" className="flex-1 lg:flex-none">
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            ))}
            
            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No customers found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};