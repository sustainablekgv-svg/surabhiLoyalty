import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Wallet, Coins, Gift, User, Mail, Phone, MapPin, Calendar, Shield, Users, CreditCard, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {Customer} from "@/types/types"

export const CustomerDetails = () => {
  const { mobile } = useParams<{ mobile: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  const fetchCustomer = async () => {
    try {
      const q = query(
        collection(db, 'customers'),
        where('mobile', '==', mobile)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Assuming mobile is unique, we take the first document
        const customerData = querySnapshot.docs[0].data() as Customer;
        setCustomer(customerData);
      } else {
        setError('Customer not found');
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  fetchCustomer();
}, [mobile]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Loading customer...</h1>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Customer Not Found</h1>
        </div>
        <div className="p-4 bg-yellow-50 text-yellow-600 rounded-lg">
          No customer found with mobile number: {mobile}
        </div>
      </div>
    );
  }

  // Format date if available
  const createdAtDate =
    customer.createdAt && typeof customer.createdAt === 'object' && 'toDate' in customer.createdAt
      ? (customer.createdAt as { toDate: () => Date }).toDate().toLocaleDateString()
      : 'Not available';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
        </div>
        {/* <Button variant="outline" onClick={() => navigate(`/customer/${mobile}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button> */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Mobile</p>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <p>{customer.mobile}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <p>{customer.email || 'Not provided'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Store Location</p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <p>{customer.storeLocation || 'Not specified'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Registered On</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <p>{createdAtDate}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <p>{customer.registered ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Information</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <p>₹{customer.walletBalance?.toLocaleString('en-IN') || '0'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wallet ID</p>
              <p className="font-mono text-sm">{customer.walletId || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Transaction</p>
              <p>
              {customer.lastTransactionDate 
              ? customer.lastTransactionDate.toDate().toLocaleString() 
              : 'No transactions yet'}
              </p>
</div>
            <div>
              <p className="text-xs text-muted-foreground">TPIN</p>
              <p className="font-mono">{customer.tpin || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Coins Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coins Information</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Surabhi Coins</p>
              <p className="text-lg font-medium">{customer.surabhiCoins?.toLocaleString() || '0'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Seva Coins</p>
              <p className="text-lg font-medium">{customer.sevaCoinsTotal?.toLocaleString() || '0'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Month Seva Coins</p>
              <p className="text-lg font-medium">{customer.sevaCoinsCurrentMonth?.toLocaleString() || '0'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Referral Information Card */}
        {customer.referredBy || customer.referredUsers ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referral Information</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.referredBy && (
                <div>
                  <p className="text-xs text-muted-foreground">Referred By</p>
                  <Button 
                    variant="link" 
                    className="h-auto p-0" 
                    onClick={() => navigate(`/customer/${customer.referredBy}`)}
                  >
                    {customer.referredBy}
                  </Button>
                </div>
              )}
              {customer.referralIncome !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Referral Income</p>
                  <p>₹{customer.referralIncome?.toLocaleString('en-IN') || '0'}</p>
                </div>
              )}
              {customer.referredUsers && customer.referredUsers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Referred Users</p>
                  <div className="space-y-2 mt-2">
                    {customer.referredUsers.map((user, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <Button 
                          variant="link" 
                          className="h-auto p-0" 
                          onClick={() => navigate(`/customer/${user.mobile}`)}
                        >
                          {user.mobile}
                        </Button>
                      <span className="text-xs text-muted-foreground">
                      {user.referralDate.toDate().toLocaleString()}
                      </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Additional Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Additional Information</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="capitalize">{customer.role || 'Customer'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Password</p>
              <p className="font-mono">{customer.customerPassword || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};