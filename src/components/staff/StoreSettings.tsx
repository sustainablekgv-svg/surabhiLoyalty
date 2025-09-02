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
import { StaffType } from '@/types/types';

interface StaffSettingsProps {
  user: {
    id: string;
    name?: string;
    mobile: string;
    role: string;
  };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StoreSettings = ({ user, isOpen, onOpenChange }: StaffSettingsProps) => {
  const [formData, setFormData] = useState<Partial<StaffType>>({
    staffName: '',
    staffPassword: '',
    staffPin: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [staffData, setStaffData] = useState<StaffType | null>(null);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        // Fetch staff data directly using the user.id
        const staffRef = doc(db, 'staff', user.id);
        const staffSnapshot = await getDoc(staffRef);

        if (staffSnapshot.exists()) {
          const data = staffSnapshot.data() as StaffType;
          setStaffData(data);
          setFormData({
            staffName: data.staffName,
            staffPassword: data.staffPassword,
            staffPin: data.staffPin,
          });
        }
      } catch (error) {
        // console.error('Error fetching staff data:', error);
        toast.error('Failed to load your profile information');
      }
    };

    if (isOpen && user.id) {
      fetchStaffData();
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

    // Validate required fields
    if (!formData.staffName || !formData.staffPassword || !formData.staffPin) {
      toast.error('All fields are required');
      return;
    }

    // Validate PIN format
    if (formData.staffPin && (formData.staffPin.length !== 4 || !/^\d+$/.test(formData.staffPin))) {
      toast.error('Store PIN must be a 4-digit number');
      return;
    }

    setIsUpdating(true);
    try {
      // Update staff document directly using user.id
      const staffRef = doc(db, 'staff', user.id);
      await updateDoc(staffRef, {
        staffName: formData.staffName,
        staffPassword: formData.staffPassword,
        staffPin: formData.staffPin,
      });

      // console.log('Staff record updated for ID:', user.id);
      toast.success('Profile updated successfully');

      onOpenChange(false);
    } catch (error) {
      // console.error('Error updating staff profile:', error);
      toast.error('Update failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] p-3 xs:p-4 sm:p-6">
        <DialogHeader className="pb-1.5 xs:pb-2 sm:pb-4">
          <DialogTitle className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900">
            Store Settings
          </DialogTitle>
          <DialogDescription className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
            Update your account details below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 xs:space-y-3 sm:space-y-5 py-1.5 xs:py-2 sm:py-4">
          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label htmlFor="mobile" className="text-[10px] xs:text-xs sm:text-sm font-semibold">
              Mobile Number
            </Label>
            <Input
              id="mobile"
              value={user.mobile}
              disabled
              className="bg-gray-100 text-gray-700 font-medium h-7 xs:h-8 sm:h-10 text-xs xs:text-sm px-2 xs:px-3 rounded-md"
            />
          </div>

          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label htmlFor="staffName" className="text-[10px] xs:text-xs sm:text-sm font-semibold">
              Full Name
            </Label>
            <Input
              id="staffName"
              name="staffName"
              value={formData.staffName || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium h-7 xs:h-8 sm:h-10 text-xs xs:text-sm px-2 xs:px-3 rounded-md"
            />
          </div>

          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label
              htmlFor="staffPassword"
              className="text-[10px] xs:text-xs sm:text-sm font-semibold"
            >
              Password
            </Label>
            <Input
              id="staffPassword"
              name="staffPassword"
              type="text"
              value={formData.staffPassword || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium h-7 xs:h-8 sm:h-10 text-xs xs:text-sm px-2 xs:px-3 rounded-md"
            />
          </div>

          <div className="space-y-0.5 xs:space-y-1 sm:space-y-2">
            <Label htmlFor="staffPin" className="text-[10px] xs:text-xs sm:text-sm font-semibold">
              Store PIN (4 digits)
            </Label>
            <Input
              id="staffPin"
              name="staffPin"
              type="text"
              maxLength={4}
              value={formData.staffPin || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium h-7 xs:h-8 sm:h-10 text-xs xs:text-sm px-2 xs:px-3 rounded-md"
            />
          </div>
        </div>

        <DialogFooter className="mt-3 xs:mt-4 sm:mt-6 gap-1.5 xs:gap-2 sm:gap-3 flex-col xs:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="min-w-full xs:min-w-[90px] sm:min-w-[100px] h-7 xs:h-8 sm:h-10 text-[10px] xs:text-xs sm:text-sm px-2 xs:px-3"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSaveChanges}
            disabled={isUpdating}
            className="min-w-full xs:min-w-[100px] sm:min-w-[120px] bg-primary hover:bg-primary/90 text-white font-medium h-7 xs:h-8 sm:h-10 text-[10px] xs:text-xs sm:text-sm px-2 xs:px-3"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
