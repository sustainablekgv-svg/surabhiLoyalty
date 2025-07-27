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
  Eye,
  Filter,
  UserCheck,
  UserX,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  Calendar
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Customer, StoreUsersProps } from "@/types/types";
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const StoreUsers = ({ storeLocation }: StoreUsersProps) => {
  console.log("THe store location is", storeLocation);
  const [searchTerm, setSearchTerm] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [sortField, setSortField] = useState<'name' | 'walletBalance' | 'surabhiCoins' | 'lastTransactionDate'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        const customersRef = collection(db, 'customers');

        // First query to get customers by store location
        const q = query(
          customersRef,
          where('storeLocation', '==', storeLocation)
        );

        const querySnapshot = await getDocs(q);
        const customersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as unknown as Customer[];

        // Sort locally by lastTransactionDate if needed
        customersData.sort((a, b) => {
          const dateA = a.lastTransactionDate ? a.lastTransactionDate.toDate().getTime() : 0;
          const dateB = b.lastTransactionDate ? b.lastTransactionDate.toDate().getTime() : 0;
          return dateB - dateA; // Descending order
        });

        setCustomers(customersData);

        // Get top customers by wallet balance (local sort)
        const topByWallet = [...customersData]
          .sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0))
          .slice(0, 5);
        setTopCustomers(topByWallet);

      } catch (err) {
        console.error('Error fetching customers:', err);
        setError(`Failed to load customers. ${err instanceof Error ? err.message : 'Please try again.'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [storeLocation]);

  const filteredCustomers = customers
    .filter(customer => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.mobile.includes(searchTerm) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRegistration =
        registrationFilter === 'all' ||
        (registrationFilter === 'registered' && customer.registered) ||
        (registrationFilter === 'unregistered' && !customer.registered);

      return matchesSearch && matchesRegistration;
    })
    .sort((a, b) => {
      let comparison = 0;

      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'walletBalance') {
        comparison = (a.walletBalance || 0) - (b.walletBalance || 0);
      } else if (sortField === 'surabhiCoins') {
        comparison = (a.surabhiCoins || 0) - (b.surabhiCoins || 0);
      } else if (sortField === 'lastTransactionDate') {
        const dateA = a.lastTransactionDate ? a.lastTransactionDate.toDate().getTime() : 0;
        const dateB = b.lastTransactionDate ? b.lastTransactionDate.toDate().getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const stats = {
    totalUsers: customers.length,
    registeredUsers: customers.filter(c => c.registered).length,
    totalWallet: customers.reduce((sum, c) => sum + (c.walletBalance || 0), 0),
    totalCoins: customers.reduce((sum, c) => sum + (c.surabhiCoins || 0), 0),
    currentMonthCoins: customers.reduce((sum, c) => sum + (c.sevaCoinsCurrentMonth || 0), 0)
  };

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateInput: string | Date | Timestamp): string => {
    try {
      let date: Date;

      if (dateInput instanceof Timestamp) {
        date = dateInput.toDate();
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else {
        return 'Invalid date';
      }

      if (isNaN(date.getTime())) return 'Invalid date';

      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const viewCustomerDetails = (customerId: string) => {
    navigate(`/customers/${customerId}`);
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

      {/* Top Customers Section */}
      {topCustomers.length > 0 && (
        <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Top Customers by Wallet Balance
            </CardTitle>
            <CardDescription>
              Our most valuable customers at {storeLocation}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.mobile}
                  className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => viewCustomerDetails(customer.mobile)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 truncate">{customer.name}</h3>
                    <Badge variant="secondary" className="ml-2">#{index + 1}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-purple-600 text-sm">
                    <Wallet className="h-3 w-3" />
                    <span>₹{(customer.walletBalance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-600 text-sm mt-1">
                    <Coins className="h-3 w-3" />
                    <span>{(customer.surabhiCoins || 0).toLocaleString()} coins</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Last active: {formatDate(customer.lastTransactionDate)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

              <Select
                value={registrationFilter}
                onValueChange={(value: 'all' | 'registered' | 'unregistered') => setRegistrationFilter(value)}
              >
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th
                    className="pb-3 px-4 cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortField === 'name' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="pb-3 px-4">Contact</th>
                  <th
                    className="pb-3 px-4 cursor-pointer"
                    onClick={() => handleSort('walletBalance')}
                  >
                    <div className="flex items-center gap-1">
                      Wallet
                      {sortField === 'walletBalance' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    className="pb-3 px-4 cursor-pointer"
                    onClick={() => handleSort('surabhiCoins')}
                  >
                    <div className="flex items-center gap-1">
                      Coins
                      {sortField === 'surabhiCoins' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    className="pb-3 px-4 cursor-pointer"
                    onClick={() => handleSort('lastTransactionDate')}
                  >
                    <div className="flex items-center gap-1">
                      Last Activity
                      {sortField === 'lastTransactionDate' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.mobile} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{customer.mobile}</span>
                      </div>
                      {customer.email && (
                        <div className="text-xs text-gray-500 mt-1">{customer.email}</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-purple-600">
                        <Wallet className="h-4 w-4" />
                        <span>₹{(customer.walletBalance || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Coins className="h-4 w-4" />
                        <span>{(customer.surabhiCoins || 0).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        +{(customer.sevaCoinsCurrentMonth || 0).toLocaleString()} this month
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-500">
                        {formatDate(customer.lastTransactionDate)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={customer.registered ? 'default' : 'outline'}>
                        {customer.registered ? (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            Registered
                          </>
                        ) : (
                          <>
                            <UserX className="h-3 w-3 mr-1" />
                            Unregistered
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewCustomerDetails(customer.mobile)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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