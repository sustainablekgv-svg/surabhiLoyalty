import { useState } from 'react';
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
  Eye
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  rechargeWallet: number;
  surabhiCoins: number;
  goSevaContribution: number;
  totalReferrals: number;
  joinDate: string;
  status: 'active' | 'inactive';
}

export const UserManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: '1',
      name: 'Amit Patel',
      mobile: '9876543210',
      email: 'amit@example.com',
      storeLocation: 'Downtown Branch',
      rechargeWallet: 2500,
      surabhiCoins: 250,
      goSevaContribution: 125,
      totalReferrals: 3,
      joinDate: '2024-01-15',
      status: 'active'
    },
    {
      id: '2',
      name: 'Sneha Singh',
      mobile: '8765432109',
      email: 'sneha@example.com',
      storeLocation: 'Mall Branch',
      rechargeWallet: 1800,
      surabhiCoins: 180,
      goSevaContribution: 90,
      totalReferrals: 1,
      joinDate: '2024-02-10',
      status: 'active'
    },
    {
      id: '3',
      name: 'Rahul Gupta',
      mobile: '7654321098',
      email: 'rahul@example.com',
      storeLocation: 'Downtown Branch',
      rechargeWallet: 3200,
      surabhiCoins: 320,
      goSevaContribution: 160,
      totalReferrals: 5,
      joinDate: '2024-01-20',
      status: 'active'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const storeLocations = [
    'Downtown Branch',
    'Mall Branch',
    'Airport Branch',
    'Central Plaza'
  ];

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.mobile.includes(searchTerm) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLocation = filterLocation === 'all' || customer.storeLocation === filterLocation;
    const matchesStatus = filterStatus === 'all' || customer.status === filterStatus;
    
    return matchesSearch && matchesLocation && matchesStatus;
  });

  const totalStats = {
    totalUsers: customers.length,
    activeUsers: customers.filter(c => c.status === 'active').length,
    totalWalletAmount: customers.reduce((sum, c) => sum + c.rechargeWallet, 0),
    totalSurabhiCoins: customers.reduce((sum, c) => sum + c.surabhiCoins, 0),
    totalGoSevaContribution: customers.reduce((sum, c) => sum + c.goSevaContribution, 0),
    totalReferrals: customers.reduce((sum, c) => sum + c.totalReferrals, 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">View and manage all customer accounts</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Total Users</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{totalStats.totalUsers}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Active Users</span>
            </div>
            <p className="text-xl font-bold text-green-900">{totalStats.activeUsers}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Total Wallet</span>
            </div>
            <p className="text-xl font-bold text-purple-900">₹{totalStats.totalWalletAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Surabhi Coins</span>
            </div>
            <p className="text-xl font-bold text-amber-900">{totalStats.totalSurabhiCoins.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-600">Seva Pool</span>
            </div>
            <p className="text-xl font-bold text-red-900">₹{totalStats.totalGoSevaContribution.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-600">Total Referrals</span>
            </div>
            <p className="text-xl font-bold text-indigo-900">{totalStats.totalReferrals}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
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
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {storeLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
                <div className="flex-1 min-w-0 w-full lg:w-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                    <h3 className="font-medium text-gray-900">{customer.name}</h3>
                    <div className="flex gap-2">
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {customer.totalReferrals} referrals
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
                      <span>₹{customer.rechargeWallet.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-600">
                      <Coins className="h-3 w-3" />
                      <span>{customer.surabhiCoins} coins</span>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
