import { useState } from 'react';

/**
 * Custom hook for managing localStorage with React state
 * @param key - The localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns [value, setValue, removeValue]
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  // Get from local storage then parse stored json or return initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Remove value from localStorage
  const removeValue = () => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      // console.warn(`Error removing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue];
};

/**
 * Custom hook for session storage (similar to localStorage but session-scoped)
 * @param key - The sessionStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns [value, setValue, removeValue]
 */
export const useSessionStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // console.warn(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // console.warn(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  const removeValue = () => {
    try {
      window.sessionStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      // console.warn(`Error removing sessionStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue];
};

// Predefined keys for common cached data
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  SEARCH_HISTORY: 'search_history',
  FILTER_PREFERENCES: 'filter_preferences',
  DASHBOARD_LAYOUT: 'dashboard_layout',
  RECENT_STORES: 'recent_stores',
  RECENT_CUSTOMERS: 'recent_customers',
} as const;

// Type definitions for common cached data
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  itemsPerPage?: number;
  defaultView?: string;
}

export interface FilterPreferences {
  storeFilter?: string;
  paymentFilter?: string;
  dateRange?: { start: Date; end: Date };
}

export interface SearchHistoryItem {
  term: string;
  timestamp: number;
  type: 'customer' | 'transaction' | 'store';
}

// Utility hooks for specific data types
export const useUserPreferences = () => {
  return useLocalStorage<UserPreferences>(STORAGE_KEYS.USER_PREFERENCES, {
    theme: 'system',
    itemsPerPage: 10,
  });
};

export const useFilterPreferences = (p0: {
  startDate: string;
  endDate: string;
  activeTab: 'sales' | 'recharges';
}) => {
  return useLocalStorage<FilterPreferences>(STORAGE_KEYS.FILTER_PREFERENCES, {
    storeFilter: 'all',
    paymentFilter: 'all',
  });
};

export const useSearchHistory = () => {
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>(
    STORAGE_KEYS.SEARCH_HISTORY,
    []
  );

  const addSearchTerm = (term: string, type: SearchHistoryItem['type']) => {
    if (!term.trim()) return;

    const newItem: SearchHistoryItem = {
      term: term.trim(),
      timestamp: Date.now(),
      type,
    };

    setHistory(prev => {
      // Remove duplicate terms and keep only last 10 items
      const filtered = prev.filter(item => item.term !== newItem.term);
      return [newItem, ...filtered].slice(0, 10);
    });
  };

  const clearHistory = () => setHistory([]);

  return {
    history,
    addSearchTerm,
    clearHistory,
  };
};
