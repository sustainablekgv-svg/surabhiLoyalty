import { signInWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';

import { encryptText, isEncrypted, safeDecryptText } from '@/lib/encryption';
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

interface RegisterCustomerData {
  customerName: string;
  customerMobile: string;
  customerPassword: string;
  gender: string;
  dateOfBirth: string;
  storeLocation: string;
  referredBy: string | null;
  isStudent: boolean;
  demoStore: boolean;
  tpin: string;
}

export const registerCustomer = async (data: RegisterCustomerData): Promise<CustomerType> => {
  try {
    const customersRef = collection(db, 'Customers');
    
    // Check if customer already exists
    const q = query(customersRef, where('customerMobile', '==', data.customerMobile));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error('Customer with this mobile number already exists');
    }

    // Encrypt password
    const encryptedPassword = encryptText(data.customerPassword);

    // Generate Referral Code (e.g., A1B2C)
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
      let result = '';
      for (let i = 0; i < 6; i++) { // Increased length slightly for uniqueness since prefix is gone
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Ensure uniqueness (simple retry)
    let uniqueCode = generateCode();
    // Ideally we check DB for collision, but probability is low for now. 
    // TODO: Add collision check loop if scaling.

    let realReferredByMobile: string | null = null;

    if (data.referredBy) {
         // Check if it's a code
         const qCode = query(customersRef, where('referralCode', '==', data.referredBy.trim()));
         const snapshotCode = await getDocs(qCode);
         
         if (!snapshotCode.empty) {
             const referrerData = snapshotCode.docs[0].data() as CustomerType;
             realReferredByMobile = referrerData.customerMobile;
         } else {
             // Fallback: Check if it's a mobile number (Legacy support during transition)
             const qMobile = query(customersRef, where('customerMobile', '==', data.referredBy.trim()));
             const snapshotMobile = await getDocs(qMobile);
             if (!snapshotMobile.empty) {
                 realReferredByMobile = data.referredBy.trim();
             }
         }
    }

    const newCustomer: CustomerType = {
      role: 'customer',
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      customerPassword: encryptedPassword,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      isStudent: data.isStudent,
      storeLocation: data.storeLocation,
      demoStore: data.demoStore,
      referredBy: realReferredByMobile, // Store Verified Mobile here for logic continuity
      referralCode: uniqueCode,         // Store New Code
      referredUsers: null,
      
      // Defaults
      createdAt: Timestamp.now(),
      joinedDate: Timestamp.now(),
      
      tpin: data.tpin,
      
      walletRechargeDone: false,
      saleElgibility: true,
      
      walletId: `WAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      walletBalance: 0,
      walletBalanceCurrentMonth: 0,
      
      surabhiBalance: 0,
      surabhiCredit: 0,
      surabhiDebit: 0,
      surabhiReferral: 0,
      surabhiBalanceCurrentMonth: 0,
      
      sevaBalance: 0,
      sevaCredit: 0,
      sevaDebit: 0,
      sevaTotal: 0,
      sevaBalanceCurrentMonth: 0,
      
      coinsFrozen: false,
      
      lastTransactionDate: null,
      lastQuarterCheck: null,
      currentQuarterStart: Timestamp.now(),
      
      cumTotal: 0,
      surbhiTotal: 0,
      
      quartersPast: 0,
      cummulativeTarget: data.isStudent ? 500 : 1000, 
      targetMet: false
    };

    const docRef = await addDoc(customersRef, newCustomer);
    
    return {
      ...newCustomer,
      id: docRef.id
    };

  } catch (error: any) {
    // console.error('Error registering customer:', error);
    throw new Error(error.message || 'Failed to register customer');
  }
};
