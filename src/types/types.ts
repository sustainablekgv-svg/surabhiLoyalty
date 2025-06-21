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
  referredBy?: string;
  referredUsers?: { uid: string; referralDate: string; }[];
  registered: Boolean;
  lastTransactionDate?: string;
  customerPassword: string;
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


export interface SalesTransaction  {
  id?: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  // Transaction amounts
  amount: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
  // Rewards calculation
  surabhiCoinsEarned: number;
  goSevaContribution: number;
  // Payment info
  paymentMethod: 'cash' | 'wallet' | 'mixed';
  paymentStatus: 'pending' | 'completed' | 'failed';
  // Location and processing
  storeLocation: string;
  processedBy: string;
  processedAt: string;
  // Additional metadata
  isNewCustomer: boolean;
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
  // For returns/refunds
  isReturn?: boolean;
  originalTransactionId?: string;
  returnReason?: string;
};

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

