import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { StaffType } from '@/types/types';
export interface User {
  id: string;
  mobile: string;
  role: 'admin' | 'staff' | 'customer';
  name?: string;
  email?: string;
  storeLocation?: string;
  createdAt: string;
}

export const getCustomerByMobile = async (mobile: string, password: string): Promise<User | null> => {
  try {
    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('mobile', '==', mobile));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const customerDoc = querySnapshot.docs[0];
      const customerData = customerDoc.data();
      
      // In production, use proper password hashing (bcrypt, etc.)
      if (customerData.customerPassword === password) {
        return {
          id: customerDoc.id,
          mobile: customerData.mobile,
          role: 'customer',
          name: customerData.name,
          email: customerData.email,
          createdAt: customerData.createdAt
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching customer:', error);
    throw new Error('Failed to authenticate customer');
  }
};


export const getStaffByMobile = async (
  mobile: string,
  password: string,
  role: 'admin' | 'staff'
): Promise<StaffType | null> => {
  try {
    // Query staff collection for the mobile number
    const staffRef = collection(db, 'staff');
    const q = query(staffRef, where('mobile', '==', mobile));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Get the first matching document (assuming mobile is unique)
    const doc = querySnapshot.docs[0];
    const staffData = doc.data();

    // Verify password
    if (staffData.staffPassword !== password) {
      return null;
    }

    // Verify role if specified
    if (role && staffData.role !== role) {
      return null;
    }

    // Map to StaffType interface
    const staff: StaffType = {
      id: doc.id,
      name: staffData.name,
      mobile: staffData.mobile,
      email: staffData.email || '',
      storeLocation: staffData.storeLocation || '',
      role: staffData.role,
      createdAt: staffData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      status: staffData.status || 'active',
      salesCount: staffData.salesCount || 0,
      staffPin: staffData.staffPin || '',
      lastActive: staffData.lastActive?.toDate().toISOString(),
      staffPassword: staffData.staffPassword
    };

    return staff;
  } catch (error) {
    console.error('Error fetching staff:', error);
    return null;
  }
};

export const verifyUserExists = async (user: User): Promise<boolean> => {
  try {
    let userDoc;
    if (user.role === 'customer') {
      userDoc = await getDoc(doc(db, 'customers', user.id));
    } else {
      userDoc = await getDoc(doc(db, 'staff', user.id));
    }
    return userDoc.exists();
  } catch (error) {
    console.error('Error verifying user existence:', error);
    return false;
  }
};

export const signInWithFirebase = async (email: string, password: string): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.warn('Firebase auth login failed:', error);
    throw error;
  }
};