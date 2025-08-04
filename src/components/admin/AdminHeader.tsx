import { useState, useEffect } from 'react';
import { collection, getDocs, limit, query, Timestamp, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, LogOut, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StaffType } from '@/types/types';

// Safe date formatting utility
function safeFormatDate(date: any, dateFormat: string = 'dd MMM yyyy'): string {
  try {
    let jsDate: Date;
    if (date instanceof Timestamp) {
      jsDate = date.toDate();
    } else if (date instanceof Date) {
      jsDate = date;
    } else if (date?.toDate instanceof Function) {
      jsDate = date.toDate();
    } else {
      jsDate = new Date(date);
    }
    return format(jsDate, dateFormat);
  } catch {
    return 'Invalid date';
  }
}

import { StoreType, AdminHeaderProps } from '@/types/types';
import { format } from 'date-fns';
export const AdminHeader = ({ user, onLogout }: AdminHeaderProps) => {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<StaffType>>({
    // name: user.name,
    // mobile: user.mobile,
    staffEmail: user.staffEmail,
    storeLocation: user.storeLocation,
    role: user.role,
    staffStatus: user.staffStatus,
    staffPin: user.staffPin,
    staffPassword: user.staffPassword,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
  const fetchStores = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'stores'));
      const storesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoreType[];
      setStores(storesData);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  fetchStores();
}, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: value
  }));
};

  const handleSelectChange = (name: keyof StaffType, value: string) => {
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
  const updateData: Partial<StaffType> = {};
  
  // Required fields that should always be included if they exist in formData
  if (formData.staffName) updateData.staffName = formData.staffName;
  if (formData.staffEmail) updateData.staffEmail = formData.staffEmail;
  if (formData.storeLocation) updateData.storeLocation = formData.storeLocation;
  if (formData.role) updateData.role = formData.role;
  if (formData.staffStatus) updateData.staffStatus = formData.staffStatus;

  // Conditional updates for sensitive fields
  if (formData.staffPin && formData.staffPin !== user.staffPin) {
    updateData.staffPin = formData.staffPin;
  }
  if (formData.staffPassword && formData.staffPassword !== user.staffPassword) {
    updateData.staffPassword = formData.staffPassword;
  }

  // Verify we have at least one field to update
  if (Object.keys(updateData).length === 0) {
    toast({
      title: "No changes detected",
      description: "Make changes before saving.",
      variant: "default",
    });
    return;
  }

  const staffQuery = query(
    collection(db, 'staff'),
    where('staffMobile', '==', user.staffMobile),
    limit(1)
  );
  
  const querySnapshot = await getDocs(staffQuery);

  if (querySnapshot.empty) {
    console.error('No staff found with mobile:', user.staffMobile);
    toast({
      title: "Update failed",
      description: "No staff record found for your account.",
      variant: "destructive",
    });
    return;
  }

  const staffRef = doc(db, 'staff', querySnapshot.docs[0].id);
  await updateDoc(staffRef, updateData);

  console.log('Staff record updated for:', user.staffMobile);
  toast({
    title: "Profile updated",
    description: "Your changes have been saved successfully.",
    variant: "default",
  });
  
  setIsSettingsOpen(false);
} catch (error) {
  console.error('Error updating staff profile:', error);
  toast({
    title: "Update failed",
    description: error instanceof Error ? error.message : "There was an error saving your changes.",
    variant: "destructive",
  });
} finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white shadow-sm border-b">
      {/* Header remains exactly the same as your original */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-2 rounded-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Loyalty Rewards</h1>
              <p className="text-sm text-gray-600">Admin Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.staffName || 'Admin'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {user.role.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-600">{user.staffMobile}</span>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Settings Dialog with all StaffType fields */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admin Settings</DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  value={user.staffName}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  value={user.staffMobile}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  value={user.staffEmail}
                  disabled
                  className="bg-gray-100"
                />
              </div>
                <div>
                <Label htmlFor="storeLocation">Store Location</Label>
                <select
                id="storeLocation"
                name="storeLocation"
                value={formData.storeLocation || ''}
                onChange={handleInputChange}
                className="w-full p-2 border rounded" // Add your styling classes here
                >
                <option value="">Select a store</option>
                {stores.map(store => (
                <option key={store.id} value={store.storeName}>
                {store.storeName} - {store.storeLocation}
                </option>
                ))}
                </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleSelectChange('role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.staffStatus}
                  onValueChange={(value) => handleSelectChange('staffStatus', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffPin">Staff PIN</Label>
                <Input
                  id="staffPin"
                  name="staffPin"
                  type="text"
                  value={formData.staffPin || ''}
                  onChange={handleInputChange}
                  // placeholder="4-6 digit PIN"
                />
              </div>
              <div>
                <Label htmlFor="staffPassword">New Password</Label>
                <Input
                  id="staffPassword"
                  name="staffPassword"
                  type="text"
                  value={formData.staffPassword || ''}
                  onChange={handleInputChange}
                  // placeholder="Leave blank to keep current"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Created At</Label>
                    <Input
                    value={safeFormatDate(user.createdAt)} // Using our safeFormatDate utility
                    disabled
                    className="bg-gray-100"
                    />
              </div>
              <div>
                <Label>Sales Count</Label>
                <Input
                  value={user.staffSalesCount}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsSettingsOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveChanges}
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};