import { safeDecryptText } from '@/lib/encryption';
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Calendar, Edit3, Key, Lock, Phone, RefreshCw, Save, Settings, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/auth-context';
import { encryptText } from '@/lib/encryption';
import { db } from '@/lib/firebase';
import { CustomerType } from '@/types/types';

interface AccountSettingsProps {
  userId: string;
}

export const AccountSettings = ({ userId }: AccountSettingsProps) => {
  const { user } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingTpin, setIsEditingTpin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newTpin, setNewTpin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!userId) return;

      setLoading(true);
      try {
        const docRef = doc(db, 'Customers', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const customer = { id: docSnap.id, ...docSnap.data() } as CustomerType;
          setCustomerData(customer);
        } else {
          setError('No customer data found');
        }
      } catch (err) {
        // console.error('Error fetching customer data:', err);
        setError('Failed to fetch customer data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [userId]);

  const handleSavePassword = async () => {
    if (!customerData || !newPassword.trim()) {
      toast.error('Please enter a valid password');
      return;
    }
    
    // Manual check for strength logic used in component
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    
    if (newPassword.length < 6 || !(hasNumber || hasSpecial || hasUpper)) {
        toast.error("Password must be at least 6 characters and include a number, special char, or uppercase letter.");
        return;
    }

    setIsSaving(true);
    try {
      const encryptedPassword = encryptText(newPassword.trim());
      const docRef = doc(db, 'Customers', userId);
      await updateDoc(docRef, {
        customerPassword: encryptedPassword,
      });

      setCustomerData(prev => (prev ? { ...prev, customerPassword: encryptedPassword } : null));
      setIsEditingPassword(false);
      setNewPassword('');
      toast.success('Password updated successfully');
    } catch (error) {
      // console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTpin = async () => {
    if (!customerData || !newTpin.trim() || newTpin.trim().length !== 4) {
      toast.error('Please enter a valid 4-digit TPIN');
      return;
    }

    setIsSaving(true);
    try {
      const encryptedTpin = encryptText(newTpin.trim());
      const docRef = doc(db, 'Customers', userId);
      await updateDoc(docRef, {
        tpin: encryptedTpin,
      });

      setCustomerData(prev => (prev ? { ...prev, tpin: encryptedTpin } : null));
      setIsEditingTpin(false);
      setNewTpin('');
      toast.success('TPIN updated successfully');
    } catch (error) {
      // console.error('Error updating TPIN:', error);
      toast.error('Failed to update TPIN');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelPasswordEdit = () => {
    setIsEditingPassword(false);
    setNewPassword('');
  };

  const handleCancelTpinEdit = () => {
    setIsEditingTpin(false);
    setNewTpin('');
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCustomerData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const docRef = doc(db, 'Customers', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const customer = { id: docSnap.id, ...docSnap.data() } as CustomerType;
        setCustomerData(customer);
      } else {
        setError('No customer data found');
      }
    } catch (err) {
      // console.error('Error fetching customer data:', err);
      setError('Failed to fetch customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCustomerData();
    toast.success('Data refreshed successfully');
    setIsRefreshing(false);
  };

  function formatCreatedAt(createdAt: unknown): string {
    if (createdAt instanceof Timestamp) {
      return createdAt.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    if (createdAt instanceof Date) {
      return createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      return new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return 'N/A';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading account settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">No customer data available</div>
      </div>
    );
  }

  const memberSince = formatCreatedAt(customerData.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
        </div>
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
      <p className="text-gray-600">Update your personal information here.</p>

      {/* Customer Info Card (Moved from Dashboard Overview) */}
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {customerData.customerName}
                </h2>
                <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
                  Member since {memberSince}
                  {customerData.demoStore && (
                    <Badge className="bg-black text-white text-[10px] rounded-full px-2">
                      Demo Customer
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:flex md:items-center md:gap-8">
                {/* Password Section */}
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Lock className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-600">Your Password</p>
                    {isEditingPassword ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="text"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="h-8 text-xs w-32"
                          disabled={isSaving}
                        />
                        <Button
                          size="sm"
                          onClick={handleSavePassword}
                          disabled={isSaving}
                          className="h-8 w-8 p-0"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelPasswordEdit}
                          disabled={isSaving}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm sm:text-base font-bold">
                          {customerData.customerPassword
                            ? safeDecryptText(customerData.customerPassword) ||
                              customerData.customerPassword
                            : 'N/A'}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingPassword(true)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* TPIN Section */}
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Key className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-600">Your T Pin</p>
                    {isEditingTpin ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="text"
                          value={newTpin}
                          onChange={e => setNewTpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="4-digit PIN"
                          className="h-8 text-xs w-28"
                          disabled={isSaving}
                          maxLength={4}
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveTpin}
                          disabled={isSaving}
                          className="h-8 w-8 p-0"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelTpinEdit}
                          disabled={isSaving}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm sm:text-base font-bold">
                          {customerData.tpin
                            ? safeDecryptText(customerData.tpin) || customerData.tpin
                            : 'N/A'}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingTpin(true)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone Section */}
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Phone className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-600">Your referral number</p>
                    <p className="text-sm sm:text-base font-bold mt-1">
                      {customerData.customerMobile}
                    </p>
                  </div>
                </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date of Birth Section */}
      <Card className="shadow-lg border-0 bg-white">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base">
             <Calendar className="h-5 w-5 text-orange-600" />
             Other Details
           </CardTitle>
         </CardHeader>
         <CardContent>
            {customerData.dateOfBirth && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                  <p className="text-sm font-semibold">{new Date(customerData.dateOfBirth).toLocaleDateString()}</p>
                </div>
            )}
         </CardContent>
      </Card>
    </div>
  );
};
