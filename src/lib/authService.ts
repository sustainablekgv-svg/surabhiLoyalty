import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  type User as FirebaseAuthUser,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { encryptText, isEncrypted, safeDecryptText } from '@/lib/encryption';
import { auth, db, functions } from '@/lib/firebase';
import { storageUtils } from '@/lib/storage';
import { CustomerType, StaffType, User } from '@/types/types';

const callSyncFirebaseAuthForUpload = httpsCallable<
  { mobile: string; password: string; appRole: 'admin' | 'staff' | 'customer' },
  { success: boolean }
>(functions, 'syncFirebaseAuthForUpload');

const callLoginWithCredentials = httpsCallable<
  { mobile: string; password: string; role: 'customer' | 'staff' | 'admin' },
  { customToken: string; user: User }
>(functions, 'loginWithCredentials');

const callRegisterCustomerAccount = httpsCallable<
  RegisterCustomerData,
  { success: boolean; customToken: string; user: CustomerType }
>(functions, 'registerCustomerAccount');

const callValidateReferralCode = httpsCallable<
  { codeOrPhone: string },
  { valid: boolean; customerName?: string; eligible?: boolean }
>(functions, 'validateReferralCode');

const callVerifyCustomerTpin = httpsCallable<
  { customerId: string; tpin: string },
  { valid: boolean }
>(functions, 'verifyCustomerTpin');

export const verifyCustomerTpin = async (customerId: string, tpin: string): Promise<boolean> => {
  const result = await callVerifyCustomerTpin({ customerId, tpin });
  return result.data.valid === true;
};

export const validateReferralCode = async (codeOrPhone: string) => {
  try {
    const res = await callValidateReferralCode({ codeOrPhone });
    return res.data;
  } catch {
    return { valid: false };
  }
};

export const getCustomerByMobile = async (
  mobile: string,
  password: string
): Promise<User | null> => {
  try {
    const res = await callLoginWithCredentials({
      mobile,
      password,
      role: 'customer',
    });
    if (res.data?.customToken) {
      await signInWithCustomToken(auth, res.data.customToken);
    }
    return res.data?.user || null;
  } catch (error: any) {
    const msg = error?.message || error?.details?.message || 'Invalid mobile number or credentials';
    throw new Error(msg);
  }
};

export const getStaffByMobile = async (
  mobile: string,
  password: string,
  role: 'admin' | 'staff'
): Promise<User | null> => {
  try {
    const res = await callLoginWithCredentials({
      mobile,
      password,
      role,
    });
    if (res.data?.customToken) {
      await signInWithCustomToken(auth, res.data.customToken);
    }
    return res.data?.user || null;
  } catch (error: any) {
    const msg = error?.message || error?.details?.message || 'Invalid mobile number or credentials';
    throw new Error(msg);
  }
};

export const verifyUserExists = async (user: User): Promise<boolean> => {
  try {
    if (auth.currentUser) {
      const tokenResult = await auth.currentUser.getIdTokenResult();
      return !!tokenResult?.claims?.role;
    }
    return false;
  } catch (error) {
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

const isValidEmail = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

/** Resolves stored credentials to the password used for Firebase Auth (encrypted or legacy plain). */
const resolveStoredPasswordForFirebase = (encryptedOrPlain: string | undefined): string | null => {
  if (!encryptedOrPlain) return null;
  if (isEncrypted(encryptedOrPlain)) {
    return safeDecryptText(encryptedOrPlain);
  }
  return encryptedOrPlain;
};

/**
 * Ensures Firebase Auth has a current user — required for callable Functions (e.g. R2 signed URLs).
 * Login may have skipped a real Firebase session when tolerateFailure was true; this retries with a firm sign-in.
 */
export const getFirebaseUserForFunctions = async (): Promise<FirebaseAuthUser> => {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const storedUser = storageUtils.getUser() as User | null;
  if (!storedUser) {
    throw new Error(
      'Your session has expired or you are not logged in. Please refresh the page and log in again to proceed.'
    );
  }

  const mobile =
    storedUser.role === 'customer'
      ? (storedUser as CustomerType).customerMobile
      : (storedUser as StaffType).staffMobile;

  // FALLBACK: If real email is missing, use a virtual email for Firebase Auth based on mobile
  const rawEmail =
    storedUser.role === 'customer'
      ? (storedUser as CustomerType).customerEmail
      : (storedUser as StaffType).staffEmail;

  const normalizedEmail = rawEmail?.trim() || `${mobile}@sustainablekgv.com`;

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new Error(
      'A valid email or mobile number is required for payments. Please contact support.'
    );
  }

  const encryptedPassword =
    storedUser.role === 'customer'
      ? (storedUser as CustomerType).customerPassword
      : (storedUser as StaffType).staffPassword;

  const password = resolveStoredPasswordForFirebase(encryptedPassword);
  if (!password || password.length < 6) {
    throw new Error(
      'Could not restore your secure session for payment. Please log out and log back in.'
    );
  }

  const appRole = storedUser.role as 'admin' | 'staff' | 'customer';

  const trySignIn = () =>
    ensureFirebaseAuth(normalizedEmail, password, {
      allowCreate: storedUser.role !== 'customer',
      tolerateFailure: false,
    });

  try {
    await trySignIn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : '';
    const syncThenSignIn =
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      msg.includes('Firebase Auth user exists but login failed');

    if (syncThenSignIn) {
      await callSyncFirebaseAuthForUpload({ mobile, password, appRole });
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } else {
      throw err;
    }
  }

  if (!auth.currentUser) {
    throw new Error(
      'Firebase sign-in did not complete. If this persists, contact support.'
    );
  }

  return auth.currentUser;
};

export const ensureFirebaseAuth = async (
  email: string,
  password: string,
  options: { allowCreate?: boolean; tolerateFailure?: boolean } = {}
): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    const code = error?.code as string | undefined;

    // Only try to create if the user definitely doesn't exist
    const shouldTryCreate = options.allowCreate && code === 'auth/user-not-found';

    if (shouldTryCreate) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        return;
      } catch (createError: any) {
        console.error('Error creating Firebase user:', createError);

        // If creating failed because user exists (race condition or confusion), tolerate it if requested
        if (createError?.code === 'auth/email-already-in-use') {
           if (options.tolerateFailure) {
               console.warn('Bypassing user creation error (email-already-in-use) as tolerateFailure is true.');
               return;
           }
           throw new Error(
            'Firebase Auth user exists but login failed. Password mismatch suspected.'
           );
        }
        if (options.tolerateFailure) {
          console.warn(`[ensureFirebaseAuth] tolerated user-create failure (${createError?.code || 'unknown'}); proceeding without Firebase Auth session.`);
          return;
        }
        throw createError;
      }
    }

    // Caller (e.g. LoginPage) has already verified the password against the
    // Firestore-stored encrypted credential; an out-of-sync / missing /
    // network-failed Firebase Auth login should NEVER block app login.
    // It only means callable Cloud Functions (image upload etc.) won't work
    // until Auth is synced. So when tolerateFailure is true we swallow
    // *every* error, not just the three password codes.
    if (options.tolerateFailure) {
      console.warn(`[ensureFirebaseAuth] tolerated Firebase Auth error (${code || 'unknown'}); proceeding with Firestore-validated session.`);
      return;
    }

    throw error;
  }
};

interface RegisterCustomerData {
  customerName: string;
  customerMobile: string;
  customerPassword: string;
  gender: string;
  dateOfBirth?: string;
  storeLocation: string;
  referredBy?: string | null;
  isStudent: boolean;
  demoStore: boolean;
  tpin?: string;
}

export const registerCustomer = async (data: RegisterCustomerData): Promise<CustomerType> => {
  try {
    const res = await callRegisterCustomerAccount(data);
    if (res.data?.customToken) {
      try {
        await signInWithCustomToken(auth, res.data.customToken);
      } catch (authErr) {
        console.warn('Custom token sign-in notice on register:', authErr);
      }
    }
    return res.data.user;
  } catch (error: any) {
    const msg = error?.message || error?.details?.message || 'Failed to register customer';
    throw new Error(msg);
  }
};
