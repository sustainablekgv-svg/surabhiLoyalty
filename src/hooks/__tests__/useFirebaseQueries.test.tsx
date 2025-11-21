import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

import {
  QUERY_KEYS,
  queryKeys,
  useAccountTransactions,
  useActiveStores,
  useCustomerByMobile,
  useCustomers,
  useInvalidateQueries,
  useRechargeTransactions,
  useReferredCustomers,
  useSevaPool,
  useStaffByMobile,
  useStoreByName,
  useStores,
  useTransactions,
} from '../useFirebaseQueries';

import { cacheUtils } from '@/utils/memoryCache';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2024-01-01') })),
  },
}));

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

// Mock cache utils
jest.mock('@/utils/memoryCache', () => ({
  cacheUtils: {
    getActiveStores: jest.fn(),
    setActiveStores: jest.fn(),
    getCustomerByMobile: jest.fn(),
    setCustomerByMobile: jest.fn(),
  },
}));

// Mock types
jest.mock('@/types/types', () => ({
  CustomerTxType: {},
  CustomerType: {},
  SevaPoolType: {},
  StaffType: {},
  StoreType: {},
}));

const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} = require('firebase/firestore');

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock data
const mockStores = [
  {
    id: '1',
    storeName: 'Store 1',
    storeStatus: 'active',
    demoStore: false,
    storeCreatedAt: new Date(),
    storeUpdatedAt: new Date(),
    walletEnabled: true,
  },
  {
    id: '2',
    storeName: 'Store 2',
    storeStatus: 'inactive',
    demoStore: true,
    storeCreatedAt: new Date(),
    storeUpdatedAt: new Date(),
    walletEnabled: false,
  },
];

const mockCustomers = [
  {
    id: '1',
    customerMobile: '1234567890',
    storeLocation: 'Store 1',
    cumTotal: 1000,
    joinedDate: Timestamp.now(),
    coinsFrozen: false,
  },
];

const mockTransactions = [
  {
    id: '1',
    amount: 100,
    type: 'purchase',
    createdAt: Timestamp.now(),
  },
];

const mockStaff = {
  id: '1',
  staffMobile: '9876543210',
  role: 'admin',
  name: 'John Doe',
};

const mockSevaPool = {
  currentSevaBalance: 5000,
  totalContributions: 10000,
  totalAllocations: 5000,
  contributionsCurrentMonth: 1000,
  allocationsCurrentMonth: 500,
  lastResetDate: Timestamp.now(),
  lastAllocatedDate: Timestamp.now(),
};

describe('useFirebaseQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queryKeys', () => {
    it('should have correct query key structures', () => {
      expect(queryKeys.stores).toEqual(['stores']);
      expect(queryKeys.activeStores).toEqual(['stores', 'active']);
      expect(queryKeys.customers).toEqual(['customers']);
      expect(queryKeys.transactions).toEqual(['transactions']);
      expect(queryKeys.storeStats('Store1')).toEqual(['storeStats', 'Store1']);
      expect(queryKeys.customerByMobile('1234567890')).toEqual(['customer', '1234567890']);
      expect(queryKeys.referredCustomers('1234567890')).toEqual([
        'referredCustomers',
        '1234567890',
      ]);
    });
  });

  describe('QUERY_KEYS (legacy)', () => {
    it('should have correct legacy query keys', () => {
      expect(QUERY_KEYS.STORES).toBe('stores');
      expect(QUERY_KEYS.CUSTOMERS).toBe('customers');
      expect(QUERY_KEYS.TRANSACTIONS).toBe('transactions');
      expect(QUERY_KEYS.RECHARGES).toBe('recharges');
      expect(QUERY_KEYS.STAFF).toBe('staff');
      expect(QUERY_KEYS.SEVA_POOL).toBe('sevaPool');
      expect(QUERY_KEYS.CUSTOMER_BY_MOBILE).toBe('customerByMobile');
      expect(QUERY_KEYS.STORE_BY_NAME).toBe('storeByName');
    });
  });

  describe('useStores', () => {
    it('should fetch stores from cache when available', async () => {
      (cacheUtils.getActiveStores as jest.Mock).mockReturnValue(mockStores);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStores(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStores);
      expect(cacheUtils.getActiveStores).toHaveBeenCalled();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should fetch stores from Firebase when cache is empty', async () => {
      (cacheUtils.getActiveStores as jest.Mock).mockReturnValue(null);
      const mockSnapshot = {
        docs: mockStores.map(store => ({
          id: store.id,
          data: () => ({
            ...store,
            storeCreatedAt: { toDate: () => store.storeCreatedAt },
            storeUpdatedAt: { toDate: () => store.storeUpdatedAt },
          }),
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStores(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collection).toHaveBeenCalledWith({}, 'stores');
      expect(getDocs).toHaveBeenCalled();
      expect(cacheUtils.setActiveStores).toHaveBeenCalled();
    });
  });

  describe('useActiveStores', () => {
    it('should filter active stores from cache', async () => {
      (cacheUtils.getActiveStores as jest.Mock).mockReturnValue(mockStores);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useActiveStores(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const activeStores = mockStores.filter(
        store => store.storeStatus === 'active' && !store.demoStore
      );
      expect(result.current.data).toEqual(activeStores);
    });

    it('should fetch and filter active stores from Firebase when cache is empty', async () => {
      (cacheUtils.getActiveStores as jest.Mock).mockReturnValue(null);
      const mockSnapshot = {
        docs: mockStores.map(store => ({
          id: store.id,
          data: () => ({
            ...store,
            storeCreatedAt: { toDate: () => store.storeCreatedAt },
            storeUpdatedAt: { toDate: () => store.storeUpdatedAt },
          }),
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useActiveStores(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const activeStores = mockStores.filter(
        store => store.storeStatus === 'active' && !store.demoStore
      );
      expect(result.current.data).toEqual(activeStores);
      expect(cacheUtils.setActiveStores).toHaveBeenCalledWith(mockStores);
    });
  });

  describe('useCustomers', () => {
    it('should fetch all customers when no filters provided', async () => {
      const mockSnapshot = {
        docs: mockCustomers.map(customer => ({
          id: customer.id,
          data: () => customer,
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomers(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collection).toHaveBeenCalledWith({}, 'Customers');
      expect(result.current.data).toEqual(
        mockCustomers.map(c => ({
          ...c,
          cumTotal: c.cumTotal || 0,
          coinsFrozen: c.coinsFrozen || false,
        }))
      );
    });

    it('should filter customers by store location', async () => {
      const mockSnapshot = {
        docs: mockCustomers.map(customer => ({
          id: customer.id,
          data: () => customer,
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomers('Store 1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('storeLocation', '==', 'Store 1');
    });
  });

  describe('useTransactions', () => {
    it('should fetch transactions with amount > 0 ordered by createdAt desc', async () => {
      const mockSnapshot = {
        docs: mockTransactions.map(tx => ({
          id: tx.id,
          data: () => tx,
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (orderBy as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collection).toHaveBeenCalledWith({}, 'CustomerTx');
      expect(where).toHaveBeenCalledWith('amount', '>', 0);
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  describe('useRechargeTransactions', () => {
    it('should fetch recharge transactions ordered by createdAt desc', async () => {
      const mockSnapshot = {
        docs: mockTransactions.map(tx => ({
          id: tx.id,
          data: () => ({ ...tx, type: 'recharge' }),
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (orderBy as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRechargeTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('type', '==', 'recharge');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  describe('useStoreByName', () => {
    it('should fetch store by name', async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: '1',
            data: () => ({
              ...mockStores[0],
              storeCreatedAt: { toDate: () => mockStores[0].storeCreatedAt },
              storeUpdatedAt: { toDate: () => mockStores[0].storeUpdatedAt },
            }),
          },
        ],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStoreByName('Store 1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('storeName', '==', 'Store 1');
      expect(result.current.data).toEqual({
        id: '1',
        ...mockStores[0],
        storeCreatedAt: mockStores[0].storeCreatedAt,
        storeUpdatedAt: mockStores[0].storeUpdatedAt,
        walletEnabled: mockStores[0].walletEnabled,
      });
    });

    it('should return null when store not found', async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStoreByName('Nonexistent Store'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('should be disabled when storeName is empty', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useStoreByName(''), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useStaffByMobile', () => {
    it('should fetch staff by mobile', async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: '1',
            data: () => mockStaff,
          },
        ],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStaffByMobile('9876543210'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('staffMobile', '==', '9876543210');
      expect(result.current.data).toEqual({ id: '1', ...mockStaff });
    });

    it('should fetch staff by mobile and role', async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: '1',
            data: () => mockStaff,
          },
        ],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStaffByMobile('9876543210', 'admin'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('staffMobile', '==', '9876543210');
      expect(where).toHaveBeenCalledWith('role', '==', 'admin');
    });

    it('should return null when staff not found', async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useStaffByMobile('0000000000'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('useSevaPool', () => {
    it('should fetch seva pool data', async () => {
      const mockTimestamp = Timestamp.now();
      const mockSnapshot = {
        exists: () => true,
        data: () => ({
          currentSevaBalance: 5000,
          totalContributions: 10000,
          totalAllocations: 5000,
          contributionsCurrentMonth: 1000,
          allocationsCurrentMonth: 500,
          lastResetDate: mockTimestamp,
          lastAllocatedDate: mockTimestamp,
        }),
      };
      (getDoc as jest.Mock).mockResolvedValue(mockSnapshot);
      (doc as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSevaPool(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(doc).toHaveBeenCalledWith({}, 'SevaPool', 'main');
      expect(result.current.data).toEqual({
        currentSevaBalance: 5000,
        totalContributions: 10000,
        totalAllocations: 5000,
        contributionsCurrentMonth: 1000,
        allocationsCurrentMonth: 500,
        lastResetDate: mockTimestamp,
        lastAllocatedDate: mockTimestamp,
      });
    });

    it('should return null when seva pool document does not exist', async () => {
      const mockSnapshot = {
        exists: () => false,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockSnapshot);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSevaPool(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('useCustomerByMobile', () => {
    it('should fetch customer from cache when available', async () => {
      const mockCustomer = mockCustomers[0];
      (cacheUtils.getCustomerByMobile as jest.Mock).mockReturnValue(mockCustomer);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomerByMobile('1234567890'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockCustomer);
      expect(cacheUtils.getCustomerByMobile).toHaveBeenCalledWith('1234567890');
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should fetch customer from Firebase when cache is empty', async () => {
      (cacheUtils.getCustomerByMobile as jest.Mock).mockReturnValue(null);
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: '1',
            data: () => mockCustomers[0],
          },
        ],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomerByMobile('1234567890'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('customerMobile', '==', '1234567890');
      expect(cacheUtils.setCustomerByMobile).toHaveBeenCalledWith('1234567890', {
        id: '1',
        ...mockCustomers[0],
      });
    });

    it('should return null when customer not found', async () => {
      (cacheUtils.getCustomerByMobile as jest.Mock).mockReturnValue(null);
      const mockSnapshot = {
        empty: true,
        docs: [],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomerByMobile('0000000000'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('should be disabled when enabled is false', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomerByMobile('1234567890', false), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should be disabled when mobile is empty', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCustomerByMobile(''), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useAccountTransactions', () => {
    it('should fetch account transactions ordered by createdAt desc', async () => {
      const mockSnapshot = {
        docs: mockTransactions.map(tx => ({
          id: tx.id,
          data: () => tx,
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (orderBy as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAccountTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collection).toHaveBeenCalledWith({}, 'AccountTx');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  describe('useReferredCustomers', () => {
    it('should fetch referred customers', async () => {
      const mockSnapshot = {
        docs: mockCustomers.map(customer => ({
          id: customer.id,
          data: () => customer,
        })),
      };
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});

      const wrapper = createWrapper();
      const { result } = renderHook(() => useReferredCustomers('1234567890'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('referredBy', '==', '1234567890');
    });

    it('should be disabled when mobile is empty', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useReferredCustomers(''), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('should be disabled when enabled is false', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useReferredCustomers('1234567890', false), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useInvalidateQueries', () => {
    it('should provide invalidation functions', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useInvalidateQueries(), { wrapper });

      expect(typeof result.current.invalidateStores).toBe('function');
      expect(typeof result.current.invalidateCustomers).toBe('function');
      expect(typeof result.current.invalidateTransactions).toBe('function');
      expect(typeof result.current.invalidateActivities).toBe('function');
      expect(typeof result.current.invalidateStaff).toBe('function');
      expect(typeof result.current.invalidateAccountTx).toBe('function');
      expect(typeof result.current.invalidateSevaPool).toBe('function');
      expect(typeof result.current.invalidateCustomerByMobile).toBe('function');
      expect(typeof result.current.invalidateReferredCustomers).toBe('function');
      expect(typeof result.current.invalidateAll).toBe('function');
    });
  });
});
