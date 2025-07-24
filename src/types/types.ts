import { Timestamp } from 'firebase/firestore';
export interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  walletRechargeDone: Boolean;
  saleElgibility : Boolean;
  walletBalanceCurrentMonth : number;
  role: string;
  walletId: string;
  surabhiCoins: number;
  surabhiCoinsCurrentMonth:number;
  sevaCoinsTotal: number;
  sevaCoinsCurrentMonth:number;
  referredBy: string | null;
  referralSurabhi: number;
  referredUsers: { mobile:number; name: string; referralDate: Timestamp; }[] | null;
  registered: Boolean;
  lastTransactionDate: Timestamp | null;
  createdAt: Timestamp;
  customerPassword: string;
  tpin: string;
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

export interface SalesManagementProps {
  storeLocation: string;
}

export interface StoreUsersProps {
  storeLocation: string;
}

export interface StaffType {
  id: string;
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  role: 'admin' | 'staff';
  createdAt: Timestamp;
  status: 'active' | 'inactive';
  salesCount: number;
  staffPin: string;
  rechargesCount: number;
  lastActive?: Timestamp;
  staffPassword: string;
}

export interface StorePerformance {
  name: string;
  transactions: number;
  sales: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
  lastUpdated?: Timestamp;
}

export interface StoreType {
  id: string;
  name: string;
  storeLocation: string;
  address: string;
  referralCommission: number;
  surabhiCommission: number;
  sevaCommission: number;
  cashOnlyCommission: number;
  contactNumber: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdminHeaderProps {
  user: StaffType;
  onLogout: () => void;
}
export interface RechargeRecord {
  id?: string; 
  customerMobile: string;
  customerName: string;
  amount: number;
  storeLocation: string;
  storeName: string;
  surabhiCoinsEarned: number;
  sevaAmountEarned: number;
  referralAmountEarned?: number;
  referredBy?: string | null;
  timestamp: Timestamp;
  paymentMethod?: 'cash';
  staffName: string; // ID of staff who processed
}

export interface SalesTransaction  {
  id?: string;
  customerName: string;
  customerMobile: string;
  // Transaction amounts 
  amount: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
  paymentMethod: 'cash' | 'wallet' | 'mixed';
  storeLocation: string;
  processedBy: string;
  isCustomerRegistered: boolean;
  previousBalance?: {
    wallet: number;
    surabhiCoins: number;
  };
  newBalance?: {
    wallet: number;
    surabhiCoins: number;
  };
  createdAt: Timestamp;
};

export interface SevaTransaction {
  type: 'contribution' | 'allocation';
  amount: number;
  description: string;
  date: Timestamp;
  customerMobile?: string;
  customerName?: string;
  monthYear: string; // Format: "YYYY-MM"
  storeLocation?: string;
}

export interface SevaPool {
  currentBalance: number;
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
  type: 'signup' | 'transaction' | 'recharge' | 'referral' | 'contribution' | 'allocation';
  description: string;
  amount?: number;
  user: string;
  location: string;
  date: Timestamp;
}

export interface AccountTx {
  id: string;
  date: Timestamp;
  storeName: string;
  type: 'recharge' | 'sale' | 'settlement';
  amount: number;
  debit: number;
  adminCut?:number;
  credit: number;
  balance: number;
  description: string;
  settled: Boolean;
}

export interface StoreSummary {
  storeName: string;
  currentBalance: number;
}

export interface StoreAccountsProps {
  storeLocation: string;
}

export interface AdminDeck {
  totalBalance: number;
  recentTransactions: AccountTx[];
  shopsSummary: StoreSummary[];
  walletOverview: {
    totalCredits: number;
    totalDebits: number;
    netFlow: number;
  };
}

