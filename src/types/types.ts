export interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  walletBalanceCurrentMonth : number;
  createdAt: import('firebase/firestore').FieldValue;
  role: string;
  walletId: string;
  surabhiCoins: number;
  surabhiCoinsCurrentMonth : number;
  sevaCoinsTotal: number;
  sevaCoinsCurrentMonth: number;
  referredBy: string | null;
  referralIncome: number | null;
  referredUsers: { mobile:number; referralDate: string; }[] | null;
  registered: Boolean;
  lastTransactionDate: string | null;
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
  location: string;
  address: string;
  walletCommission: number;
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
  // Payment info
  paymentMethod: 'cash' | 'wallet' | 'mixed';
  // Location and processing
  storeLocation: string;
  processedBy: string;
  // Additional metadata
  isCustomerRegistered: boolean;
  previousBalance?: {
    wallet: number;
    surabhiCoins: number;
    sevaCoins: number;
  };
  newBalance?: {
    wallet: number;
    surabhiCoins: number;
    sevaCoins: number;
  };
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

export interface Activity {
  id: string;
  type: 'signup' | 'transaction' | 'recharge' | 'referral' | 'contribution' | 'allocation';
  description: string;
  amount?: number;
  user: string;
  location: string;
  timestamp: string;
  date?: any;
}

export interface StorePerformance {
  name: string;
  transactions: number;
  sales: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
}