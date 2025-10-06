import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Calendar, Edit3, Lock, Save, Settings, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/auth-context';
import { decryptText, encryptText } from '@/lib/encryption';
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

  const getDecryptedPassword = () => {
    if (!customerData?.customerPassword) return 'N/A';
    try {
      return decryptText(customerData.customerPassword);
    } catch (error) {
      // console.error('Failed to decrypt password:', error);
      return 'Invalid Password';
    }
  };

  const getDecryptedTpin = () => {
    if (!customerData?.tpin) return 'N/A';
    try {
      return decryptText(customerData.tpin);
    } catch (error) {
      // console.error('Failed to decrypt TPIN:', error);
      return 'Invalid TPIN';
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
      </div>
      <p className="text-gray-600">Update your personal information here.</p>

      {/* Personal Information Card */}
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-600" />
            Personal Information
          </CardTitle>
          <CardDescription>Your basic account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <Label className="text-sm font-medium text-gray-700">Full Name</Label>
            <div className="md:col-span-2">
              <Input value={customerData.customerName} disabled className="bg-gray-50" />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <Label className="text-sm font-medium text-gray-700">Mobile Number</Label>
            <div className="md:col-span-2">
              <Input value={customerData.customerMobile} disabled className="bg-gray-50" />
            </div>
          </div>

          {/* Date of Birth */}
          {customerData.dateOfBirth && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date of Birth
              </Label>
              <div className="md:col-span-2">
                <Input
                  value={new Date(customerData.dateOfBirth).toLocaleDateString()}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Settings Card */}
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-600" />
            Security Settings
          </CardTitle>
          <CardDescription>Manage your password and TPIN for secure access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <Label className="text-sm font-medium text-gray-700">Password</Label>
            <div className="md:col-span-2">
              {isEditingPassword ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={isSaving}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePassword}
                    disabled={isSaving}
                    className="px-3"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelPasswordEdit}
                    disabled={isSaving}
                    className="px-3"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={getDecryptedPassword()} disabled className="flex-1 bg-gray-50" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingPassword(true)}
                    className="px-3"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* TPIN */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <Label className="text-sm font-medium text-gray-700">TPIN (4-digit)</Label>
            <div className="md:col-span-2">
              {isEditingTpin ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newTpin}
                    onChange={e => setNewTpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Enter 4-digit TPIN"
                    disabled={isSaving}
                    maxLength={4}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleSaveTpin} disabled={isSaving} className="px-3">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelTpinEdit}
                    disabled={isSaving}
                    className="px-3"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={getDecryptedTpin()} disabled className="flex-1 bg-gray-50" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingTpin(true)}
                    className="px-3"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
