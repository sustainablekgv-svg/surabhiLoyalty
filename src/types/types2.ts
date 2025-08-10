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
  referredBy: string | null;
  referredUsers: { customerMobile: number; customerName: string; createdAt: Timestamp; }[] | null;
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
  surabhiReferral: number;
  surabhiBalanceCurrentMonth: number;
  sevaBalance: number;
  sevaBalanceCurrentMonth: number;
  sevaTotal: number;
  lastTransactionDate: Timestamp | null;
  quarterlyPurchaseTotal: number;
  lastQuarterCheck: Timestamp | null;
  coinsFrozen: boolean;
  currentQuarterStart: Timestamp | null;
}

export interface StaffHeaderProps {
  user: {
    name?: string;
    mobile: string;
    role: string;
    storeLocation?: string;
  };
  onLogout: () => void;
}

export interface StaffStatsProps {
  storeLocation: string;
}

export interface TransactionsPageProps {
  storeLocation: string;
}

export interface UserRegistrationProps {
  storeLocation: string;
}

export interface WalletRechargeProps {
  storeLocation: string;
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

export interface SalesManagementProps {
  storeLocation: string;
}

export interface StoreUsersProps {
  storeLocation: string;
}

export interface StaffType {
  id?: string;
  staffName: string;
  staffMobile: string;
  staffEmail: string;
  storeLocation: string;
  staffPassword: string;
  role: 'admin' | 'staff';
  staffCreatedAt: Timestamp;
  staffStatus: 'active' | 'inactive';
  staffSalesCount: number;
  staffRechargesCount: number;
  staffPin: string;
  staffLastActive?: Timestamp;
}

// export interface StorePerformance {
//   storeName: string;
//   transactions: number;
//   sales: number;
//   surabhiCoinsUsed: number;
//   walletDeduction: number;
//   cashPayment: number;
//   lastUpdated?: Timestamp;
// }

export interface StoreType {
  id: string;
  storeName: string;
  storeLocation: string;
  storeAddress: string;
  referralCommission: number;
  surabhiCommission: number;
  sevaCommission: number;
  cashOnlyCommission: number;
  storeContactNumber: string;
  storeStatus: 'active' | 'inactive';
  storeCurrentBalance: number;
  storeSevaBalance:number;
  storeCreatedAt: Timestamp;
  storeUpdatedAt: Timestamp;
}

export interface AdminHeaderProps {
  user: StaffType;
  onLogout: () => void;
}

export interface CustomerTxType {
  id?: string;
  type: 'recharge' | 'sale';

  // Common Fields
  customerMobile: string;
  customerName: string;
  storeLocation: string;
  storeName: string; // Only for recharge
  createdAt: Timestamp;
  paymentMethod?: 'cash' | 'wallet' | 'mixed';
  staffName: string; // Used in recharge
  processedBy: string; // Used in sale

  // Recharge-Specific Fields
  amount: number; // Recharge amount
  surabhiEarned: number;
  sevaEarned?: number;
  referralEarned?: number;
  referredBy?: string | null;

  // Sale-Specific Fields
  surabhiUsed?: number;
  walletDeduction?: number;
  cashPayment?: number;
  isCustomerRegistered?: boolean;

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
  id: string;
  type: 'signup' | 'sale' | 'recharge' | 'referral' | 'seva_contribution' | 'seva_allocation' | 'surabhi_earn'  ;
  remarks: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  storeLocation: string;
  createdAt: Timestamp;
}

export interface AccountTxType {
  id: string;
  createdAt: Timestamp;
  storeName: string;
  customerName: string;
  customerMobile: string;
  type: 'recharge' | 'sale' | 'settlement';
  amount: number;
  debit: number;
  adminCut: number;
  credit: number;
  balance: number;
  remarks: string;
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

