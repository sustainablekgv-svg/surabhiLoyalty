import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { isEncrypted, safeDecryptText } from '@/lib/encryption';
import { auth, db } from '@/lib/firebase';
import { CustomerType, StaffType, User } from '@/types/types';

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
      const customerData = customerDoc.data() as CustomerType;

      // Compare password with stored password (encrypted or plain)
      if (customerData.customerPassword) {
        let passwordMatch = false;

        if (isEncrypted(customerData.customerPassword)) {
          // Try to decrypt the stored password
          const decryptedStoredPassword = safeDecryptText(customerData.customerPassword);
          passwordMatch = decryptedStoredPassword === password;
        } else {
          // Direct comparison for unencrypted passwords (backward compatibility)
          passwordMatch = customerData.customerPassword === password;
        }

        if (passwordMatch) {
          return {
            ...customerData,
            id: customerDoc.id,
            role: 'customer', // Ensure role is set
          };
        }
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
    const staffData = doc.data() as StaffType;
    // console.log('The line 36 is', staffData);
    // Compare password with stored password (encrypted or plain)
    if (staffData.staffPassword) {
      let passwordMatch = false;

      if (isEncrypted(staffData.staffPassword)) {
        // Try to decrypt the stored password
        const decryptedStoredPassword = safeDecryptText(staffData.staffPassword);
        passwordMatch = decryptedStoredPassword === password;
      } else {
        // Direct comparison for unencrypted passwords (backward compatibility)
        passwordMatch = staffData.staffPassword === password;
      }

      if (!passwordMatch) {
        return null;
      }
    } else {
      return null;
    }

    // Verify role if specified
    if (role && staffData.role !== role) {
      return null;
    }

    // Check if staff status is active
    if (staffData.role !== 'admin' && staffData.staffStatus !== 'active') {
      throw new Error('Staff account is disabled. Please contact administrator.');
    }

    // For staff role, check if the store is active
    if (role === 'staff' && staffData.storeLocation) {
      const storesRef = collection(db, 'stores');
      const storeQuery = query(storesRef, where('storeName', '==', staffData.storeLocation));
      const storeSnapshot = await getDocs(storeQuery);

      if (!storeSnapshot.empty) {
        const storeData = storeSnapshot.docs[0].data();
        if (storeData.storeStatus !== 'active') {
          throw new Error('Store is currently disabled. Please contact administrator.');
        }
      } else {
        throw new Error('Store not found. Please contact administrator.');
      }
    }

    // Map to User interface
    return {
      ...staffData,
      id: doc.id,
    };
  } catch (error) {
    // console.error('Error fetching staff:', error);
    throw error; // Re-throw to preserve error message
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
