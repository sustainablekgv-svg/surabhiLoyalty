import { format } from 'date-fns';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
  Users,
  Search,
  Phone,
  Wallet,
  Coins,
  Eye,
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { CustomerType, StoreUsersProps } from '@/types/types';

export const StoreUsers = ({ storeLocation }: StoreUsersProps) => {
  // console.log('THe store location is', storeLocation);
  const [searchTerm, setSearchTerm] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState<
    'all' | 'registered' | 'unregistered'
  >('all');
  const [sortField, setSortField] = useState<
    'name' | 'walletBalance' | 'surabhiCoins' | 'lastTransactionDate'
  >('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topCustomers, setTopCustomers] = useState<CustomerType[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        const customersRef = collection(db, 'Customers');

        // First query to get customers by store location
        const q = query(customersRef, where('storeLocation', '==', storeLocation));

        const querySnapshot = await getDocs(q);
        const customersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as CustomerType[];

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
        // console.error('Error fetching customers:', err);
        setError(
          `Failed to load customers. ${err instanceof Error ? err.message : 'Please try again.'}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [storeLocation]);

  const filteredCustomers = customers
    .filter(customer => {
      const matchesSearch =
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customerMobile.includes(searchTerm) ||
        (customer.customerEmail &&
          customer.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;

      if (sortField === 'name') {
        comparison = a.customerName.localeCompare(b.customerName);
      } else if (sortField === 'walletBalance') {
        comparison = (a.walletBalance || 0) - (b.walletBalance || 0);
      } else if (sortField === 'surabhiCoins') {
        comparison = (a.surabhiBalance || 0) - (b.surabhiBalance || 0);
      } else if (sortField === 'lastTransactionDate') {
        const dateA = a.lastTransactionDate ? a.lastTransactionDate.toDate().getTime() : 0;
        const dateB = b.lastTransactionDate ? b.lastTransactionDate.toDate().getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const stats = {
    totalUsers: customers.length,
    totalWallet: customers.reduce((sum, c) => sum + (c.walletBalance || 0), 0),
    totalCoins: customers.reduce((sum, c) => sum + (c.surabhiBalance || 0), 0),
    currentMonthCoins: customers.reduce((sum, c) => sum + (c.sevaBalanceCurrentMonth || 0), 0),
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
      // console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const viewCustomerDetails = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8 animate-spin text-blue-500" />
        <span className="ml-1.5 xs:ml-2 text-xs xs:text-sm sm:text-base">Loading customers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-xs xs:text-sm sm:text-base p-3 xs:p-4 sm:p-6">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 xs:space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 xs:gap-3 mb-4 xs:mb-5 sm:mb-6">
        <div className="bg-blue-100 p-2 xs:p-2.5 sm:p-3 rounded-full">
          <Users className="h-4 xs:h-5 sm:h-6 w-4 xs:w-5 sm:w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900">
            Store Customers
          </h2>
          <p className="text-xs xs:text-sm text-gray-600">
            Manage customers registered at {storeLocation}
          </p>
        </div>
      </div>

      {/* Store Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 xs:gap-3 sm:gap-4 mb-4 xs:mb-5 sm:mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-2 xs:p-3 sm:p-4">
            <div className="flex items-center gap-1.5 xs:gap-2 mb-1 xs:mb-1.5 sm:mb-2">
              <Users className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-blue-600" />
              <span className="text-[10px] xs:text-xs font-medium text-blue-600">
                Total Customers
              </span>
            </div>
            <p className="text-lg xs:text-xl sm:text-2xl font-bold text-blue-900">
              {stats.totalUsers}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-2 xs:p-3 sm:p-4">
            <div className="flex items-center gap-1.5 xs:gap-2 mb-1 xs:mb-1.5 sm:mb-2">
              <Wallet className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-purple-600" />
              <span className="text-[10px] xs:text-xs font-medium text-purple-600">
                Total Wallet
              </span>
            </div>
            <p className="text-base xs:text-lg sm:text-xl font-bold text-purple-900">
              ₹{stats.totalWallet.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-2 xs:p-3 sm:p-4">
            <div className="flex items-center gap-1.5 xs:gap-2 mb-1 xs:mb-1.5 sm:mb-2">
              <Coins className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-amber-600" />
              <span className="text-[10px] xs:text-xs font-medium text-amber-600">
                This Month Coins
              </span>
            </div>
            <p className="text-base xs:text-lg sm:text-xl font-bold text-amber-900">
              {Math.floor(stats.currentMonthCoins)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers Section */}
      {topCustomers.length > 0 && (
        <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader className="px-3 xs:px-4 sm:px-6 pt-3 xs:pt-4 sm:pt-6 pb-1 xs:pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-1.5 xs:gap-2 text-base xs:text-lg sm:text-xl">
              <Star className="h-3.5 xs:h-4 sm:h-5 w-3.5 xs:w-4 sm:w-5 text-yellow-500" />
              Top Customers by Wallet Balance
            </CardTitle>
            <CardDescription className="text-xs xs:text-sm">
              Our most valuable customers at {storeLocation}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 xs:px-4 sm:px-6 pb-3 xs:pb-4 sm:pb-6">
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 xs:gap-3 sm:gap-4">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.customerMobile}
                  className="bg-white p-2 xs:p-3 sm:p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => viewCustomerDetails(customer.customerMobile)}
                >
                  <div className="flex items-center justify-between mb-1 xs:mb-1.5 sm:mb-2">
                    <h3 className="font-medium text-gray-900 truncate text-xs xs:text-sm sm:text-base">
                      {customer.customerName}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="ml-1 xs:ml-1.5 sm:ml-2 text-[10px] xs:text-xs"
                    >
                      #{index + 1}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-purple-600 text-[10px] xs:text-xs sm:text-sm">
                    <Wallet className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                    <span>₹{(customer.walletBalance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-amber-600 text-[10px] xs:text-xs sm:text-sm mt-0.5 xs:mt-1">
                    <Coins className="h-2.5 xs:h-3 w-2.5 xs:w-3" />
                    <span>{(customer.surabhiBalance || 0).toFixed(2)} coins</span>
                  </div>
                  <div className="text-[8px] xs:text-[10px] sm:text-xs text-gray-500 mt-1 xs:mt-1.5 sm:mt-2">
                    Last active: {formatDate(customer.lastTransactionDate)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="px-3 xs:px-4 sm:px-6 pt-3 xs:pt-4 sm:pt-6 pb-1 xs:pb-2 sm:pb-3">
          <div className="flex flex-col gap-2 xs:gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row gap-2 xs:gap-3 sm:gap-4 justify-between items-start sm:items-center">
              <div>
                <CardTitle className="text-base xs:text-lg sm:text-xl">Customer List</CardTitle>
                <CardDescription className="text-xs xs:text-sm">
                  {filteredCustomers.length} customers at {storeLocation}
                </CardDescription>
              </div>

              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2 xs:left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-gray-400" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-7 xs:pl-8 sm:pl-10 w-full sm:w-64 h-8 xs:h-9 sm:h-10 text-xs xs:text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 xs:gap-3">
              <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2">
                <Filter className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-gray-500" />
                <span className="text-xs xs:text-sm text-gray-500">Filters:</span>
              </div>

              <Select
                value={registrationFilter}
                onValueChange={(value: 'all' | 'registered' | 'unregistered') =>
                  setRegistrationFilter(value)
                }
              >
                <SelectTrigger className="w-full xs:w-[150px] sm:w-[180px] h-8 xs:h-9 sm:h-10 text-xs xs:text-sm">
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

        <CardContent className="px-2 xs:px-3 sm:px-6 pb-3 xs:pb-4 sm:pb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] xs:text-xs sm:text-sm text-gray-500 border-b">
                  <th
                    className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4 cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-0.5 xs:gap-1">
                      Name
                      {sortField === 'name' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ) : (
                          <ChevronDown className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ))}
                    </div>
                  </th>
                  <th className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4">Contact</th>
                  <th
                    className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4 cursor-pointer"
                    onClick={() => handleSort('walletBalance')}
                  >
                    <div className="flex items-center gap-0.5 xs:gap-1">
                      Wallet
                      {sortField === 'walletBalance' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ) : (
                          <ChevronDown className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4 cursor-pointer"
                    onClick={() => handleSort('surabhiCoins')}
                  >
                    <div className="flex items-center gap-0.5 xs:gap-1">
                      Coins
                      {sortField === 'surabhiCoins' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ) : (
                          <ChevronDown className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4 cursor-pointer"
                    onClick={() => handleSort('lastTransactionDate')}
                  >
                    <div className="flex items-center gap-0.5 xs:gap-1">
                      Last Activity
                      {sortField === 'lastTransactionDate' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ) : (
                          <ChevronDown className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        ))}
                    </div>
                  </th>
                  <th className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4">Status</th>
                  <th className="pb-2 xs:pb-2.5 sm:pb-3 px-2 xs:px-3 sm:px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCustomers.map(customer => (
                  <tr key={customer.customerMobile} className="hover:bg-gray-50">
                    <td className="py-2 xs:py-3 sm:py-4 px-2 xs:px-3 sm:px-4">
                      <div className="font-medium text-gray-900 text-xs xs:text-sm sm:text-base">
                        {customer.customerName}
                      </div>
                    </td>
                    <td className="py-2 xs:py-3 sm:py-4 px-2 xs:px-3 sm:px-4">
                      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[10px] xs:text-xs sm:text-sm">
                        <Phone className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4 text-gray-400" />
                        <span>{customer.customerMobile}</span>
                      </div>
                      {customer.customerEmail && (
                        <div className="text-[8px] xs:text-[10px] sm:text-xs text-gray-500 mt-0.5 xs:mt-1">
                          {customer.customerEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-2 xs:py-3 sm:py-4 px-2 xs:px-3 sm:px-4">
                      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-purple-600 text-[10px] xs:text-xs sm:text-sm">
                        <Wallet className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        <span>₹{(customer.walletBalance || 0).toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="py-2 xs:py-3 sm:py-4 px-2 xs:px-3 sm:px-4">
                      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-amber-600 text-[10px] xs:text-xs sm:text-sm">
                        <Coins className="h-3 xs:h-3.5 sm:h-4 w-3 xs:w-3.5 sm:w-4" />
                        <span>{(customer.surabhiBalance || 0).toFixed(2)}</span>
                      </div>
                      <div className="text-[8px] xs:text-[10px] sm:text-xs text-green-600 mt-0.5 xs:mt-1">
                        +₹{(customer.sevaBalanceCurrentMonth || 0).toFixed(2)} this month
                      </div>
                    </td>
                    <td className="py-2 xs:py-3 sm:py-4 px-2 xs:px-3 sm:px-4">
                      <div className="text-[10px] xs:text-xs sm:text-sm text-gray-500">
                        {formatDate(customer.lastTransactionDate)}
                      </div>
                    </td>
                    <td className="py-2 xs:py-3 sm:py-4 px-2 xs:px-3 sm:px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewCustomerDetails(customer.customerMobile)}
                        className="h-6 xs:h-7 sm:h-8 text-[10px] xs:text-xs sm:text-sm px-1.5 xs:px-2 sm:px-2.5 py-0.5 xs:py-1"
                      >
                        <Eye className="h-2.5 xs:h-3 w-2.5 xs:w-3 mr-0.5 xs:mr-1" />
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
