import { CustomerType, StaffType, User } from '@/types/types';

export const getUserName = (user: User | null | undefined): string => {
  if (!user) return '';
  if (user.role === 'customer') {
    return (user as CustomerType).customerName || '';
  }
  return (user as StaffType).staffName || '';
};

export const getUserMobile = (user: User | null | undefined): string => {
  if (!user) return '';
  if (user.role === 'customer') {
    return (user as CustomerType).customerMobile || '';
  }
  return (user as StaffType).staffMobile || '';
};

export const getUserEmail = (user: User | null | undefined): string => {
  if (!user) return '';
  if (user.role === 'customer') {
    return (user as CustomerType).customerEmail || '';
  }
  return (user as StaffType).staffEmail || '';
};

// Helper for when you need to know if it's customer or staff explicitly for type narrowing
export function isCustomer(user: User): user is CustomerType {
  return user.role === 'customer';
}

export function isStaff(user: User): user is StaffType {
  return user.role === 'staff' || user.role === 'admin';
}
