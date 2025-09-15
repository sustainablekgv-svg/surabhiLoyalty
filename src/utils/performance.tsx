/**
 * Performance optimization utilities for React components
 * Implements industry best practices for React/TypeScript applications
 */

import * as React from 'react';
import { useCallback, useMemo } from 'react';

/**
 * Memoized calculation for wallet balance formatting
 */
export const useFormattedBalance = (balance: number) => {
  return useMemo(() => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance);
  }, [balance]);
};

/**
 * Memoized date formatting utility
 */
export const useFormattedDate = (date: Date | string | null) => {
  return useMemo(() => {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  }, [date]);
};

/**
 * Optimized search filter function
 */
export const useSearchFilter = <T extends Record<string, any>>(
  items: T[],
  searchTerm: string,
  searchFields: (keyof T)[]
) => {
  return useMemo(() => {
    if (!searchTerm.trim()) return items;

    const lowercaseSearch = searchTerm.toLowerCase();
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field];
        return value && String(value).toLowerCase().includes(lowercaseSearch);
      })
    );
  }, [items, searchTerm, searchFields]);
};

/**
 * Memoized pagination utility
 */
export const usePagination = <T extends Record<string, any>>(
  items: T[],
  itemsPerPage: number,
  currentPage: number
) => {
  return useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);
    const totalPages = Math.ceil(items.length / itemsPerPage);

    return {
      items: paginatedItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
  }, [items, itemsPerPage, currentPage]);
};

/**
 * Optimized event handlers with useCallback
 */
export const useOptimizedHandlers = () => {
  const handleInputChange = useCallback(
    (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
    },
    []
  );

  const handleSelectChange = useCallback(
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
    },
    []
  );

  const handleFormSubmit = useCallback(
    (onSubmit: () => void | Promise<void>) => (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit();
    },
    []
  );

  return {
    handleInputChange,
    handleSelectChange,
    handleFormSubmit,
  };
};

/**
 * Debounced value hook for performance optimization
 */
export const useDebounce = <T extends any>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Memoized component props for preventing unnecessary re-renders
 */
export const createMemoizedProps = <T extends Record<string, any>>(props: T): T => {
  return useMemo(() => props, [JSON.stringify(props)]);
};

/**
 * Performance monitoring utility
 */
export const measurePerformance = (name: string, fn: () => void) => {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now();
    fn();
    const end = performance.now();
    // console.log(`${name} took ${end - start} milliseconds`);
  } else {
    fn();
  }
};

/**
 * Lazy loading utility for components
 */
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) => {
  return React.lazy(importFn);
};

/**
 * Error boundary utility
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      return FallbackComponent ? (
        <FallbackComponent error={this.state.error!} />
      ) : (
        <div className="p-4 text-center">
          <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
          <p className="text-gray-600">Please refresh the page and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
