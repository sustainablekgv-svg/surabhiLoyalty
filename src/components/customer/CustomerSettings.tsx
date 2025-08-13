import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { CustomerType } from '@/types/types';

interface CustomerSettingsProps {
  user: {
    id: string;
    name?: string;
    mobile: string;
    role: string;
  };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CustomerSettings = ({ user, isOpen, onOpenChange }: CustomerSettingsProps) => {
  const [formData, setFormData] = useState<Partial<CustomerType>>({
    customerName: '',
    customerPassword: '',
    tpin: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerType | null>(null);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        // Fetch customer data directly using the user.id
        const customerRef = doc(db, 'Customers', user.id);
        const customerSnapshot = await getDoc(customerRef);

        if (customerSnapshot.exists()) {
          const data = customerSnapshot.data() as CustomerType;
          setCustomerData(data);
          setFormData({
            customerName: data.customerName,
            customerPassword: data.customerPassword,
            tpin: data.tpin,
          });
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
        toast.error('Failed to load your profile information');
      }
    };

    if (isOpen && user.id) {
      fetchCustomerData();
    }
  }, [isOpen, user.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveChanges = async () => {
    if (!user.id) return;

    setIsUpdating(true);
    try {
      // Only include fields that have values and are different from current
      const updateData: Partial<CustomerType> = {};

      // Required fields that should always be included if they exist in formData
      if (formData.customerName && formData.customerName !== customerData?.customerName) {
        updateData.customerName = formData.customerName;
      }

      // Conditional updates for sensitive fields
      if (formData.tpin && formData.tpin !== customerData?.tpin) {
        updateData.tpin = formData.tpin;
      }

      if (
        formData.customerPassword &&
        formData.customerPassword !== customerData?.customerPassword
      ) {
        updateData.customerPassword = formData.customerPassword;
      }

      // Verify we have at least one field to update
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes detected');
        return;
      }

      // Update customer document directly using user.id
      const customerRef = doc(db, 'Customers', user.id);
      await updateDoc(customerRef, updateData);

      console.log('Customer record updated for ID:', user.id);
      toast.success('Profile updated successfully');

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating customer profile:', error);
      toast.error('Update failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold">Account Settings</DialogTitle>
          <DialogDescription className="text-gray-600 text-sm mt-1">
            Update your personal information here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* <div className="space-y-2">
            <Label htmlFor="mobile" className="text-sm font-semibold">Mobile Number</Label>
            <Input
              id="mobile"
              value={formData.customerMobile}
              disabled
              className="bg-gray-100 text-gray-700 font-medium"
            />
          </div> */}

          <div className="space-y-2">
            <Label htmlFor="customerName" className="text-sm font-semibold">
              Full Name
            </Label>
            <Input
              id="customerName"
              name="customerName"
              value={formData.customerName || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPassword" className="text-sm font-semibold">
              Password
            </Label>
            <Input
              id="customerPassword"
              name="customerPassword"
              type="text"
              value={formData.customerPassword || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpin" className="text-sm font-semibold">
              Transaction PIN (TPIN)
            </Label>
            <Input
              id="tpin"
              name="tpin"
              type="text"
              value={formData.tpin || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium"
            />
          </div>
        </div>

        <DialogFooter className="mt-6 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSaveChanges}
            disabled={isUpdating}
            className="min-w-[120px] bg-primary hover:bg-primary/90 text-white font-medium"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
