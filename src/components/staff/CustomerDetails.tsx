import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  Wallet,
  Coins,
  Calendar,
  Users,
  Gift,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export const CustomerDetails = () => {
  const { customerMobile } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!customerMobile) {
          throw new Error('Mobile number is missing');
        }

        // Query customers collection where mobile matches
        const customersRef = collection(db, 'customers');
        const q = query(customersRef, where('mobile', '==', customerMobile));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error('Customer not found');
        }

        // Get the first matching customer (assuming mobile numbers are unique)
        const doc = querySnapshot.docs[0];
        setCustomer({
          id: doc.id,
          ...doc.data()
        } as unknown as Customer);
      } catch (err) {
        console.error('Error fetching customer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load customer data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [customerMobile]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading customer details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Error Loading Customer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-600">
              If the problem persists, please contact admin Ms. with this reference: {customerMobile}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>Customer Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">The requested customer could not be found.</p>
            <Button onClick={() => navigate(-1)}>
              Return to Customer List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Button 
        variant="outline" 
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Customers
      </Button>

      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-100 p-3 rounded-full">
          <User className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={customer.registered ? 'default' : 'outline'}>
              {customer.registered ? 'Registered' : 'Unregistered'}
            </Badge>
            {customer.role && (
              <Badge variant="secondary">
                {customer.role}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <CardTitle>Basic Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Mobile Number</p>
              <div className="flex items-center gap-2 mt-1">
                <Phone className="h-4 w-4 text-gray-500" />
                <p className="font-medium">{customer.mobile}</p>
              </div>
            </div>

            {customer.email && (
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <p className="font-medium">{customer.email}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500">Store Location</p>
              <p className="font-medium mt-1">{customer.storeLocation}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Created At</p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <p className="font-medium">{formatDate(customer.createdAt?.toString())}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet & Coins */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-500" />
              <CardTitle>Wallet & Coins</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Wallet Balance</p>
              <div className="flex items-center gap-2 mt-1">
                <Wallet className="h-4 w-4 text-purple-500" />
                <p className="font-medium">₹{customer.walletBalance?.toLocaleString() || '0'}</p>
              </div>
            </div>

            {customer.walletId && (
              <div>
                <p className="text-sm text-gray-500">Wallet ID</p>
                <p className="font-medium mt-1">{customer.walletId}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500">Surabhi Coins</p>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-4 w-4 text-amber-500" />
                <p className="font-medium">{customer.surabhiCoins?.toLocaleString() || '0'}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500">Seva Coins (Total)</p>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-4 w-4 text-green-500" />
                <p className="font-medium">{customer.sevaCoinsTotal?.toLocaleString() || '0'}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500">Seva Coins (This Month)</p>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-4 w-4 text-green-500" />
                <p className="font-medium">{customer.sevaCoinsCurrentMonth?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity & Referrals */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <CardTitle>Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Last Transaction Date</p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <p className="font-medium">{formatDate(customer.lastTransactionDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {customer.referredBy || customer.referredUsers?.length ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <CardTitle>Referral Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.referredBy && (
                <div>
                  <p className="text-sm text-gray-500">Referred By</p>
                  <p className="font-medium mt-1">{customer.referredBy}</p>
                </div>
              )}

              {customer.referredUsers?.length ? (
                <div>
                  <p className="text-sm text-gray-500">Referred Users ({customer.referredUsers.length})</p>
                  <div className="mt-2 space-y-2">
                    {customer.referredUsers.map((ref, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <Gift className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">{ref.uid}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(ref.referralDate)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  No referred users found
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};