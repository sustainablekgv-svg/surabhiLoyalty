import { Timestamp } from 'firebase/firestore';
export interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  walletRechargeDone: Boolean;
  walletBalanceCurrentMonth : number;
  role: string;
  walletId: string;
  surabhiCoins: number;
  surabhiCoinsCurrentMonth:number;
  sevaCoinsTotal: number;
  sevaCoinsCurrentMonth:number;
  referredBy: string | null;
  referralIncome: number | null;
  referredUsers: { mobile:number; name: string; referralDate: Timestamp; }[] | null;
  registered: Boolean;
  lastTransactionDate: Timestamp;
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
  createdAt: string;
  status: 'active' | 'inactive';
  salesCount: number;
  staffPin: string;
  lastActive?: string;
  staffPassword: string;
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
  contributionsCurrentMonth : number;
  allocationsCurrentMonth: number;
  lastResetDate: Timestamp;
  lastAllocatedDate: Timestamp;
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
  date: Date;
  storeId: string;
  storeName: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
}

export interface StoreSummary {
  storeName: string;
  currentBalance: number;
  lastTransactionDate: Date;
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

