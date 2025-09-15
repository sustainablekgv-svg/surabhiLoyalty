/**
 * Enhanced API types for better type safety and development experience
 * Implements industry best practices for TypeScript applications
 */

import * as React from 'react';

// Base API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Generic error type
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Filter types
export interface FilterOptions {
  storeLocation?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string;
  searchTerm?: string;
}

// Form validation types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'select';
  validation?: ValidationRule;
  options?: { value: string; label: string }[];
}

export interface FormErrors {
  [fieldName: string]: string;
}

// Authentication types
export interface LoginCredentials {
  mobile: string;
  password: string;
  role: 'customer' | 'staff' | 'admin';
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}

// Transaction types with enhanced type safety
export interface TransactionBase {
  id: string;
  amount: number;
  timestamp: Date;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

export interface WalletTransaction extends TransactionBase {
  type: 'recharge' | 'debit' | 'refund';
  walletId: string;
  customerId: string;
  storeLocation: string;
}

export interface SalesTransaction extends TransactionBase {
  type: 'sale';
  customerId: string;
  staffId: string;
  storeLocation: string;
  paymentMethod: 'wallet' | 'cash' | 'card';
  items?: {
    name: string;
    quantity: number;
    price: number;
  }[];
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  isLoading: boolean;
  loadingText?: string;
}

export interface ErrorProps extends BaseComponentProps {
  error: Error | string | null;
  onRetry?: () => void;
}

// Hook return types
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export interface UseFormResult<T> {
  values: T;
  errors: FormErrors;
  isValid: boolean;
  isSubmitting: boolean;
  handleChange: (field: keyof T, value: any) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void>) => Promise<void>;
  reset: () => void;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Event handler types
export type InputChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;
export type SelectChangeHandler = (value: string) => void;
export type FormSubmitHandler = (e: React.FormEvent) => void;
export type ButtonClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => void;

// Firebase specific types
export interface FirebaseDocument {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface FirebaseQuery {
  collection: string;
  where?: {
    field: string;
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in';
    value: any;
  }[];
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
}

// Performance monitoring types
export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Cache types
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number;
  strategy: 'lru' | 'fifo' | 'ttl';
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
}

// Security types
export interface SecurityConfig {
  encryptionEnabled: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
}

// Audit log types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}
