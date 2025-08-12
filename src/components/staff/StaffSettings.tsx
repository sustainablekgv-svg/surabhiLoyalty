import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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

export const StaffSettings = ({ user, isOpen, onOpenChange }: StaffSettingsProps) => {
  const [formData, setFormData] = useState<Partial<StaffType>>({
    staffName: '',
    staffPassword: '',
    staffPin: ''
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
            staffPin: data.staffPin
          });
        }
      } catch (error) {
        console.error('Error fetching staff data:', error);
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
      [name]: value
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
      toast.error('Staff PIN must be a 4-digit number');
      return;
    }
    
    setIsUpdating(true);
    try {
      // Update staff document directly using user.id
      const staffRef = doc(db, 'staff', user.id);
      await updateDoc(staffRef, {
        staffName: formData.staffName,
        staffPassword: formData.staffPassword,
        staffPin: formData.staffPin
      });

      console.log('Staff record updated for ID:', user.id);
      toast.success('Profile updated successfully');
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating staff profile:', error);
      toast.error('Update failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Staff Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Update your account details below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-sm font-semibold">Mobile Number</Label>
            <Input
              id="mobile"
              value={user.mobile}
              disabled
              className="bg-gray-100 text-gray-700 font-medium"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="staffName" className="text-sm font-semibold">Full Name</Label>
            <Input
              id="staffName"
              name="staffName"
              value={formData.staffName || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffPassword" className="text-sm font-semibold">Password</Label>
            <Input
              id="staffPassword"
              name="staffPassword"
              type="text"
              value={formData.staffPassword || ''}
              onChange={handleInputChange}
              className="text-gray-800 font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffPin" className="text-sm font-semibold">Staff PIN (4 digits)</Label>
            <Input
              id="staffPin"
              name="staffPin"
              type="text"
              maxLength={4}
              value={formData.staffPin || ''}
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