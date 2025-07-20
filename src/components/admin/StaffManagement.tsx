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

  // Staff CRUD operations
  const handleSaveStaff = async () => {
    if (!currentStaff?.name || !currentStaff.email || !currentStaff.mobile || !currentStaff.role) {
      toast.error('Please fill all required fields');
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
    } catch (error) {
      toast.error('Error saving staff');
      console.error('Error saving staff:', error);
    }
  };

  const handleDeleteStaff = async () => {
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
    } catch (error) {
      toast.error('Error deleting staff');
      console.error('Error deleting staff:', error);
    }
  };

  const fetchStoreByContactNumber = async (contactNumber: string): Promise<StoreType | null> => {
  try {
    const storeQuery = query(
      collection(db, 'stores'),
      where('contactNumber', '==', contactNumber.trim())
    );
    const querySnapshot = await getDocs(storeQuery);

    if (!querySnapshot.empty) {
      const storeDoc = querySnapshot.docs[0];
      return {
        id: storeDoc.id,
        name: storeDoc.data().name || '',
        storeLocation: storeDoc.data().storeLocation || '',
        address: storeDoc.data().address || '',
        contactNumber: storeDoc.data().contactNumber || '',
        referralCommission: Number(storeDoc.data().referralCommission) || 0,
        cashOnlyCommission: Number(storeDoc.data().cashOnlyCommission) || 0,
        surabhiCommission: Number(storeDoc.data().surabhiCommission) || 0,
        sevaCommission: Number(storeDoc.data().sevaCommission) || 0,
        status: storeDoc.data().status || 'active',
        createdAt: storeDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: storeDoc.data().updatedAt?.toDate() || new Date()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching store:', error);
    toast.error('Failed to fetch store details');
    return null;
  }
};


// Function to update existing store
const updateExistingStore = async (storeData: Partial<StoreType>): Promise<boolean> => {
  if (!storeData.id || !storeData.contactNumber) {
    toast.error('Store ID and contact number are required for update');
    return false;
  }

  try {
    // First verify the store exists
    const existingStore = await fetchStoreByContactNumber(storeData.contactNumber);
    
    if (!existingStore) {
      toast.error('Store not found');
      return false;
    }

    if (existingStore.id !== storeData.id) {
      toast.error('Another store already uses this contact number');
      return false;
    }

    const updateData = {
      name: storeData.name?.trim() || '',
      storeLocation: storeData.storeLocation?.trim() || '',
      address: storeData.address?.trim() || '',
      contactNumber: storeData.contactNumber.trim(),
      referralCommission: Number(storeData.referralCommission) || 0,
      surabhiCommission: Number(storeData.surabhiCommission) || 0,
      sevaCommission: Number(storeData.sevaCommission) || 0,
      status: storeData.status || 'active',
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, 'stores', storeData.id), updateData);
    toast.success('Store updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating store:', error);
    toast.error(`Error updating store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Usage in the edit store handler
const handleEditStore = async (storeToEdit: Partial<StoreType>) => {
  if (!storeToEdit.contactNumber) {
    toast.error('Contact number is required');
    return;
  }

  // Fetch the existing store data
  const existingStore = await fetchStoreByContactNumber(storeToEdit.contactNumber);
  
  if (!existingStore) {
    toast.error('Store not found');
    return;
  }

  // Update the store with new data
  const success = await updateExistingStore({
    ...existingStore,
    ...storeToEdit // Override with any new values
  });

  if (success) {
    const updatedStores = await refreshStores();
    setStores(updatedStores);
    setIsStoreDialogOpen(false);
    setCurrentStore(null);
  }
};


  // Store CRUD operations
 const handleSaveStore = async (currentStore: Partial<StoreType>) => {
  console.log("The slected stoe is", currentStore.id)
  // Validate required fields
  if (!currentStore?.name?.trim() || 
      !currentStore?.storeLocation?.trim() || 
      !currentStore?.address?.trim() ||
      !currentStore?.contactNumber?.trim()) {
    toast.error('Please fill all required fields including contact number');
    return false;
  }

  try {
    const storeData = {
      name: currentStore.name.trim(),
      storeLocation: currentStore.storeLocation.trim(),
      address: currentStore.address.trim(),
      contactNumber: currentStore.contactNumber.trim(),
      referralCommission: Number(currentStore.referralCommission) || 0,
      surabhiCommission: Number(currentStore.surabhiCommission) || 0,
      sevaCommission: Number(currentStore.sevaCommission) || 0,
      status: currentStore.status || 'active',
      updatedAt: serverTimestamp()
    };

    // Check if store with this contact number already exists
    const storeQuery = query(
      collection(db, 'stores'),
      where('contactNumber', '==', currentStore.contactNumber.trim())
    );
    const querySnapshot = await getDocs(storeQuery);

    if (!querySnapshot.empty) {
      // Store with this contact number exists
      if (currentStore.id && querySnapshot.docs[0].id === currentStore.id) {
        // Updating the same store
        await updateDoc(doc(db, 'stores', currentStore.id), storeData);
        toast.success('Store updated successfully');
      } else if (!currentStore.id) {
        // Trying to create new but contact number exists
        toast.error('Store with this contact number already exists');
        return false;
      } else {
        // Trying to update but contact number belongs to different store
        toast.error('Another store already uses this contact number');
        return false;
      }
    } else {
      // No store with this contact number exists
      if (currentStore.id) {
        // Update existing store (contact number was changed to a new unique one)
        await updateDoc(doc(db, 'stores', currentStore.id), storeData);
        toast.success('Store updated successfully');
      } else {
        // Create new store
        const newStoreRef = doc(collection(db, 'stores'));
        await setDoc(newStoreRef, {
          ...storeData,
          createdAt: serverTimestamp()
        });
        toast.success('Store created successfully');
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving store:', error);
    toast.error(`Error saving store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

  
  const handleDeleteStore = async (storeId: string) => {
    if (!storeId) return false;

    try {
      // Check for assigned staff
      const staffQuery = query(
        collection(db, 'staff'), 
        where('storeLocation', '==', storeId)
      );
      const staffSnapshot = await getDocs(staffQuery);
      
      if (!staffSnapshot.empty) {
        toast.error('Cannot delete store with assigned staff');
        return false;
      }

      // Check if store exists
      const storeQuery = query(
        collection(db, 'stores'),
        where('__name__', '==', storeId)
      );
      const storeSnapshot = await getDocs(storeQuery);

      if (storeSnapshot.empty) {
        toast.error('Store not found');
        return false;
      }

      await deleteDoc(doc(db, 'stores', storeId));
      toast.success('Store deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting store:', error);
      toast.error(`Error deleting store: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Update the refreshStores function to include contactNumber in the mapping
const refreshStores = async () => {
  try {
    const storesSnapshot = await getDocs(collection(db, 'stores'));
    return storesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      storeLocation: doc.data().storeLocation || '',
      address: doc.data().address || '',
      contactNumber: doc.data().contactNumber || '',
      referralCommission: Number(doc.data().referralCommission) || 0,
      surabhiCommission: Number(doc.data().surabhiCommission) || 0,
      sevaCommission: Number(doc.data().sevaCommission) || 0,
      status: doc.data().status || 'active',
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as StoreType[];
  } catch (error) {
    console.error('Error refreshing stores:', error);
    toast.error('Failed to load stores');
    return [];
  }
};

  const handleSaveClick = async (e: React.MouseEvent) => {
  e.preventDefault();
  console.log("THe currentStore info in line 424 is", currentStore)
  if (!currentStore) return;

  if (currentStore.id) {
    // Editing existing store
    await handleEditStore(currentStore);
  } else {
    // Creating new store (keep your existing create logic)
    const success = await handleSaveStore(currentStore);
    if (success) {
      const updatedStores = await refreshStores();
      setStores(updatedStores);
      setIsStoreDialogOpen(false);
      setCurrentStore(null);
    }
  }
};


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
              <Button onClick={() => {
                setCurrentStaff({
                  role: 'staff',
                  status: 'active'
                });
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              {isLoading ? (
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
              ) : (
                <TableBody>
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
                </TableBody>
              )}
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
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[150px]">Location</TableHead>
                  <TableHead className="text-right w-[100px]">Referral Commission</TableHead>
                  <TableHead className="text-right w-[100px]">Surabhi Commission</TableHead>
                  <TableHead className="text-right w-[100px]">Cash Only Commission</TableHead>
                  <TableHead className="text-right w-[100px]">Seva Commission</TableHead>
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium w-[200px]">
                      {store.name}
                      <div className="text-sm text-muted-foreground">
                        {store.contactNumber}
                      </div>
                    </TableCell>
                    <TableCell className="w-[150px]">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {store.storeLocation}
                      </div>
                    </TableCell>
                    <TableCell className="text-right w-[100px]">
                      {store.referralCommission}%
                    </TableCell>
                    <TableCell className="text-right w-[100px]">
                      {store.surabhiCommission}%
                    </TableCell>
                    <TableCell className="text-right w-[100px]">
                      {store.cashOnlyCommission}%
                    </TableCell>
                    <TableCell className="text-right w-[100px]">
                      {store.sevaCommission}%
                    </TableCell>
                    <TableCell className="text-right w-[200px]">
                      <div className="flex gap-2 justify-end">
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
          
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteStaff}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {currentStore?.id ? 'Edit Store' : 'Add New Store'}
            </DialogTitle>
            <DialogDescription>
              {currentStore?.id ? 'Update store details' : 'Create a new store location'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Basic Information Section */}
            <div className="grid grid-cols-2 gap-4">
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
                  value={currentStore?.storeLocation || ''}
                  onChange={(e) => setCurrentStore({
                    ...currentStore,
                    storeLocation: e.target.value
                  })}
                  placeholder="Enter location"
                />
              </div>
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

             <div className="space-y-2">
      <Label>Contact Number *</Label>
      {currentStore?.id ? (
        // Display as read-only for existing stores
        <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-100">
          <Phone className="h-4 w-4" />
          <span>{currentStore?.contactNumber || 'Not provided'}</span>
        </div>
      ) : (
        // Editable for new stores
        <Input
          type="tel"
          value={currentStore?.contactNumber || ''}
          onChange={(e) => setCurrentStore({
            ...currentStore,
            contactNumber: e.target.value.replace(/\D/g, '')
          })}
          placeholder="Enter contact number"
        />
      )}
    </div>

            {/* Commission Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Commission Rates</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-2">
                  <Label>Wallet (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.referralCommission || 0}
                    onChange={(e) => setCurrentStore({
                      ...currentStore,
                      referralCommission: Number(e.target.value)
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Surabhi (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.surabhiCommission || 0}
                    onChange={(e) => setCurrentStore({
                      ...currentStore,
                      surabhiCommission: Number(e.target.value)
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Surabhi (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.cashOnlyCommission || 0}
                    onChange={(e) => setCurrentStore({
                      ...currentStore,
                      cashOnlyCommission: Number(e.target.value)
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Seva (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.sevaCommission || 0}
                    onChange={(e) => setCurrentStore({
                      ...currentStore,
                      sevaCommission: Number(e.target.value)
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Status Section */}
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
          
          <DialogFooter>
            <Button onClick={handleSaveClick}>
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
          
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleDeleteStore(currentStore.id)}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};