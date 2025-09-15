import { db } from '@/lib/firebase';
import { CustomerTxType, CustomerType, SevaPoolType, StaffType, StoreType } from '@/types/types';
import { cacheUtils } from '@/utils/memoryCache';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

// Query keys for consistent cache management
export const queryKeys = {
  stores: ['stores'] as const,
  activeStores: ['stores', 'active'] as const,
  customers: ['customers'] as const,
  transactions: ['transactions'] as const,
  recharges: ['recharges'] as const,
  activities: ['activities'] as const,
  staff: ['staff'] as const,
  accountTx: ['accountTx'] as const,
  salesTransactions: ['salesTransactions'] as const,
  sevaPool: ['sevaPool'] as const,
  storeStats: (storeLocation: string) => ['storeStats', storeLocation] as const,
  customerByMobile: (mobile: string) => ['customer', mobile] as const,
  referredCustomers: (mobile: string) => ['referredCustomers', mobile] as const,
};

// Legacy query keys for backward compatibility
export const QUERY_KEYS = {
  STORES: 'stores',
  CUSTOMERS: 'customers',
  TRANSACTIONS: 'transactions',
  RECHARGES: 'recharges',
  STAFF: 'staff',
  SEVA_POOL: 'sevaPool',
  CUSTOMER_BY_MOBILE: 'customerByMobile',
  STORE_BY_NAME: 'storeByName',
} as const;

// Cache configuration
const CACHE_CONFIG = {
  // Static data that rarely changes
  STORES: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  // Dynamic data that changes frequently
  TRANSACTIONS: {
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
  // User data
  CUSTOMERS: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
  },
};

// Hook for fetching all stores with memory caching
export const useStores = () => {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: async (): Promise<StoreType[]> => {
      // Check memory cache first
      const cached = cacheUtils.getActiveStores();
      if (cached) {
        return cached as StoreType[];
      }

      // Fetch from Firebase if not in cache
      const storesRef = collection(db, 'stores');
      const snapshot = await getDocs(storesRef);
      const stores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
        storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
        walletEnabled: doc.data().walletEnabled || false,
      })) as StoreType[];

      // Cache the result
      cacheUtils.setActiveStores(stores);
      return stores;
    },
    staleTime: CACHE_CONFIG.STORES.staleTime,
    gcTime: CACHE_CONFIG.STORES.cacheTime,
  });
};

// Hook for fetching active stores only with memory caching
export const useActiveStores = () => {
  return useQuery({
    queryKey: queryKeys.activeStores,
    queryFn: async (): Promise<StoreType[]> => {
      // Check memory cache first
      const cached = cacheUtils.getActiveStores();
      if (cached) {
        return (cached as StoreType[]).filter(
          store => store.storeStatus === 'active' && !store.demoStore
        );
      }

      // Fetch from Firebase if not in cache
      const storesRef = collection(db, 'stores');
      const snapshot = await getDocs(storesRef);
      const stores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
        storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
        walletEnabled: doc.data().walletEnabled || false,
      })) as StoreType[];

      const activeStores = stores.filter(
        store => store.storeStatus === 'active' && !store.demoStore
      );

      // Cache the result
      cacheUtils.setActiveStores(stores);
      return activeStores;
    },
    staleTime: CACHE_CONFIG.STORES.staleTime,
    gcTime: CACHE_CONFIG.STORES.cacheTime,
  });
};

// Hook for fetching customers
export const useCustomers = (storeLocation?: string, demoStore?: boolean) => {
  return useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS, storeLocation, demoStore],
    queryFn: async (): Promise<CustomerType[]> => {
      const customersRef = collection(db, 'Customers');
      let q = query(customersRef);

      if (storeLocation) {
        q = query(customersRef, where('storeLocation', '==', storeLocation));
      }

      // if (demoStore !== undefined) {
      //   q = query(customersRef, where('demoStore', '==', demoStore));
      // }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          quarterlyTarget: data.quarterlyTarget || 0,
          carriedForwardTarget: data.carriedForwardTarget || 0,
          cumTotal: data.cumTotal || 0,
          joinedDate: data.joinedDate || data.createdAt || Timestamp.now(),
          targetMet: data.targetMet || false,
          coinsFrozen: data.coinsFrozen || false,
        } as CustomerType;
      });
    },
    staleTime: CACHE_CONFIG.CUSTOMERS.staleTime,
    gcTime: CACHE_CONFIG.CUSTOMERS.cacheTime,
    enabled: true, // Always enabled for admin dashboard
  });
};

// Hook for fetching transactions
export const useTransactions = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.TRANSACTIONS],
    queryFn: async (): Promise<CustomerTxType[]> => {
      const transactionsRef = collection(db, 'CustomerTx');
      const q = query(transactionsRef, where('amount', '>', 0), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || Timestamp.now(),
      })) as CustomerTxType[];
    },
    staleTime: CACHE_CONFIG.TRANSACTIONS.staleTime,
    gcTime: CACHE_CONFIG.TRANSACTIONS.cacheTime,
  });
};

// Hook for fetching recharge transactions
export const useRechargeTransactions = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.RECHARGES],
    queryFn: async (): Promise<CustomerTxType[]> => {
      const transactionsRef = collection(db, 'CustomerTx');
      const q = query(
        transactionsRef,
        where('type', '==', 'recharge'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || Timestamp.now(),
      })) as CustomerTxType[];
    },
    staleTime: CACHE_CONFIG.TRANSACTIONS.staleTime,
    gcTime: CACHE_CONFIG.TRANSACTIONS.cacheTime,
  });
};

// Hook for fetching store by name
export const useStoreByName = (storeName: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STORE_BY_NAME, storeName],
    queryFn: async (): Promise<StoreType | null> => {
      const storesRef = collection(db, 'stores');
      const q = query(storesRef, where('storeName', '==', storeName));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        storeCreatedAt: doc.data().storeCreatedAt?.toDate() || new Date(),
        storeUpdatedAt: doc.data().storeUpdatedAt?.toDate() || new Date(),
        walletEnabled: doc.data().walletEnabled || false,
      } as StoreType;
    },
    staleTime: CACHE_CONFIG.STORES.staleTime,
    gcTime: CACHE_CONFIG.STORES.cacheTime,
    enabled: !!storeName,
  });
};

// Hook for fetching staff by mobile and role
export const useStaffByMobile = (mobile: string, role?: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, mobile, role],
    queryFn: async (): Promise<StaffType | null> => {
      const staffRef = collection(db, 'staff');
      let q = query(staffRef, where('staffMobile', '==', mobile));

      if (role) {
        q = query(staffRef, where('staffMobile', '==', mobile), where('role', '==', role));
      }

      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as StaffType;
    },
    staleTime: CACHE_CONFIG.CUSTOMERS.staleTime,
    gcTime: CACHE_CONFIG.CUSTOMERS.cacheTime,
    enabled: !!mobile,
  });
};

// Hook for fetching Seva Pool data
export const useSevaPool = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.SEVA_POOL],
    queryFn: async (): Promise<SevaPoolType | null> => {
      const poolRef = doc(db, 'SevaPool', 'main');
      const poolSnapshot = await getDoc(poolRef);

      if (!poolSnapshot.exists()) return null;

      const data = poolSnapshot.data();
      return {
        currentSevaBalance: data.currentBalance ?? 0,
        totalContributions: data.totalContributions ?? 0,
        totalAllocations: data.totalAllocations ?? 0,
        contributionsCurrentMonth: data.contributionsCurrentMonth ?? 0,
        allocationsCurrentMonth: data.allocationsCurrentMonth ?? 0,
        lastResetDate: data.lastResetDate || Timestamp.now(),
        lastAllocatedDate: data.lastAllocatedDate || Timestamp.now(),
      } as SevaPoolType;
    },
    staleTime: CACHE_CONFIG.TRANSACTIONS.staleTime,
    gcTime: CACHE_CONFIG.TRANSACTIONS.cacheTime,
  });
};

// Hook for customer by mobile (for lookups) with memory caching
export const useCustomerByMobile = (mobile: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.customerByMobile(mobile),
    queryFn: async () => {
      if (!mobile) return null;

      // Check memory cache first
      const cached = cacheUtils.getCustomerByMobile(mobile);
      if (cached) {
        return cached;
      }

      // Fetch from Firebase if not in cache
      const q = query(collection(db, 'Customers'), where('customerMobile', '==', mobile));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;

      const doc = querySnapshot.docs[0];
      const customer = { id: doc.id, ...doc.data() } as CustomerType;

      // Cache the result
      cacheUtils.setCustomerByMobile(mobile, customer);
      return customer;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: enabled && !!mobile,
  });
};

// Hook for account transactions
export const useAccountTransactions = () => {
  return useQuery({
    queryKey: queryKeys.accountTx,
    queryFn: async () => {
      const txQuery = query(collection(db, 'AccountTx'), orderBy('createdAt', 'desc'));
      const txSnapshot = await getDocs(txQuery);
      return txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for referred customers
export const useReferredCustomers = (mobile: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.referredCustomers(mobile),
    queryFn: async () => {
      if (!mobile) return [];
      const referredCustomersQuery = query(
        collection(db, 'Customers'),
        where('referredBy', '==', mobile)
      );
      const referredCustomersSnapshot = await getDocs(referredCustomersQuery);
      return referredCustomersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && !!mobile,
  });
};

// Utility functions for cache invalidation
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  return {
    invalidateStores: () => queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
    invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
    invalidateTransactions: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    invalidateActivities: () => queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
    invalidateStaff: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff }),
    invalidateAccountTx: () => queryClient.invalidateQueries({ queryKey: queryKeys.accountTx }),
    invalidateSevaPool: () => queryClient.invalidateQueries({ queryKey: queryKeys.sevaPool }),
    invalidateCustomerByMobile: (mobile: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.customerByMobile(mobile) }),
    invalidateReferredCustomers: (mobile: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.referredCustomers(mobile) }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
};
