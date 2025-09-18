import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { decryptText, encryptText } from '@/lib/encryption';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
          // Decrypt password and TPIN for display
          let decryptedPassword = '';
          let decryptedTpin = '';

          try {
            decryptedPassword = data.customerPassword ? decryptText(data.customerPassword) : '';
          } catch (error) {
            console.error('Error decrypting password:', error);
            decryptedPassword = 'Error decrypting password';
          }

          try {
            decryptedTpin = data.tpin ? decryptText(data.tpin) : '';
          } catch (error) {
            console.error('Error decrypting TPIN:', error);
            decryptedTpin = 'Error decrypting TPIN';
          }

          setFormData({
            customerName: data.customerName,
            customerPassword: decryptedPassword,
            tpin: decryptedTpin,
          });
        }
      } catch (error) {
        // console.error('Error fetching customer data:', error);
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

      // Conditional updates for sensitive fields - encrypt both password and TPIN
      if (formData.tpin) {
        // Decrypt stored TPIN to compare with current input
        let storedTpin = '';
        try {
          storedTpin = customerData?.tpin ? decryptText(customerData.tpin) : '';
        } catch (error) {
          console.error('Error decrypting stored TPIN:', error);
        }

        if (formData.tpin !== storedTpin) {
          updateData.tpin = encryptText(formData.tpin.trim());
        }
      }

      if (formData.customerPassword) {
        // Decrypt stored password to compare with current input
        let storedPassword = '';
        try {
          storedPassword = customerData?.customerPassword
            ? decryptText(customerData.customerPassword)
            : '';
        } catch (error) {
          console.error('Error decrypting stored password:', error);
        }

        if (formData.customerPassword !== storedPassword) {
          updateData.customerPassword = encryptText(formData.customerPassword.trim());
        }
      }

      // Verify we have at least one field to update
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes detected');
        return;
      }

      // Update customer document directly using user.id
      const customerRef = doc(db, 'Customers', user.id);
      await updateDoc(customerRef, updateData);

      // console.log('Customer record updated for ID:', user.id);
      toast.success('Profile updated successfully');

      onOpenChange(false);
    } catch (error) {
      // console.error('Error updating customer profile:', error);
      toast.error('Update failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] p-3 xs:p-4 sm:p-6">
        <DialogHeader className="pb-1.5 xs:pb-2 sm:pb-4">
          <DialogTitle className="text-base xs:text-lg sm:text-xl font-bold">
            Account Settings
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-[10px] xs:text-xs sm:text-sm mt-0.5 xs:mt-1">
            Update your personal information here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 xs:space-y-3 sm:space-y-5 py-1.5 xs:py-2 sm:py-4">
          {/* <div className="space-y-2">
            <Label htmlFor="mobile" className="text-sm font-semibold">Mobile Number</Label>
            <Input
              id="mobile"
              value={formData.customerMobile}
              disabled
              className="bg-gray-100 text-gray-700 font-medium"
            />
          </div> */}

          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label
              htmlFor="customerName"
              className="text-[10px] xs:text-xs sm:text-sm font-semibold"
            >
              Full Name
            </Label>
            <Input
              id="customerName"
              name="customerName"
              value={formData.customerName || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium h-8 xs:h-9 sm:h-10 text-xs xs:text-sm px-2 xs:px-3"
            />
          </div>

          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label
              htmlFor="customerPassword"
              className="text-[10px] xs:text-xs sm:text-sm font-semibold"
            >
              Password
            </Label>
            <Input
              id="customerPassword"
              name="customerPassword"
              type="text"
              value={formData.customerPassword || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium h-8 xs:h-9 sm:h-10 text-xs xs:text-sm px-2 xs:px-3"
            />
          </div>

          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label htmlFor="tpin" className="text-[10px] xs:text-xs sm:text-sm font-semibold">
              Transaction PIN (TPIN)
            </Label>
            <Input
              id="tpin"
              name="tpin"
              type="text"
              value={formData.tpin || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium h-8 xs:h-9 sm:h-10 text-xs xs:text-sm px-2 xs:px-3"
            />
          </div>
        </div>

        <DialogFooter className="mt-3 xs:mt-4 sm:mt-6 gap-1.5 xs:gap-2 sm:gap-3 flex-col xs:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="min-w-[80px] xs:min-w-[100px] h-8 xs:h-9 sm:h-10 text-[10px] xs:text-xs sm:text-sm w-full xs:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSaveChanges}
            disabled={isUpdating}
            className="min-w-[100px] xs:min-w-[120px] bg-primary hover:bg-primary/90 text-white font-medium h-8 xs:h-9 sm:h-10 text-[10px] xs:text-xs sm:text-sm w-full xs:w-auto"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
