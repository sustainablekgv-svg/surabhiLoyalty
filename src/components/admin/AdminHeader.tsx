import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StaffType } from '@/types/types';
interface AdminHeaderProps {
  user: StaffType;
  onLogout: () => void;
}

export const AdminHeader = ({ user, onLogout }: AdminHeaderProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<StaffType>>({
    name: user.name,
    email: user.email,
    storeLocation: user.storeLocation,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

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
      const staffRef = doc(db, 'staff', user.id);
      await updateDoc(staffRef, {
        name: formData.name,
        email: formData.email,
        storeLocation: formData.storeLocation,
      });

      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully.",
        variant: "default",
      });
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Error updating staff profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white shadow-sm border-b">
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
                  {user.name || 'Admin'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {user.role.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-600">{user.mobile}</span>
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

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px]">
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
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  value={user.mobile}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email || ''}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <Label htmlFor="storeLocation">Store Location</Label>
              <Input
                id="storeLocation"
                name="storeLocation"
                value={formData.storeLocation || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsSettingsOpen(false);
                  setFormData({
                    name: user.name,
                    email: user.email,
                    storeLocation: user.storeLocation,
                  });
                }}
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