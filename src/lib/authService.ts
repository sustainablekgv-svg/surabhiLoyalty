import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
export interface User {
  id: string;
  mobile: string;
  role: 'admin' | 'staff' | 'customer';
  name?: string;
  email?: string;
  storeLocation?: string;
  createdAt: string;
}

export const getCustomerByMobile = async (
  mobile: string,
  password: string
): Promise<User | null> => {
  try {
    const customersRef = collection(db, 'Customers');
    const q = query(customersRef, where('customerMobile', '==', mobile));
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
          createdAt: customerData.createdAt,
        };
      }
    }
    return null;
  } catch (error) {
    // console.error('Error fetching customer:', error);
    throw new Error('Failed to authenticate customer');
  }
};

export const getStaffByMobile = async (
  mobile: string,
  password: string,
  role: 'admin' | 'staff'
): Promise<User | null> => {
  try {
    // Query staff collection for the mobile number
    const staffRef = collection(db, 'staff');
    const q = query(staffRef, where('staffMobile', '==', mobile));
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

    // Map to User interface
    const user: User = {
      id: doc.id,
      mobile: staffData.staffMobile,
      role: staffData.role,
      name: staffData.staffName,
      email: staffData.staffEmail,
      storeLocation: staffData.storeLocation,
      createdAt: staffData.staffCreatedAt?.toDate().toISOString() || new Date().toISOString(),
    };

    return user;
  } catch (error) {
    // console.error('Error fetching staff:', error);
    return null;
  }
};

export const verifyUserExists = async (user: User): Promise<boolean> => {
  try {
    let userDoc;
    if (user.role === 'customer') {
      userDoc = await getDoc(doc(db, 'Customers', user.id));
    } else {
      userDoc = await getDoc(doc(db, 'staff', user.id));
    }
    return userDoc.exists();
  } catch (error) {
    // console.error('Error verifying user existence:', error);
    return false;
  }
};

export const signInWithFirebase = async (email: string, password: string): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    // console.warn('Firebase auth login failed:', error);
    throw error;
  }
};
