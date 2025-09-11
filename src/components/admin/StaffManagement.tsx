// components/StaffStoreManagement.tsx
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Edit, MapPin, PlusCircle, Shield, Store, Trash2, User, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { StaffType, StoreType } from '@/types/types';

async function checkContactNumberExists(
  contactNumber: string,
  currentStoreId?: string
): Promise<boolean> {
  if (!contactNumber) return false;

  const storesRef = collection(db, 'tores');
  const q = query(storesRef, where('storeContactNumber', '==', contactNumber));

  const querySnapshot = await getDocs(q);

  // If editing, exclude the current store from the check
  if (currentStoreId) {
    return querySnapshot.docs.some(doc => doc.id !== currentStoreId);
  }

  return !querySnapshot.empty;
}

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
          storeName: doc.data().storeName || '',
          storeLocation: doc.data().storeLocation || '',
          storeAddress: doc.data().storeAddress || '',
          storeContactNumber: doc.data().storeContactNumber || '',
          storePrefix: doc.data().storePrefix || '',
          storeCurrentBalance: Number(doc.data().storeCurrentBalance) || 0,
          storeSevaBalance: Number(doc.data().storeSevaBalance) || 0,
          referralCommission: Number(doc.data().referralCommission) || 0,
          surabhiCommission: Number(doc.data().surabhiCommission) || 0,
          sevaCommission: Number(doc.data().sevaCommission) || 0,
          cashOnlyCommission: Number(doc.data().cashOnlyCommission) || 0,
          storeStatus: doc.data().storeStatus || 'active',
          walletEnabled: doc.data().walletEnabled !== false,
          demoStore: doc.data().demoStore || false,
          adminCurrentBalance: Number(doc.data().adminCurrentBalance) || 0,
          adminStoreProfit: Number(doc.data().adminStoreProfit) || 0,
          storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
          storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
        })) as StoreType[];
        setStores(storesData);

        // Fetch staff
        const staffSnapshot = await getDocs(collection(db, 'staff'));
        const staffData = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          staffName: doc.data().staffName || '',
          staffMobile: doc.data().staffMobile || '',
          staffEmail: doc.data().staffEmail || '',
          storeLocation: doc.data().storeLocation || '',
          demoStore: doc.data().demoStore || false,
          role: doc.data().role || 'staff',
          staffStatus: doc.data().staffStatus || 'active',
          staffSalesCount: Number(doc.data().staffSalesCount) || 0,
          staffPassword: doc.data().staffPassword || '',
          staffRechargesCount: Number(doc.data().staffRechargesCount) || 0,
          lastActive: doc.data().lastActive?.toDate(),
          createdAt: doc.data().createdAt || Timestamp.now(),
        })) as StaffType[];
        setStaff(staffData);
      } catch (error) {
        toast.error('Error fetching data');
        // console.error('Error fetching data:', error);
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
    if (!currentStaff?.staffEmail || !emailRegex.test(currentStaff.staffEmail)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      // Check if email exists
      const emailQuery = query(
        collection(db, 'staff'),
        where('staffEmail', '==', currentStaff.staffEmail)
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
    if (!currentStaff?.staffMobile || currentStaff.staffMobile.length !== 10) {
      setMobileError('Please enter a valid 10-digit mobile number');
      isValid = false;
    } else {
      // Check if mobile exists
      const mobileQuery = query(
        collection(db, 'staff'),
        where('staffMobile', '==', currentStaff.staffMobile)
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
        staffName: currentStaff.staffName,
        staffMobile: currentStaff.staffMobile,
        staffEmail: currentStaff.staffEmail,
        role: currentStaff.role,
        staffStatus: currentStaff.staffStatus,
        storeLocation: currentStaff.storeLocation,
        staffSalesCount: currentStaff.staffSalesCount || 0,
        staffRechargesCount: currentStaff.staffRechargesCount || 0,
        staffPassword: currentStaff.staffPassword || '',
        lastActive: currentStaff.lastActive || null,
        createdAt: currentStaff.id
          ? currentStaff.createdAt instanceof Timestamp
            ? currentStaff.createdAt
            : currentStaff.createdAt
              ? Timestamp.fromDate(new Date(currentStaff.createdAt))
              : Timestamp.now()
          : Timestamp.now(),
        // Ensure createdAt is always a Timestamp object
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
        staffName: doc.data().staffName || '',
        staffMobile: doc.data().staffMobile || '',
        staffEmail: doc.data().staffEmail || '',
        storeLocation: doc.data().storeLocation || '',
        role: doc.data().role || 'staff',
        staffStatus: doc.data().staffStatus || 'active',
        staffSalesCount: Number(doc.data().staffSalesCount) || 0,
        staffRechargesCount: doc.data().staffRechargesCount || 0,
        staffPassword: doc.data().staffPassword || '',
        lastActive: doc.data().lastActive?.toDate(),
        createdAt: doc.data().createdAt || Timestamp.now(),
      })) as StaffType[];
      setStaff(refreshedStaffData);
    } catch (error) {
      // console.error('Error saving staff:', error);
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
        lastActive: doc.data().lastActive?.toDate(),
        createdAt: doc.data().createdAt || Timestamp.now(),
      })) as StaffType[];
      setStaff(updatedStaff);

      setIsDeleteStaffDialogOpen(false);
      setCurrentStaff(null);
    } catch (error) {
      toast.error('Error deleting staff');
      // console.error('Error deleting staff:', error);
    }
  };

  // Store CRUD operations
  const handleSaveStore = async () => {
    if (!currentStore) return false;

    if (
      !currentStore.storeName ||
      !currentStore.storeLocation ||
      !currentStore.storeAddress ||
      !currentStore.storeContactNumber ||
      !currentStore.storePrefix
    ) {
      toast.error('Please fill all required fields');
      return false;
    }

    // Check if storePrefix is unique
    const prefixQuery = query(
      collection(db, 'stores'),
      where('storePrefix', '==', currentStore.storePrefix.trim().toUpperCase())
    );

    if (!currentStore.id) {
      // Only check for uniqueness when creating a new store
      const prefixSnapshot = await getDocs(prefixQuery);
      if (!prefixSnapshot.empty) {
        toast.error('Store prefix already exists. Please use a unique prefix.');
        return false;
      }
    } else {
      // When updating, check if another store (not this one) has the same prefix
      const prefixSnapshot = await getDocs(prefixQuery);
      const hasConflict = prefixSnapshot.docs.some(doc => doc.id !== currentStore.id);
      if (hasConflict) {
        toast.error('Store prefix already exists. Please use a unique prefix.');
        return false;
      }
    }

    try {
      const storeData = {
        storeName: currentStore.storeName.trim(),
        storeLocation: currentStore.storeLocation.trim(),
        storeAddress: currentStore.storeAddress.trim(),
        storeContactNumber: currentStore.storeContactNumber.trim(),
        storePrefix: currentStore.storePrefix.trim().toUpperCase(),
        referralCommission: Number(currentStore.referralCommission) || 0,
        surabhiCommission: Number(currentStore.surabhiCommission) || 0,
        sevaCommission: Number(currentStore.sevaCommission) || 0,
        storeCurrentBalance: Number(currentStore.storeCurrentBalance) || 0,
        storeSevaBalance: Number(currentStore.storeSevaBalance) || 0,
        cashOnlyCommission: Number(currentStore.cashOnlyCommission) || 0,
        storeStatus: currentStore.storeStatus || 'active',
        walletEnabled: currentStore.walletEnabled !== false,
        demoStore: currentStore.demoStore || false,
        adminCurrentBalance: Number(currentStore.adminCurrentBalance) || 0,
        adminStoreProfit: Number(currentStore.adminStoreProfit) || 0,
        storeUpdatedAt: serverTimestamp(),
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
          storeCreatedAt: serverTimestamp(),
          adminCurrentBalance: 0,
          adminStoreProfit: 0,
          storeSevaBalance: 0,
        });
        toast.success('Store created successfully');
      }

      // Refresh data
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const updatedStores = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        storeName: doc.data().storeName || '',
        storeLocation: doc.data().storeLocation || '',
        storeAddress: doc.data().storeAddress || '',
        storeContactNumber: doc.data().storeContactNumber || '',
        storePrefix: doc.data().storePrefix || '',
        storeCurrentBalance: Number(doc.data().storeCurrentBalance) || 0,
        storeSevaBalance: Number(doc.data().storeSevaBalance) || 0,
        referralCommission: Number(doc.data().referralCommission) || 0,
        surabhiCommission: Number(doc.data().surabhiCommission) || 0,
        sevaCommission: Number(doc.data().sevaCommission) || 0,
        cashOnlyCommission: Number(doc.data().cashOnlyCommission) || 0,
        storeStatus: doc.data().storeStatus || 'active',
        walletEnabled: doc.data().walletEnabled !== false,
        demoStore: doc.data().demoStore || false,
        adminCurrentBalance: Number(doc.data().adminCurrentBalance) || 0,
        adminStoreProfit: Number(doc.data().adminStoreProfit) || 0,
        storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
        storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
      })) as StoreType[];
      setStores(updatedStores);

      setIsStoreDialogOpen(false);
      setCurrentStore(null);
      return true;
    } catch (error) {
      // console.error('Error saving store:', error);
      toast.error(
        `Error saving store: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!storeId) return false;

    try {
      // Check for assigned staff
      const staffQuery = query(collection(db, 'staff'), where('storeLocation', '==', storeId));
      const staffSnapshot = await getDocs(staffQuery);

      if (!staffSnapshot.empty) {
        toast.error('Cannot delete store with assigned staff');
        return false;
      }

      await deleteDoc(doc(db, 'stores', storeId));
      toast.success('Store deleted successfully');
      return true;
    } catch (error) {
      // console.error('Error deleting store:', error);
      toast.error(
        `Error deleting store: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentStore?.storeContactNumber && currentStore.storeContactNumber.length === 10) {
        const exists = await checkContactNumberExists(
          currentStore.storeContactNumber,
          currentStore?.id
        );
        if (exists) {
          setContactNumberError('This contact number is already registered to another store');
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentStore?.storeContactNumber, currentStore?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3 xs:gap-2">
        <div>
          <h1 className="text-xl xs:text-2xl font-bold">System Configuration</h1>
          <p className="text-sm xs:text-base text-muted-foreground">
            Manage staff accounts and store locations
          </p>
          <p className="text-sm xs:text-base text-muted-foreground">
            This tab shows both details of both live and demo stores
          </p>
        </div>

        <div className="flex flex-col xs:flex-row gap-2 w-full xs:w-auto">
          <Button
            variant={activeTab === 'staff' ? 'default' : 'outline'}
            onClick={() => setActiveTab('staff')}
            className="h-10 text-xs xs:text-sm w-full xs:w-auto justify-start xs:justify-center"
          >
            <User className="h-3.5 w-3.5 xs:h-4 xs:w-4 mr-1.5 xs:mr-2" />
            Staff Management
          </Button>
          <Button
            variant={activeTab === 'stores' ? 'default' : 'outline'}
            onClick={() => setActiveTab('stores')}
            className="h-10 text-xs xs:text-sm w-full xs:w-auto justify-start xs:justify-center"
          >
            <Store className="h-3.5 w-3.5 xs:h-4 xs:w-4 mr-1.5 xs:mr-2" />
            Store Management
          </Button>
        </div>
      </div>

      {activeTab === 'staff' ? (
        <Card>
          <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 xs:gap-0">
              <div>
                <CardTitle className="text-sm xs:text-base sm:text-lg">Staff Members</CardTitle>
                <CardDescription className="text-[10px] xs:text-xs sm:text-sm">
                  {staff.length} staff members across {stores.length} stores
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setCurrentStaff({
                    role: 'staff',
                    staffStatus: 'active',
                    staffSalesCount: 0,
                    staffRechargesCount: 0,
                    staffPassword: '',
                    createdAt: Timestamp.now(),
                  });
                  setIsStaffDialogOpen(true);
                }}
                className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm px-2 xs:px-3 sm:px-4 w-full xs:w-auto"
              >
                <UserPlus className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 mr-1 xs:mr-1.5 sm:mr-2" />
                Add Staff
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs xs:text-sm">Name</TableHead>
                    <TableHead className="text-xs xs:text-sm">Contact</TableHead>
                    <TableHead className="text-xs xs:text-sm">Role</TableHead>
                    <TableHead className="text-xs xs:text-sm">Store</TableHead>
                    <TableHead className="text-xs xs:text-sm">Status</TableHead>
                    <TableHead className="text-xs xs:text-sm">Sales Count</TableHead>
                    <TableHead className="text-xs xs:text-sm">Recharges Count</TableHead>
                    <TableHead className="text-xs xs:text-sm">Staff Pin</TableHead>
                    <TableHead className="text-xs xs:text-sm">Password</TableHead>
                    <TableHead className="text-xs xs:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                {isLoading ? (
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, index) => (
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
                    ))}
                  </TableBody>
                ) : (
                  <TableBody>
                    {staff.map(member => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium text-xs xs:text-sm">
                          <div className="flex items-center gap-1 xs:gap-2">
                            {member.staffName}
                            {member.role === 'admin' && (
                              <Shield className="h-3 w-3 xs:h-4 xs:w-4 text-primary" />
                            )}
                            {member.demoStore && (
                              <Badge variant={'default'} className="text-[10px] xs:text-xs">
                                Demo
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">
                            {member.staffEmail}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs xs:text-sm">{member.staffMobile}</TableCell>
                        <TableCell>
                          <Badge
                            variant={member.role === 'admin' ? 'default' : 'outline'}
                            className="text-[10px] xs:text-xs"
                          >
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs xs:text-sm">
                          {stores.find(s => s.storeName === member.storeLocation)?.storeName ||
                            'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={member.staffStatus === 'active' ? 'default' : 'secondary'}
                            className="text-[10px] xs:text-xs"
                          >
                            {member.staffStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs xs:text-sm">
                          {member.staffSalesCount || 0}
                        </TableCell>
                        <TableCell className="text-xs xs:text-sm">
                          {member.staffRechargesCount || 0}
                        </TableCell>
                        <TableCell className="text-xs xs:text-sm">{member.staffPassword}</TableCell>
                        <TableCell>
                          <div className="flex flex-col xs:flex-row gap-1 xs:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] xs:text-xs h-7 xs:h-8 px-1.5 xs:px-2"
                              onClick={() => {
                                setCurrentStaff(member);
                                setIsStaffDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3 xs:h-4 xs:w-4 mr-0.5 xs:mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 text-[10px] xs:text-xs h-7 xs:h-8 px-1.5 xs:px-2"
                              onClick={() => {
                                setCurrentStaff(member);
                                setIsDeleteStaffDialogOpen(true);
                              }}
                              disabled={member.role === 'admin'}
                            >
                              <Trash2 className="h-3 w-3 xs:h-4 xs:w-4 mr-0.5 xs:mr-1" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 xs:gap-0">
              <div>
                <CardTitle className="text-sm xs:text-base sm:text-lg">Store Locations</CardTitle>
                <CardDescription className="text-[10px] xs:text-xs sm:text-sm">
                  Manage all store locations in the system
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setCurrentStore({
                    storeStatus: 'active',
                    referralCommission: 0,
                    surabhiCommission: 0,
                    sevaCommission: 0,
                    cashOnlyCommission: 0,
                  });
                  setIsStoreDialogOpen(true);
                }}
                className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm px-2 xs:px-3 sm:px-4 w-full xs:w-auto"
              >
                <PlusCircle className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 mr-1 xs:mr-1.5 sm:mr-2" />
                Add Store
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-2 xs:px-3 sm:px-6 py-2 xs:py-3 sm:py-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* <TableHead>ID</TableHead> */}
                    <TableHead className="text-xs xs:text-sm">Name</TableHead>
                    <TableHead className="text-xs xs:text-sm">Location</TableHead>
                    <TableHead className="text-xs xs:text-sm">Address</TableHead>
                    <TableHead className="text-xs xs:text-sm">Contact</TableHead>
                    <TableHead className="text-xs xs:text-sm">Store Balance</TableHead>
                    <TableHead className="text-xs xs:text-sm">Seva Balance</TableHead>
                    <TableHead className="text-xs xs:text-sm">Admin Balance</TableHead>
                    <TableHead className="text-xs xs:text-sm">Admin Profit</TableHead>
                    <TableHead className="text-xs xs:text-sm">Referral %</TableHead>
                    <TableHead className="text-xs xs:text-sm">Surabhi %</TableHead>
                    <TableHead className="text-xs xs:text-sm">Cash Only %</TableHead>
                    <TableHead className="text-xs xs:text-sm">Seva %</TableHead>
                    {/* <TableHead>Status</TableHead> */}
                    {/* <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead> */}
                    <TableHead className="text-xs xs:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map(store => (
                    <TableRow key={store.id}>
                      {/* <TableCell className="text-xs">
                      {store.id.substring(0, 8)}...
                    </TableCell> */}
                      <TableCell className="font-medium text-xs xs:text-sm">
                        {store.storeName}
                        {store.demoStore && (
                          <Badge
                            variant={store.storeStatus === 'active' ? 'default' : 'secondary'}
                            className="text-[10px] xs:text-xs"
                          >
                            Demo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 xs:h-4 xs:w-4" />
                          {store.storeLocation}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs xs:text-sm">
                        {store.storeAddress}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        {store.storeContactNumber}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        ₹{store.storeCurrentBalance.toFixed(2) || 0}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        ₹{store.storeSevaBalance.toFixed(2) || 0}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        ₹{store.adminCurrentBalance.toFixed(2) || 0}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        ₹{store.adminStoreProfit.toFixed(2) || 0}
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        {store.referralCommission}%
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        {store.surabhiCommission}%
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">
                        {store.cashOnlyCommission}%
                      </TableCell>
                      <TableCell className="text-xs xs:text-sm">{store.sevaCommission}%</TableCell>
                      {/* <TableCell>
                      <Badge variant={store.storeStatus === 'active' ? 'default' : 'secondary'}>
                        {store.storeStatus}
                      </Badge>
                    </TableCell> */}
                      {/* <TableCell className="text-xs">
                      {new Date(store.storeCreatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(store.storeUpdatedAt).toLocaleDateString()}
                    </TableCell> */}
                      <TableCell>
                        <div className="flex flex-col xs:flex-row gap-1 xs:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] xs:text-xs h-7 xs:h-8 px-1.5 xs:px-2"
                            onClick={() => {
                              setCurrentStore(store);
                              setIsStoreDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3 xs:h-4 xs:w-4 mr-0.5 xs:mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 text-[10px] xs:text-xs h-7 xs:h-8 px-1.5 xs:px-2"
                            onClick={() => {
                              setCurrentStore(store);
                              setIsDeleteStoreDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 xs:h-4 xs:w-4 mr-0.5 xs:mr-1" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Dialog */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto px-2 xs:px-4 sm:px-6 py-3 xs:py-4 sm:py-6">
          <DialogHeader className="space-y-1 xs:space-y-2">
            <DialogTitle className="text-base xs:text-lg sm:text-xl">
              {currentStaff?.id ? 'Edit Staff Member' : 'Add New Staff Member'}
            </DialogTitle>
            <DialogDescription className="text-[10px] xs:text-xs sm:text-sm">
              {currentStaff?.id ? 'Update staff details' : 'Create a new staff account'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Full Name *</Label>
                <Input
                  value={currentStaff?.staffName || ''}
                  onChange={e =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      staffName: e.target.value,
                    })
                  }
                  placeholder="Enter staff name"
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
                />
              </div>

              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Mobile Number *</Label>
                <Input
                  type="tel"
                  value={currentStaff?.staffMobile || ''}
                  onChange={e => {
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      staffMobile: e.target.value.replace(/\D/g, ''),
                    });
                    setMobileError(''); // Clear error when typing
                  }}
                  placeholder="Enter mobile number"
                  disabled={!!currentStaff?.id}
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
                />
                {mobileError && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-red-500">{mobileError}</p>
                )}
              </div>
            </div>

            <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
              <Label className="text-xs xs:text-sm">Email *</Label>
              <Input
                type="email"
                value={currentStaff?.staffEmail || ''}
                onChange={e => {
                  setCurrentStaff({
                    ...(currentStaff || {}),
                    staffEmail: e.target.value,
                  });
                  setEmailError(''); // Clear error when typing
                }}
                placeholder="Enter email address"
                disabled={!!currentStaff?.id}
                className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
              />
              {emailError && (
                <p className="text-[10px] xs:text-xs sm:text-sm text-red-500">{emailError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Role *</Label>
                <Select
                  value={currentStaff?.role || 'staff'}
                  onValueChange={value =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      role: value as 'admin' | 'staff',
                      ...(value === 'admin' ? { storeLocation: '' } : {}),
                    })
                  }
                >
                  <SelectTrigger className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={currentStaff?.staffStatus || 'active'}
                  onValueChange={value =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      staffStatus: value as 'active' | 'inactive',
                    })
                  }
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
                  onValueChange={value =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      storeLocation: value,
                    })
                  }
                  disabled={currentStaff?.role === 'admin'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.storeName}>
                        {store.storeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Demo Staff?</Label>
                <Select
                  value={
                    currentStaff?.demoStore === true
                      ? 'true'
                      : currentStaff?.demoStore === false
                        ? 'false'
                        : undefined
                  }
                  onValueChange={value =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      demoStore: value === 'true',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sales Count</Label>
                <Input
                  type="number"
                  value={currentStaff?.staffSalesCount || 0}
                  onChange={e =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      staffSalesCount: Number(e.target.value),
                    })
                  }
                  placeholder="Enter sales count"
                />
              </div>
              <div className="space-y-2">
                <Label>Recharges Count</Label>
                <Input
                  type="number"
                  value={currentStaff?.staffRechargesCount || 0}
                  onChange={e =>
                    setCurrentStaff({
                      ...(currentStaff || {}),
                      staffRechargesCount: Number(e.target.value),
                    })
                  }
                  placeholder="Enter Recharges count"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Staff Password</Label>
              <Input
                type="text"
                value={currentStaff?.staffPassword || ''}
                onChange={e =>
                  setCurrentStaff({
                    ...(currentStaff || {}),
                    staffPassword: e.target.value,
                  })
                }
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
              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Created At</Label>
                <div className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">
                  {currentStaff.createdAt.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 xs:mt-6 sm:mt-8 flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4">
            <Button
              onClick={handleSaveStaff}
              disabled={!!emailError || !!mobileError}
              className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm w-full xs:w-auto"
            >
              {currentStaff?.id ? 'Save Changes' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Dialog */}
      <Dialog open={isDeleteStaffDialogOpen} onOpenChange={setIsDeleteStaffDialogOpen}>
        <DialogContent className="sm:max-w-[425px] px-2 xs:px-4 sm:px-6 py-3 xs:py-4 sm:py-6">
          <DialogHeader className="space-y-1 xs:space-y-2">
            <DialogTitle className="text-base xs:text-lg sm:text-xl">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-[10px] xs:text-xs sm:text-sm">
              Are you sure you want to delete {currentStaff?.staffName}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 xs:mt-6 sm:mt-8 flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4">
            <Button
              variant="destructive"
              onClick={handleDeleteStaff}
              className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm w-full xs:w-auto"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto px-2 xs:px-4 sm:px-6 py-3 xs:py-4 sm:py-6">
          <DialogHeader className="space-y-1 xs:space-y-2">
            <DialogTitle className="text-base xs:text-lg sm:text-xl">
              {currentStore?.id ? 'Edit Store' : 'Add New Store'}
            </DialogTitle>
            <DialogDescription className="text-[10px] xs:text-xs sm:text-sm">
              {currentStore?.id ? 'Update store details' : 'Create a new store location'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Store Name *</Label>
                <Input
                  value={currentStore?.storeName || ''}
                  onChange={e =>
                    setCurrentStore({
                      ...currentStore,
                      storeName: e.target.value,
                    })
                  }
                  placeholder="Enter store name"
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
                />
              </div>

              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Location *</Label>
                <Input
                  value={currentStore?.storeLocation || ''}
                  onChange={e =>
                    setCurrentStore({
                      ...currentStore,
                      storeLocation: e.target.value,
                    })
                  }
                  placeholder="Enter location"
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
                />
              </div>
            </div>

            <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
              <Label className="text-xs xs:text-sm">Invoice Prefix *</Label>
              <div className="flex items-center">
                <Input
                  value={currentStore?.storePrefix || ''}
                  onChange={e => {
                    const prefix = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4);
                    setCurrentStore({
                      ...currentStore,
                      storePrefix: prefix,
                    });
                  }}
                  placeholder="Enter 3-4 digit prefix (e.g., ABC)"
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded uppercase"
                  maxLength={4}
                />
              </div>
              <p className="text-[10px] xs:text-xs text-muted-foreground">
                This prefix will be used for invoice ID generation (e.g., ABC001)
              </p>
            </div>

            <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
              <Label className="text-xs xs:text-sm">Address *</Label>
              <Input
                value={currentStore?.storeAddress || ''}
                onChange={e =>
                  setCurrentStore({
                    ...currentStore,
                    storeAddress: e.target.value,
                  })
                }
                placeholder="Enter full address"
                className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Number *</Label>
              <Input
                type="tel"
                value={currentStore?.storeContactNumber || ''}
                onChange={e => {
                  const number = e.target.value.replace(/\D/g, '');
                  setCurrentStore({
                    ...currentStore,
                    storeContactNumber: number,
                  });
                  setContactNumberError('');
                }}
                placeholder="Enter contact number"
                disabled={!!currentStore?.id}
              />
              {contactNumberError && <p className="text-sm text-red-500">{contactNumberError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Store Current Balance</Label>
                <Input
                  type="number"
                  value={currentStore?.storeCurrentBalance || 0}
                  onChange={e =>
                    setCurrentStore({
                      ...currentStore,
                      storeCurrentBalance: Number(e.target.value),
                    })
                  }
                  placeholder="Enter store current balance"
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
                />
              </div>

              <div className="space-y-2">
                <Label>Admin Current Balance</Label>
                <Input
                  type="number"
                  value={currentStore?.adminCurrentBalance || 0}
                  onChange={e =>
                    setCurrentStore({
                      ...currentStore,
                      adminCurrentBalance: Number(e.target.value),
                    })
                  }
                  placeholder="Enter admin current balance"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <Label className="text-xs xs:text-sm">Store Seva Balance</Label>
                <Input
                  type="number"
                  value={currentStore?.storeSevaBalance || 0}
                  onChange={e =>
                    setCurrentStore({
                      ...currentStore,
                      storeSevaBalance: Number(e.target.value),
                    })
                  }
                  placeholder="Enter store seva balance"
                  className="h-7 xs:h-8 sm:h-9 text-xs xs:text-sm rounded-[4px] xs:rounded"
                />
              </div>

              <div className="space-y-2">
                <Label>Admin Store Profit</Label>
                <Input
                  type="number"
                  value={currentStore?.adminStoreProfit || 0}
                  onChange={e =>
                    setCurrentStore({
                      ...currentStore,
                      adminStoreProfit: Number(e.target.value),
                    })
                  }
                  placeholder="Enter admin store profit"
                />
              </div>
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
                    onChange={e =>
                      setCurrentStore({
                        ...currentStore,
                        referralCommission: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Surabhi (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.surabhiCommission || 0}
                    onChange={e =>
                      setCurrentStore({
                        ...currentStore,
                        surabhiCommission: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cash Only (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.cashOnlyCommission || 0}
                    onChange={e =>
                      setCurrentStore({
                        ...currentStore,
                        cashOnlyCommission: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Seva (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentStore?.sevaCommission || 0}
                    onChange={e =>
                      setCurrentStore({
                        ...currentStore,
                        sevaCommission: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={currentStore?.storeStatus || 'active'}
                  onValueChange={value =>
                    setCurrentStore({
                      ...currentStore,
                      storeStatus: value as 'active' | 'inactive',
                    })
                  }
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

              <div className="space-y-2">
                <Label>Demo Store?</Label>
                <Select
                  value={currentStore?.demoStore ? 'true' : 'false'}
                  onValueChange={value =>
                    setCurrentStore({
                      ...currentStore,
                      demoStore: value === 'true',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Wallet Enabled</Label>
                <Select
                  value={currentStore?.walletEnabled !== false ? 'true' : 'false'}
                  onValueChange={value =>
                    setCurrentStore({
                      ...currentStore,
                      walletEnabled: value === 'true',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
        <DialogContent className="sm:max-w-[425px] px-2 xs:px-4 sm:px-6 py-3 xs:py-4 sm:py-6">
          <DialogHeader className="space-y-1 xs:space-y-2">
            <DialogTitle className="text-base xs:text-lg sm:text-xl">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-[10px] xs:text-xs sm:text-sm">
              Are you sure you want to delete {currentStore?.storeName}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 xs:mt-6 sm:mt-8 flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4">
            <Button
              variant="destructive"
              className="h-8 xs:h-9 sm:h-10 text-xs xs:text-sm w-full xs:w-auto"
              onClick={async () => {
                if (currentStore?.id && (await handleDeleteStore(currentStore.id))) {
                  const storesSnapshot = await getDocs(collection(db, 'stores'));
                  const updatedStores = storesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    storeName: doc.data().storeName || '',
                    storeLocation: doc.data().storeLocation || '',
                    storeAddress: doc.data().storeAddress || '',
                    storeContactNumber: doc.data().storeContactNumber || '',
                    storePrefix: doc.data().storePrefix || '',
                    storeCurrentBalance: Number(doc.data().storeCurrentBalance) || 0,
                    storeSevaBalance: Number(doc.data().storeSevaBalance) || 0,
                    referralCommission: Number(doc.data().referralCommission) || 0,
                    surabhiCommission: Number(doc.data().surabhiCommission) || 0,
                    sevaCommission: Number(doc.data().sevaCommission) || 0,
                    cashOnlyCommission: Number(doc.data().cashOnlyCommission) || 0,
                    storeStatus: doc.data().storeStatus || 'active',
                    walletEnabled: doc.data().walletEnabled || false,
                    adminCurrentBalance: Number(doc.data().adminCurrentBalance) || 0,
                    adminStoreProfit: Number(doc.data().adminStoreProfit) || 0,
                    storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
                    storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
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
