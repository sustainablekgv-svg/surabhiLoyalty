import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { CustomerType } from '@/types/types';

/**
 * Robustly look up a referrer customer by mobile number OR referral code.
 * Handles:
 * 1. 10-digit mobile number (with or without formatting / country codes like +91).
 * 2. Referral code (e.g. "REF-ABCDE" or "ABCDE", case-insensitive).
 * 3. Exact raw match against customerMobile as fallback.
 */
export const fetchReferrerCustomer = async (
  referredBy: string | null | undefined
): Promise<CustomerType | null> => {
  if (!referredBy || typeof referredBy !== 'string') return null;
  const raw = referredBy.trim();
  if (!raw) return null;

  try {
    const customersCollection = collection(db, 'Customers');

    // 1. Try matching 10-digit mobile number
    const cleanMobile = raw.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length === 10) {
      const q = query(customersCollection, where('customerMobile', '==', cleanMobile));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as CustomerType;
      }
    }

    // 2. Try matching referral code (e.g., REF-ABCDE or ABCDE)
    const upper = raw.toUpperCase();
    const searchCodes = upper.startsWith('REF-')
      ? [upper, upper.replace(/^REF-/, '')]
      : [upper, `REF-${upper}`];

    const codeQuery = query(customersCollection, where('referralCode', 'in', searchCodes));
    const codeSnap = await getDocs(codeQuery);
    if (!codeSnap.empty) {
      const docSnap = codeSnap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as CustomerType;
    }

    // 3. Fallback direct match on customerMobile with raw string
    const rawQuery = query(customersCollection, where('customerMobile', '==', raw));
    const rawSnap = await getDocs(rawQuery);
    if (!rawSnap.empty) {
      const docSnap = rawSnap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as CustomerType;
    }

    return null;
  } catch (error) {
    console.error('Error fetching referrer customer:', error);
    return null;
  }
};
