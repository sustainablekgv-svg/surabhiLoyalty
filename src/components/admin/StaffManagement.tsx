// components/StaffStoreManagement.tsx
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  UserPlus, Search, MapPin, Phone, Mail, Edit, Trash2, 
  User, Shield, Lock, AlertCircle, Store, PlusCircle, 
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, getDocs,
  query, where, serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { StaffType, StoreType } from '@/types/types';

export const StaffManagement = () => {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [staff, setStaff] = useState<StaffType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'stores'>('staff');
  
  // Staff state
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<Partial<StaffType> | null>(null);
  const [isDeleteStaffDialogOpen, setIsDeleteStaffDialogOpen] = useState(false);
  
  // Store state
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const [currentStore, setCurrentStore] = useState<Partial<StoreType> | null>(null);
  const [isDeleteStoreDialogOpen, setIsDeleteStoreDialogOpen] = useState(false);
  
  // Admin verification
  const [adminPin, setAdminPin] = useState('');

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => { 
      setIsLoading(true);
      try {
        // Fetch stores
        const storesSnapshot = await getDocs(collection(db, 'stores'));
        const storesData = storesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        })) as StoreType[];
        setStores(storesData);

        // Fetch staff
        const staffSnapshot = await getDocs(collection(db, 'staff'));
        const staffData = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          lastActive: doc.data().lastActive?.toDate()
        })) as StaffType[];
        setStaff(staffData);
      } catch (error) {
        toast.error('Error fetching data');
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Verify admin PIN
  const verifyAdmin = () => {
    return adminPin === '1234'; // In production, verify against hashed PIN in database
  };

  // Staff CRUD operations
  const handleSaveStaff = async () => {
    if (!verifyAdmin()) {
      toast.error('Invalid admin PIN');
      return;
    }

    if (!currentStaff?.name || !currentStaff.email || !currentStaff.mobile || !currentStaff.role) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!currentStaff?.id && (!currentStaff.staffPin || currentStaff.staffPin.length < 4)) {
    toast.error('Please set a 4-digit Staff PIN for new staff');
        return;
    }

    try {
      const staffData = {
        name: currentStaff.name,
        email: currentStaff.email,
        mobile: currentStaff.mobile,
        role: currentStaff.role,
        status: currentStaff.status || 'active',
        storeLocation: currentStaff.storeLocation || '',
        staffPin: currentStaff.staffPin || '0000',
        updatedAt: serverTimestamp(),
        ...(currentStaff.id ? {} : { createdAt: serverTimestamp() })
      };

      if (currentStaff.id) {
        // Update existing staff
        await updateDoc(doc(db, 'staff', currentStaff.id), {
          ...staffData,
          createdAt: currentStaff.createdAt // Preserve original creation date
        });
        toast.success('Staff updated successfully');
      } else {
        // Create new staff
        const newStaffRef = doc(collection(db, 'staff'));
        await setDoc(newStaffRef, staffData);
        toast.success('Staff created successfully');
      }

      // Refresh data
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const updatedStaff = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastActive: doc.data().lastActive?.toDate()
      })) as StaffType[];
      setStaff(updatedStaff);

      setIsStaffDialogOpen(false);
      setCurrentStaff(null);
      setAdminPin('');
    } catch (error) {
      toast.error('Error saving staff');
      console.error('Error saving staff:', error);
    }
  };

  const handleDeleteStaff = async () => {
    if (!verifyAdmin()) {
      toast.error('Invalid admin PIN');
      return;
    }

    if (!currentStaff?.id) return;

    try {
      await deleteDoc(doc(db, 'staff', currentStaff.id));
      toast.success('Staff deleted successfully');
      
      // Refresh data
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const updatedStaff = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastActive: doc.data().lastActive?.toDate()
      })) as StaffType[];
      setStaff(updatedStaff);

      setIsDeleteStaffDialogOpen(false);
      setCurrentStaff(null);
      setAdminPin('');
    } catch (error) {
      toast.error('Error deleting staff');
      console.error('Error deleting staff:', error);
    }
  };

  // Store CRUD operations
  const handleSaveStore = async () => {
    if (!verifyAdmin()) {
      toast.error('Invalid admin PIN');
      return;
    }

    if (!currentStore?.name || !currentStore.location || !currentStore.address) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const storeData = {
        name: currentStore.name,
        location: currentStore.location,
        address: currentStore.address,
        contactNumber: currentStore.contactNumber || '',
        status: currentStore.status || 'active',
        updatedAt: serverTimestamp(),
        ...(currentStore.id ? {} : { createdAt: serverTimestamp() })
      };

      if (currentStore.id) {
        // Update existing store
        await updateDoc(doc(db, 'stores', currentStore.id), {
          ...storeData,
          createdAt: currentStore.createdAt // Preserve original creation date
        });
        toast.success('Store updated successfully');
      } else {
        // Create new store
        const newStoreRef = doc(collection(db, 'stores'));
        await setDoc(newStoreRef, storeData);
        toast.success('Store created successfully');
      }

      // Refresh data
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const updatedStores = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as StoreType[];
      setStores(updatedStores);
      setIsStoreDialogOpen(false);
      setCurrentStore(null);
      setAdminPin('');
    } catch (error) {
      toast.error('Error saving store');
      console.error('Error saving store:', error);
    }
  };

  const handleDeleteStore = async () => {
    if (!verifyAdmin()) {
      toast.error('Invalid admin PIN');
      return;
    }

    if (!currentStore?.id) return;

    // Check if store has assigned staff
    const staffQuery = query(collection(db, 'staff'), where('storeLocation', '==', currentStore.id));
    const staffSnapshot = await getDocs(staffQuery);
    
    if (!staffSnapshot.empty) {
      toast.error('Cannot delete store with assigned staff');
      return;
    }

    try {
      await deleteDoc(doc(db, 'stores', currentStore.id));
      toast.success('Store deleted successfully');
      
      // Refresh data
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const updatedStores = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as StoreType[];
      setStores(updatedStores);

      setIsDeleteStoreDialogOpen(false);
      setCurrentStore(null);
      setAdminPin('');
    } catch (error) {
      toast.error('Error deleting store');
      console.error('Error deleting store:', error);
    }
  };
  console.log("The line 250 data is",stores, staff);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Configuration</h1>
          <p className="text-muted-foreground">
            Manage staff accounts and store locations
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'staff' ? 'default' : 'outline'}
            onClick={() => setActiveTab('staff')}
          >
            <User className="h-4 w-4 mr-2" />
            Staff Management
          </Button>
          <Button 
            variant={activeTab === 'stores' ? 'default' : 'outline'}
            onClick={() => setActiveTab('stores')}
          >
            <Store className="h-4 w-4 mr-2" />
            Store Management
          </Button>
        </div>
      </div>

      {activeTab === 'staff' ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Staff Members</CardTitle>
                <CardDescription>
                  {staff.length} staff members across {stores.length} stores
                </CardDescription>
              </div>
              <Button 
              onClick={() => {
                setCurrentStaff({
                  role: 'staff',
                  status: 'active',
                  staffPin: ''
                });
                console.log("Line 367 data is", currentStaff);
                setIsStaffDialogOpen(true);
              }}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Staff Password</TableHead>
                  <TableHead>Staff Pin</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              {isLoading ? (
    // Show skeleton loaders while loading
          Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-3 w-[100px] mt-2" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[80px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[120px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[70px]" />
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-[60px]" />
                  <Skeleton className="h-8 w-[80px]" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : 
              (<TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.name}
                        {member.role === 'admin' && (
                          <Shield className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {stores.find(s => s.name === member.storeLocation)?.name || 'Unassigned'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </TableCell>
                      <TableCell>
                        {member.staffPassword}
                    </TableCell>
                    <TableCell>
                        {member.staffPin}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentStaff(member);
                            setIsStaffDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            setCurrentStaff(member);
                            setIsDeleteStaffDialogOpen(true);
                          }}
                          disabled={member.role === 'admin'}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>) }
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Store Locations</CardTitle>
                <CardDescription>
                  Manage all store locations in the system
                </CardDescription>
              </div>
              <Button onClick={() => {
                setCurrentStore({
                  status: 'active'
                });
                setIsStoreDialogOpen(true);
              }}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Store
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Staff Count</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">
                      {store.name}
                      <div className="text-sm text-muted-foreground">
                        {store.contactNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {store.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                        {store.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {staff.filter(s => s.storeLocation === store.id).length}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentStore(store);
                            setIsStoreDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            setCurrentStore(store);
                            setIsDeleteStoreDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Staff Dialog */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
  <DialogContent className="sm:max-w-[600px]">
    <DialogHeader>
      <DialogTitle>
        {currentStaff?.id ? 'Edit Staff Member' : 'Add New Staff Member'}
      </DialogTitle>
      <DialogDescription>
        {currentStaff?.id ? 'Update staff details' : 'Create a new staff account'}
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Basic Information Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <Input
            value={currentStaff?.name || ''}
            onChange={(e) => setCurrentStaff({
              ...currentStaff,
              name: e.target.value
            })}
            placeholder="Enter staff name"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Mobile Number *</Label>
          <Input
            type="tel"
            value={currentStaff?.mobile || ''}
            onChange={(e) => setCurrentStaff({
              ...currentStaff,
              mobile: e.target.value.replace(/\D/g, '')
            })}
            placeholder="Enter mobile number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Email *</Label>
        <Input
          type="email"
          value={currentStaff?.email || ''}
          onChange={(e) => setCurrentStaff({
            ...currentStaff,
            email: e.target.value
          })}
          placeholder="Enter email address"
          disabled={!!currentStaff?.id}
        />
      </div>

      {/* Role and Status Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Role *</Label>
          <Select
            value={currentStaff?.role || 'staff'}
            onValueChange={(value) => setCurrentStaff({
              ...currentStaff,
              role: value as 'admin' | 'staff',
              ...(value === 'admin' ? { storeLocation: 'All Locations' } : {})
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Status *</Label>
          <Select
            value={currentStaff?.status || 'active'}
            onValueChange={(value) => setCurrentStaff({
              ...currentStaff,
              status: value as 'active' | 'inactive'
            })}
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
      
      <div className="space-y-2">
        <Label>Assigned Store</Label>
        <Select
          value={currentStaff?.storeLocation || ''}
          onValueChange={(value) => setCurrentStaff({
            ...currentStaff,
            storeLocation: value
          })}
          disabled={currentStaff?.role === 'admin'}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {stores.map(store => (
              <SelectItem key={store.id} value={store.name}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Authentication Section */}
      <div className="border-t pt-4 space-y-4">
        <h4 className="font-medium">Authentication</h4>
        
        {/* Staff Login Password - Required for all staff */}
        <div className="space-y-2">
          <Label>Login Password {!currentStaff?.id && '*'}</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={currentStaff?.staffPassword || ''}
              onChange={(e) => setCurrentStaff({
                ...currentStaff,
                staffPassword: e.target.value
              })}
              placeholder={currentStaff?.id ? "Leave blank to keep unchanged" : "Create login password"}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {!currentStaff?.id 
              ? "Minimum 8 characters with at least 1 number and 1 special character"
              : "Only enter if you want to change the password"}
          </p>
        </div>

        {/* Transaction PIN - Required for all staff */}
        <div className="space-y-2">
          <Label>Transaction PIN (4 digits) {!currentStaff?.id && '*'}</Label>
          <Input
            type="password"
            value={currentStaff?.staffPin || ''}
            onChange={(e) => setCurrentStaff({
              ...currentStaff,
              staffPin: e.target.value.replace(/\D/g, '').slice(0, 4)
            })}
            placeholder={currentStaff?.id ? "Leave blank to keep unchanged" : "Enter 4-digit PIN"}
            maxLength={4}
          />
          <p className="text-xs text-muted-foreground">
            This PIN will be used to verify sales transactions
          </p>
        </div>
      </div>

      {/* Admin Verification Section */}
        <div className="space-y-2">
          <Label>Admin Verification PIN *</Label>
          <Input
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            placeholder="Enter admin PIN to confirm changes"
          />
          <p className="text-xs text-muted-foreground">
            Required for admin-level changes
          </p>
        </div>
      {/* )} */}
    </div>
    <DialogFooter>
      <Button onClick={handleSaveStaff}>
        {currentStaff?.id ? 'Save Changes' : 'Create Staff'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Delete Staff Dialog */}
      <Dialog open={isDeleteStaffDialogOpen} onOpenChange={setIsDeleteStaffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentStaff?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Admin PIN Verification *</Label>
              <Input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter admin PIN to confirm"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteStaff}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentStore?.id ? 'Edit Store' : 'Add New Store'}
            </DialogTitle>
            <DialogDescription>
              {currentStore?.id ? 'Update store details' : 'Create a new store location'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name *</Label>
              <Input
                value={currentStore?.name || ''}
                onChange={(e) => setCurrentStore({
                  ...currentStore,
                  name: e.target.value
                })}
                placeholder="Enter store name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input
                value={currentStore?.location || ''}
                onChange={(e) => setCurrentStore({
                  ...currentStore,
                  location: e.target.value
                })}
                placeholder="Enter location"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={currentStore?.address || ''}
                onChange={(e) => setCurrentStore({
                  ...currentStore,
                  address: e.target.value
                })}
                placeholder="Enter full address"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input
                  type="tel"
                  value={currentStore?.contactNumber || ''}
                  onChange={(e) => setCurrentStore({
                    ...currentStore,
                    contactNumber: e.target.value.replace(/\D/g, '')
                  })}
                  placeholder="Enter contact number"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={currentStore?.status || 'active'}
                  onValueChange={(value) => setCurrentStore({
                    ...currentStore,
                    status: value as 'active' | 'inactive'
                  })}
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
            
            {!currentStore?.id && (
              <div className="space-y-2">
                <Label>Admin PIN Verification *</Label>
                <Input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Enter admin PIN to confirm"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={handleSaveStore}>
              {currentStore?.id ? 'Save Changes' : 'Create Store'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Store Dialog */}
      <Dialog open={isDeleteStoreDialogOpen} onOpenChange={setIsDeleteStoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentStore?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Admin PIN Verification *</Label>
              <Input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter admin PIN to confirm"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteStore}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};