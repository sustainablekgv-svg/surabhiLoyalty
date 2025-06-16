import { useState } from 'react';
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
  Calendar
} from 'lucide-react';

interface StoreUsersProps {
  storeLocation: string;
}

interface StoreCustomer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  rechargeWallet: number;
  surabhiCoins: number;
  goSevaContribution: number;
  totalReferrals: number;
  lastTransaction: string;
  joinDate: string;
  status: 'active' | 'inactive';
}

export const StoreUsers = ({ storeLocation }: StoreUsersProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customers] = useState<StoreCustomer[]>([
    {
      id: '1',
      name: 'Amit Patel',
      mobile: '9876543210',
      email: 'amit@example.com',
      rechargeWallet: 2500,
      surabhiCoins: 250,
      goSevaContribution: 125,
      totalReferrals: 3,
      lastTransaction: '2024-06-15',
      joinDate: '2024-01-15',
      status: 'active'
    },
    {
      id: '2',
      name: 'Sneha Singh',
      mobile: '8765432109',
      email: 'sneha@example.com',
      rechargeWallet: 1800,
      surabhiCoins: 180,
      goSevaContribution: 90,
      totalReferrals: 1,
      lastTransaction: '2024-06-14',
      joinDate: '2024-02-10',
      status: 'active'
    },
    {
      id: '3',
      name: 'Rahul Gupta',
      mobile: '7654321098',
      email: 'rahul@example.com',
      rechargeWallet: 3200,
      surabhiCoins: 320,
      goSevaContribution: 160,
      totalReferrals: 5,
      lastTransaction: '2024-06-13',
      joinDate: '2024-01-20',
      status: 'active'
    },
    {
      id: '4',
      name: 'Priya Sharma',
      mobile: '9988776655',
      email: 'priya@example.com',
      rechargeWallet: 500,
      surabhiCoins: 50,
      goSevaContribution: 25,
      totalReferrals: 0,
      lastTransaction: '2024-05-28',
      joinDate: '2024-05-20',
      status: 'inactive'
    }
  ]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile.includes(searchTerm) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalUsers: customers.length,
    activeUsers: customers.filter(c => c.status === 'active').length,
    totalWallet: customers.reduce((sum, c) => sum + c.rechargeWallet, 0),
    totalCoins: customers.reduce((sum, c) => sum + c.surabhiCoins, 0)
  };

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
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Active Users</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{stats.activeUsers}</p>
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
              <span className="text-xs font-medium text-amber-600">Total Coins</span>
            </div>
            <p className="text-xl font-bold text-amber-900">{stats.totalCoins.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
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
                      {customer.totalReferrals > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {customer.totalReferrals} referrals
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-3 w-3" />
                      <span>{customer.mobile}</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-600">
                      <Wallet className="h-3 w-3" />
                      <span>₹{customer.rechargeWallet.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-600">
                      <Coins className="h-3 w-3" />
                      <span>{customer.surabhiCoins} coins</span>
                    </div>
                    <div className="flex items-center gap-2 text-red-600">
                      <Heart className="h-3 w-3" />
                      <span>₹{customer.goSevaContribution}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Joined: {customer.joinDate}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Last: {customer.lastTransaction}</span>
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
                <p className="text-sm">Try adjusting your search terms</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
