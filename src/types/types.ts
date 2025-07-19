import { Timestamp } from 'firebase/firestore';
export interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  walletRechargeDone: Boolean;
  walletBalanceCurrentMonth : number;
  createdAt: import('firebase/firestore').FieldValue;
  role: string;
  walletId: string;
  surabhiCoins: number;
  sevaCoinsTotal: number;
  referredBy: string | null;
  referralIncome: number | null;
  referredUsers: { mobile:number; referralDate: string; }[] | null;
  registered: Boolean;
  lastTransactionDate: Timestamp;
  customerPassword: string;
  tpin: string;
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
  contactNumber: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: import('firebase/firestore').FieldValue;
};

export interface SevaTransaction {
  id: string;
  type: 'contribution' | 'allocation';
  amount: number;
  description: string;
  date: import('firebase/firestore').FieldValue;
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
  lastResetDate: import('firebase/firestore').FieldValue;
  lastAllocatedDate: import('firebase/firestore').FieldValue;
}

export interface ActivityType {
  id: string;
  type: 'signup' | 'transaction' | 'recharge' | 'referral' | 'contribution' | 'allocation';
  description: string;
  amount?: number;
  user: string;
  location: string;
  date: import('firebase/firestore').FieldValue;
}

interface AccountTx {
  id: string;
  date: Date;
  shopId: string;
  shopName: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
}

interface StoreSummary {
  storeName: string;
  currentBalance: number;
  lastTransactionDate: Date;
}

interface AdminDeck {
  totalBalance: number;
  recentTransactions: AccountTx[];
  shopsSummary: StoreSummary[];
  walletOverview: {
    totalCredits: number;
    totalDebits: number;
    netFlow: number;
  };
}

