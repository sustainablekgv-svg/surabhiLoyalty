import { User } from '@/lib/authService';
import { Timestamp } from 'firebase/firestore';
export interface CustomerType {
  id?: string;
  role: string;
  customerName: string;
  gender: string;
  isStudent: boolean;
  customerMobile: string;
  customerEmail: string;
  storeLocation: string;
  demoStore: boolean;
  district?: string;
  city?: string;
  referredBy: string | null;
  referredUsers: { customerMobile: string; customerName: string; createdAt: Timestamp }[] | null;
  customerPassword: string;
  tpin: string;
  createdAt: Timestamp;
  walletRechargeDone: boolean;
  saleElgibility: boolean;
  walletId: string;
  walletBalance: number;
  // walletCredit: number;
  // walletDebit: number;
  walletBalanceCurrentMonth: number;
  surabhiBalance: number;
  surabhiCredit: number;
  surabhiDebit: number;
  surabhiReferral: number;
  surabhiBalanceCurrentMonth: number;
  sevaBalance: number;
  sevaCredit: number;
  sevaDebit: number;
  sevaTotal: number;
  sevaBalanceCurrentMonth: number;
  lastTransactionDate: Timestamp | null;
  quarterlyPurchaseTotal: number;
  lastQuarterCheck: Timestamp | null;
  coinsFrozen: boolean;
  currentQuarterStart: Timestamp | null;
  cumTotal: number;
  joinedDate: Timestamp;
  quarterlyTarget: number;
  targetMet: boolean;
  carriedForwardTarget: number;
}

export interface StaffHeaderProps {
  user: {
    id: string;
    name?: string;
    mobile: string;
    role: string;
    storeLocation?: string;
  };
  onLogout: () => void;
}

export interface StaffStatsProps {
  storeLocation: string;
  demoStore: boolean;
}

export interface TransactionsPageProps {
  storeLocation: string;
  demoStore: boolean;
}

export interface UserRegistrationProps {
  storeLocation: string;
  demoStore: boolean;
}

export interface WalletRechargeProps {
  storeLocation: string;
  demoStore: boolean;
}

// export interface CustomerTx {
//   id?: string;
//   customerName: string;
//   customerMobile: string;
//   remarks: string;
//   createdAt: Timestamp;
//   storeLocation: string;
//   walletCredit: number;
//   walletDebit: number;
//   walletBalance: number;
//   surabhiDebit: number;
//   surabhiCredit: number;
//   surabhiBalance: number;
//   sevaCredit: number;
//   sevaDebit: number;
//   sevaBalance: number;
//   sevaTotal: number;
// }

export interface AuthContextType {
  user: User | null;
  login: (mobile: string, password: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

export interface SalesManagementProps {
  storeLocation: string;
  demoStore: boolean;
}

export interface StoreUsersProps {
  storeLocation: string;
  demoStore: boolean;
}

export interface StaffType {
  id?: string;
  staffName: string;
  staffMobile: string;
  staffEmail: string;
  demoStore: boolean;
  storeLocation: string;
  staffPassword: string;
  role: 'admin' | 'staff';
  createdAt: Timestamp;
  staffStatus: 'active' | 'inactive';
  staffSalesCount: number;
  staffPin: string;
  staffRechargesCount: number;
  lastActive?: Timestamp;
}

export interface StorePerformance {
  storeName: string;
  transactions: number;
  sales: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
  lastUpdated?: Timestamp;
}

export interface StoreType {
  id: string;
  storeName: string;
  storeLocation: string;
  storeAddress: string;
  storePrefix: string; // Unique 3-4 digit prefix for invoice ID generation
  referralCommission: number;
  surabhiCommission: number;
  sevaCommission: number;
  cashOnlyCommission: number;
  storeContactNumber: string;
  storeStatus: 'active' | 'inactive';
  storeCurrentBalance: number;
  storeSevaBalance: number;
  storeCreatedAt: Timestamp;
  storeUpdatedAt: Timestamp;
  adminCurrentBalance: number;
  adminStoreProfit: number;
  walletEnabled: boolean;
  demoStore: boolean; // Demo stores for client demonstrations, excluded from KPIs
}

export interface AdminHeaderProps {
  user: StaffType;
  onLogout: () => void;
}

export interface CustomerTxType {
  id?: string;
  type: 'recharge' | 'sale' | 'referral';
  invoiceId?: string; // Optional invoice ID field
  // staffName: string; // Used in recharge
  // Common Fields
  customerMobile: string;
  customerName: string;
  storeLocation: string;
  storeName: string; // Only for recharge
  createdAt: Timestamp;
  demoStore: boolean; // Indicates if transaction is from a demo store
  paymentMethod?: 'cash' | 'wallet' | 'mixed' | 'admin';
  processedBy: string; // Used in sale
  remarks: string; // Description of the transaction

  // Recharge-Specific Fields
  amount: number;
  surabhiEarned: number;
  sevaEarned?: number;
  referralEarned?: number;
  referredBy?: string | null;
  adminProft?: number;

  // Sale-Specific Fields
  surabhiUsed?: number;
  walletDeduction?: number;
  cashPayment?: number;

  previousBalance?: {
    walletBalance: number;
    surabhiBalance: number;
  };

  newBalance?: {
    walletBalance: number;
    surabhiBalance: number;
  };

  walletCredit: number;
  walletDebit: number;
  walletBalance: number;
  surabhiDebit: number;
  surabhiCredit: number;
  surabhiBalance: number;
  sevaCredit: number;
  sevaDebit: number;
  sevaBalance: number;
  sevaTotal: number;
  storeSevaBalance: number;
}

// export interface SevaTransaction {
//   type: 'contribution' | 'allocation';
//   amount: number;
//   description: string;
//   date: Timestamp;
//   customerMobile?: string;
//   customerName?: string;
//   monthYear: string; // Format: "YYYY-MM"
//   storeLocation?: string;
// }

export interface SevaPoolType {
  currentSevaBalance: number;
  totalContributions: number;
  totalAllocations: number;
  contributionsCurrentMonth: number;
  allocationsCurrentMonth: number;
  lastResetDate: Timestamp;
  lastAllocatedDate: Timestamp;
  // currentMonth: number; // 1-12
  // currentYear: number;
}

export interface ActivityType {
  id?: string;
  type:
    | 'signup'
    | 'sale'
    | 'recharge'
    | 'referral'
    | 'seva_contribution'
    | 'seva_allocation'
    | 'surabhi_earn';
  remarks: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  storeLocation: string;
  createdAt: Timestamp;
  demoStore: boolean;
}

export interface AccountTxType {
  id: string;
  invoiceId?: string;
  createdAt: Timestamp;
  storeName: string;
  customerName: string;
  customerMobile: string;
  type: 'recharge' | 'sale' | 'settlement';
  amount: number;
  debit: number;
  adminCut: number;
  adminProfit: number;
  credit: number;
  currentBalance: number;
  sevaBalance: number;
  adminCurrentBalance: number;
  remarks: string;
  demoStore: boolean; // Indicates if transaction is from a demo store
}

// export interface StoreSummary {
//   storeName: string;
//   currentBalance: number;
// }

export interface StoreAccountsProps {
  storeLocation: string;
}

// export interface AdminDeck {
//   totalBalance: number;
//   recentTransactions: AccountTx[];
//   shopsSummary: StoreSummary[];
//   walletOverview: {
//     totalCredits: number;
//     totalDebits: number;
//     netFlow: number;
//   };
// }
