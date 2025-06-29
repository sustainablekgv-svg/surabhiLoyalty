export interface Customer {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  createdAt: import('firebase/firestore').FieldValue;
  role: string;
  walletId: string;
  surabhiCoins: number;
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
  contactNumber: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// export interface Transaction {
//   id: string;
//   customerName: string;
//   mobile: string;
//   storeLocation: string;
//   amount: number;
//   staffInWork: string;
//   paymentMethod: 'wallet' | 'cash' | 'mixed';
//   surabhiCoinsUsed: number;
//   timestamp: string;
//   status: 'completed' | 'pending' | 'failed';
// }

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
  date: string;
  customerMobile?: string;
  customerName?: string;
  monthYear: string; // Format: "YYYY-MM"
}

export interface SevaPool {
  currentBalance: number;
  totalContributions: number;
  totalAllocations: number;
  lastResetDate: string;
}
