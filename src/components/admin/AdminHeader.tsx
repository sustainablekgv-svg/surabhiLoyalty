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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1.5 sm:p-2 rounded-lg">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Loyalty Rewards</h1>
              <p className="text-xs sm:text-sm text-gray-600">Admin Portal</p>
            </div>
            
            {/* Mobile buttons */}
            <div className="flex items-center gap-1 sm:hidden">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 p-1"
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-900">
                  {user.staffName || 'Admin'}
                </p>
                <div className="flex items-center gap-1 sm:gap-2 justify-center sm:justify-end">
                  <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2">
                    {user.role.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] sm:text-xs text-gray-600">{user.staffMobile}</span>
                </div>
              </div>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-1">
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
      </div>

      {/* Enhanced Settings Dialog with all StaffType fields */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl">Admin Settings</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update your profile information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="name" className="text-xs sm:text-sm">Full Name</Label>
                <Input
                  value={user.staffName}
                  disabled
                  className="bg-gray-100 h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label htmlFor="mobile" className="text-xs sm:text-sm">Mobile Number</Label>
                <Input
                  value={user.staffMobile}
                  disabled
                  className="bg-gray-100 h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                <Input
                  value={user.staffEmail}
                  disabled
                  className="bg-gray-100 h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
                <div>
                <Label htmlFor="storeLocation" className="text-xs sm:text-sm">Store Location</Label>
                <select
                id="storeLocation"
                name="storeLocation"
                value={formData.storeLocation || ''}
                onChange={handleInputChange}
                className="w-full p-1.5 sm:p-2 border rounded h-8 sm:h-10 text-xs sm:text-sm"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="role" className="text-xs sm:text-sm">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleSelectChange('role', value)}
                >
                  <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="text-xs sm:text-sm">Admin</SelectItem>
                    <SelectItem value="staff" className="text-xs sm:text-sm">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status" className="text-xs sm:text-sm">Status</Label>
                <Select
                  value={formData.staffStatus}
                  onValueChange={(value) => handleSelectChange('staffStatus', value)}
                >
                  <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs sm:text-sm">Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs sm:text-sm">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="staffPin" className="text-xs sm:text-sm">Staff PIN</Label>
                <Input
                  id="staffPin"
                  name="staffPin"
                  type="text"
                  value={formData.staffPin || ''}
                  onChange={handleInputChange}
                  className="h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label htmlFor="staffPassword" className="text-xs sm:text-sm">New Password</Label>
                <Input
                  id="staffPassword"
                  name="staffPassword"
                  type="text"
                  value={formData.staffPassword || ''}
                  onChange={handleInputChange}
                  className="h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">Created At</Label>
                    <Input
                    value={safeFormatDate(user.createdAt)} // Using our safeFormatDate utility
                    disabled
                    className="bg-gray-100 h-8 sm:h-10 text-xs sm:text-sm"
                    />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Sales Count</Label>
                <Input
                  value={user.staffSalesCount}
                  disabled
                  className="bg-gray-100 h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 sm:pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsSettingsOpen(false)}
                disabled={isUpdating}
                className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveChanges}
                disabled={isUpdating}
                className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
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