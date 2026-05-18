import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';

export interface GlobalSettings {
  allowReferralsWithoutPurchase: boolean;
  pauseOrders?: boolean;
  pauseMessage?: string;
}

const defaultSettings: GlobalSettings = {
  allowReferralsWithoutPurchase: false,
  pauseOrders: false,
  pauseMessage: 'We are currently not accepting new orders. Please check back later.',
};

export const useGlobalSettings = () => {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(
      docRef,
      docSnap => {
        if (docSnap.exists()) {
          setSettings({ ...defaultSettings, ...docSnap.data() });
        } else {
          setSettings(defaultSettings);
        }
        setIsLoading(false);
      },
      error => {
        console.error('Error fetching global settings:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { settings, isLoading };
};
