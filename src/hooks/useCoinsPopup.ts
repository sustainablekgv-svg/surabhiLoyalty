import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const useCoinsPopup = () => {
  const { user, isInitialized } = useAuth();

  const [showPopup, setShowPopup] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);

  useEffect(() => {
  console.log('HOOK START');

  if (!isInitialized || !user) {
    console.log('Not initialized or no user');
    return;
  }

  console.log('USER:', user);

  if (user.role !== 'customer') {
    console.log('Not a customer');
    return;
  }

  const alreadyShown = sessionStorage.getItem('coinsPopupShown');
  console.log('alreadyShown:', alreadyShown);

  if (alreadyShown) return;

  const fetchCustomer = async () => {
    try {
      console.log('Fetching customer for:', user.customerMobile);

      const ref = doc(db, 'Customers', user.id);
      const snap = await getDoc(ref);

      console.log('Doc exists:', snap.exists());

      if (!snap.exists()) return;

      const data = snap.data();
      console.log('Customer Data:', data);

      const spent = data?.cumTotal || 0;
      const target = data?.cummulativeTarget || 0;

      console.log('FINAL CHECK:', { spent, target });

      if (spent < target) {
        console.log('SHOWING POPUP ✅');
        setCustomerData(data);
        setShowPopup(true);
        sessionStorage.setItem('coinsPopupShown', 'true');
      } else {
        console.log('Condition failed ❌');
      }
    } catch (err) {
      console.error('Popup error:', err);
    }
  };

  fetchCustomer();
}, [user, isInitialized]);

  return {
    showPopup,
    customerData,
    closePopup: () => setShowPopup(false),
  };
};