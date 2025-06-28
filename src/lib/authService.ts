import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
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

export const getStaffByMobile = async (mobile: string, password: string, role: string): Promise<User | null> => {
  try {
    const staffRef = collection(db, 'staff');
    console.log("THe line 48 info is", staffRef, typeof (mobile), mobile, typeof(password),password, typeof(role),role);
    const q = query(
      staffRef, 
      where('mobile', '==', mobile),
      where('role', '==', role)
    );
    console.log("THe line 54 data is", q)
    const querySnapshot = await getDocs(q);
    console.log("THe line 58 data is", querySnapshot, querySnapshot.empty);
    
    if (!querySnapshot.empty) {
      const staffDoc = querySnapshot.docs[0];
      const staffData = staffDoc.data();
      console.log("THe line 64 data is", staffData);
      
      // In production, use proper password hashing (bcrypt, etc.)
      if (staffData.staffPassword === password) {
        return {
          id: staffDoc.id,
          mobile: staffData.mobile,
          role: staffData.role,
          name: staffData.name,
          email: staffData.email,
          storeLocation: staffData.storeLocation,
          createdAt: staffData.createdAt
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching staff:', error);
    throw new Error('Failed to authenticate staff');
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