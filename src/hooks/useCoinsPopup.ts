import { useAuth } from '@/hooks/auth-context';
import { useEffect, useState } from 'react';

export const useCoinsPopup = () => {
  const { user, isInitialized } = useAuth();

  const [showPopup, setShowPopup] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);

  useEffect(() => {
    if (!isInitialized || !user) return;

    if (user.role !== 'customer') return;

    const alreadyShown = sessionStorage.getItem('coinsPopupShown');

    if (alreadyShown) return;

    const spent = Number(user.cumTotal || 0);
    const target = Number(user.cummulativeTarget || 0);

    if (spent < target) {
      setCustomerData(user);

      // Small delay ensures popup appears after auth hydration/navigation
      setTimeout(() => {
        setShowPopup(true);
      }, 500);

      sessionStorage.setItem('coinsPopupShown', 'true');
    }
  }, [user, isInitialized]);

  return {
    showPopup,
    customerData,
    closePopup: () => setShowPopup(false),
  };
};