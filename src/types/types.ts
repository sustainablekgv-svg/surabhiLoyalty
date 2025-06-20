export interface UserData {
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  walletBalance: number;
  genericCoins: number;
  createdAt: string;
  role: string;
  walletId: string;
  surabhiCoins: number;
  sevaCoinsTotal: number;
  sevaCoinsCurrentMonth: number;
  referredBy?: string;
  referredUsers?: { uid: string; referralDate: string; }[];
}

export interface UserRegistrationProps {
  storeLocation: string;
}