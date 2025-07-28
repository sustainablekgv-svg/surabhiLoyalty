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
  query, where, serverTimestamp,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function checkContactNumberExists(contactNumber: string, currentStoreId?: string): Promise<boolean> {
  if (!contactNumber) return false;

  const storesRef = collection(db, 'stores');
  const q = query(storesRef, where('contactNumber', '==', contactNumber));

  const querySnapshot = await getDocs(q);

  // If editing, exclude the current store from the check
  if (currentStoreId) {
    return querySnapshot.docs.some(doc => doc.id !== currentStoreId);
  }

  return !querySnapshot.empty;
}

import { StaffType, StoreType } from '@/types/types';
export const StaffManagement = () => {
  const [emailError, setEmailError] = useState<string>('');
  const [mobileError, setMobileError] = useState<string>('');
  const [stores, setStores] = useState<StoreType[]>([]);
  const [staff, setStaff] = useState<StaffType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'stores'>('staff');
  const [contactNumberError, setContactNumberError] = useState('');

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
          name: doc.data().name || '',
          storeLocation: doc.data().storeLocation || '',
          address: doc.data().address || '',
          contactNumber: doc.data().contactNumber || '',
          referralCommission: Number(doc.data().referralCommission) || 0,
          surabhiCommission: Number(doc.data().surabhiCommission) || 0,
          sevaCommission: Number(doc.data().sevaCommission) || 0,
          cashOnlyCommission: Number(doc.data().cashOnlyCommission) || 0,
          status: doc.data().status || 'active',
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as StoreType[];
        setStores(storesData);

        // Fetch staff
        const staffSnapshot = await getDocs(collection(db, 'staff'));
        const staffData = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          mobile: doc.data().mobile || '',
          email: doc.data().email || '',
          storeLocation: doc.data().storeLocation || '',
          role: doc.data().role || 'staff',
          status: doc.data().status || 'active',
          salesCount: Number(doc.data().salesCount) || 0,
          staffPin: doc.data().staffPin || '',
          staffPassword: doc.data().staffPassword || '',
          createdAt: doc.data().createdAt?.toDate() || new Date(),
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

  const validateStaff = async () => {
    let isValid = true;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!currentStaff?.email || !emailRegex.test(currentStaff.email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      // Check if email exists
      const emailQuery = query(
        collection(db, 'staff'),
        where('email', '==', currentStaff.email)
      );
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty && emailSnapshot.docs[0].id !== currentStaff?.id) {
        setEmailError('This email is already registered');
        isValid = false;
      } else {
        setEmailError('');
      }
    }

    // Validate mobile format (10 digits for Indian numbers)
    if (!currentStaff?.mobile || currentStaff.mobile.length !== 10) {
      setMobileError('Please enter a valid 10-digit mobile number');
      isValid = false;
    } else {
      // Check if mobile exists
      const mobileQuery = query(
        collection(db, 'staff'),
        where('mobile', '==', currentStaff.mobile)
      );
      const mobileSnapshot = await getDocs(mobileQuery);
      if (!mobileSnapshot.empty && mobileSnapshot.docs[0].id !== currentStaff?.id) {
        setMobileError('This mobile number is already registered');
        isValid = false;
      } else {
        setMobileError('');
      }
    }

    return isValid;
  };

  const handleSaveStaff = async () => {
    if (!currentStaff) return;

    const isValid = await validateStaff();
    if (!isValid) return;

    try {
      setIsLoading(true);

      const staffData = {
        name: currentStaff.name,
        mobile: currentStaff.mobile,
        email: currentStaff.email,
        role: currentStaff.role,
        status: currentStaff.status,
        storeLocation: currentStaff.storeLocation,
        salesCount: currentStaff.salesCount || 0,
        rechargesCount: currentStaff.rechargesCount || 0,
        staffPin: currentStaff.staffPin || '',
        staffPassword: currentStaff.staffPassword || '',
        lastActive: currentStaff.lastActive || null,
        createdAt: currentStaff.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (currentStaff.id) {
        // Update existing staff
        await updateDoc(doc(db, 'staff', currentStaff.id), staffData);
        toast.success('Staff updated successfully');
      } else {
        // Create new staff
        await addDoc(collection(db, 'staff'), staffData);
        toast.success('Staff created successfully');
      }

      setIsStaffDialogOpen(false);
      // Refresh staff list
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const refreshedStaffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        mobile: doc.data().mobile || '',
        email: doc.data().email || '',
        storeLocation: doc.data().storeLocation || '',
        role: doc.data().role || 'staff',
        status: doc.data().status || 'active',
        salesCount: Number(doc.data().salesCount) || 0,
        staffPin: doc.data().staffPin || '',
        rechargesCount: doc.data().rechargesCount || 0,
        staffPassword: doc.data().staffPassword || '',
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        lastActive: doc.data().lastActive?.toDate()
      })) as StaffType[];
      setStaff(refreshedStaffData);
    } catch (error) {
      console.error('Error saving staff:', error);
      toast.error('Failed to save staff');
    } finally {
      setIsLoading(false);
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
        createdAt: doc.data().createdAt?.toDate() || new Date(),
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

  // Store CRUD operations
  const handleSaveStore = async () => {
    if (!currentStore) return false;

    if (!currentStore.name || !currentStore.storeLocation || !currentStore.address || !currentStore.contactNumber) {
      toast.error('Please fill all required fields');
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
        currentBalance: Number(currentStore.currentBalance) || 0,
        cashOnlyCommission: Number(currentStore.cashOnlyCommission) || 0,
        status: currentStore.status || 'active',
        updatedAt: serverTimestamp()
      };

      if (currentStore.id) {
        // Update existing store
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

      // Refresh data
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const updatedStores = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as StoreType[];
      setStores(updatedStores);

      setIsStoreDialogOpen(false);
      setCurrentStore(null);
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

      await deleteDoc(doc(db, 'stores', storeId));
      toast.success('Store deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting store:', error);
      toast.error(`Error deleting store: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentStore?.contactNumber && currentStore.contactNumber.length === 10) {
        const exists = await checkContactNumberExists(
          currentStore.contactNumber,
          currentStore?.id
        );
        if (exists) {
          setContactNumberError('This contact number is already registered to another store');
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentStore?.contactNumber, currentStore?.id]);

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
                  status: 'active',
                  salesCount: 0,
                  staffPin: '',
                  staffPassword: ''
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sales Count</TableHead>
                  <TableHead>Recharges Count</TableHead>
                  <TableHead>Staff Pin</TableHead>
                  <TableHead>Password</TableHead>
                  {/* <TableHead>Last Active</TableHead> */}
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
                      <Skeleton className="h-4 w-[120px]" />
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
                      <Skeleton className="h-4 w-[50px]" />
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
                        {member.mobile}
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
                        {member.salesCount || 0}
                      </TableCell>
                      <TableCell>
                        {member.rechargesCount || 0}
                      </TableCell>
                      <TableCell>
                        {member.staffPin}
                      </TableCell>
                      <TableCell>
                        {member.staffPassword}
                      </TableCell>
                      {/* <TableCell>
                      {member.lastActive.toLocaleString()}
                      </TableCell> */}
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
                  status: 'active',
                  referralCommission: 0,
                  surabhiCommission: 0,
                  sevaCommission: 0,
                  cashOnlyCommission: 0
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Referral</TableHead>
                  <TableHead>Surabhi</TableHead>
                  <TableHead>Cash Only</TableHead>
                  <TableHead>Seva</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">
                      {store.name}
                      <div className="text-sm text-muted-foreground">
                        {store.address}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {store.storeLocation}
                      </div>
                    </TableCell>
                    <TableCell>
                      {store.contactNumber}
                    </TableCell>
                    <TableCell>
                      {store.currentBalance || 0}
                    </TableCell>
                    <TableCell>
                      {store.referralCommission}%
                    </TableCell>
                    <TableCell>
                      {store.surabhiCommission}%
                    </TableCell>
                    <TableCell>
                      {store.cashOnlyCommission}%
                    </TableCell>
                    <TableCell>
                      {store.sevaCommission}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                        {store.status}
                      </Badge>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={currentStaff?.name || ''}
                  onChange={(e) => setCurrentStaff({
                    ...currentStaff || {},
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
                  onChange={(e) => {
                    setCurrentStaff({
                      ...currentStaff || {},
                      mobile: e.target.value.replace(/\D/g, '')
                    });
                    setMobileError(''); // Clear error when typing
                  }}
                  placeholder="Enter mobile number"
                  disabled={!!currentStaff?.id}
                />
                {mobileError && <p className="text-sm text-red-500">{mobileError}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={currentStaff?.email || ''}
                onChange={(e) => {
                  setCurrentStaff({
                    ...currentStaff || {},
                    email: e.target.value
                  });
                  setEmailError(''); // Clear error when typing
                }}
                placeholder="Enter email address"
                disabled={!!currentStaff?.id}
              />
              {emailError && <p className="text-sm text-red-500">{emailError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={currentStaff?.role || 'staff'}
                  onValueChange={(value) => setCurrentStaff({
                    ...currentStaff || {},
                    role: value as 'admin' | 'staff',
                    ...(value === 'admin' ? { storeLocation: '' } : {})
                  })}
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

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={currentStaff?.status || 'active'}
                  onValueChange={(value) => setCurrentStaff({
                    ...currentStaff || {},
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned Store</Label>
                <Select
                  value={currentStaff?.storeLocation || ''}
                  onValueChange={(value) => setCurrentStaff({
                    ...currentStaff || {},
                    storeLocation: value
                  })}
                  disabled={currentStaff?.role === 'admin'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.name}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Staff PIN</Label>
                <Input
                  type="text"
                  value={currentStaff?.staffPin || ''}
                  onChange={(e) => setCurrentStaff({
                    ...currentStaff || {},
                    staffPin: e.target.value
                  })}
                  placeholder="Enter staff PIN"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sales Count</Label>
                <Input
                  type="number"
                  value={currentStaff?.salesCount || 0}
                  onChange={(e) => setCurrentStaff({
                    ...currentStaff || {},
                    salesCount: Number(e.target.value)
                  })}
                  placeholder="Enter sales count"
                />
              </div>
              <div className="space-y-2">
                <Label>Recharges Count</Label>
                <Input
                  type="number"
                  value={currentStaff?.rechargesCount || 0}
                  onChange={(e) => setCurrentStaff({
                    ...currentStaff || {},
                    rechargesCount: Number(e.target.value)
                  })}
                  placeholder="Enter Recharges count"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Staff Password</Label>
              <Input
                type="text"
                value={currentStaff?.staffPassword || ''}
                onChange={(e) => setCurrentStaff({
                  ...currentStaff || {},
                  staffPassword: e.target.value
                })}
                placeholder="Enter staff password"
              />
            </div>

            {currentStaff?.lastActive && (
              <div className="space-y-2">
                <Label>Last Active</Label>
                <div className="text-sm text-muted-foreground">
                  {currentStaff.lastActive.toLocaleString()}
                </div>
              </div>
            )}

            {currentStaff?.createdAt && (
              <div className="space-y-2">
                <Label>Created At</Label>
                <div className="text-sm text-muted-foreground">
                  {currentStaff.createdAt.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleSaveStaff} disabled={!!emailError || !!mobileError}>
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
              <Input
                type="tel"
                value={currentStore?.contactNumber || ''}
                onChange={(e) => {
                  const number = e.target.value.replace(/\D/g, '');
                  setCurrentStore({
                    ...currentStore,
                    contactNumber: number
                  });
                  setContactNumberError('');
                }}
                placeholder="Enter contact number"
                disabled={!!currentStore?.id}
              />
              {contactNumberError && <p className="text-sm text-red-500">{contactNumberError}</p>}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Commission Rates</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Referral (%)</Label>
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
                  <Label>Cash Only (%)</Label>
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

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={async () => {
                if (currentStore?.id && await handleDeleteStore(currentStore.id)) {
                  const storesSnapshot = await getDocs(collection(db, 'stores'));
                  const updatedStores = storesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                    updatedAt: doc.data().updatedAt?.toDate() || new Date()
                  })) as StoreType[];
                  setStores(updatedStores);
                  setIsDeleteStoreDialogOpen(false);
                  setCurrentStore(null);
                }
              }}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
