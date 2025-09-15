import { useEffect, useState } from 'react';

/**
 * Custom hook for debouncing values to reduce API calls
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
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
 * Custom hook for debounced search with loading state
 * @param searchTerm - The search term to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Object with debouncedSearchTerm and isSearching state
 */
export const useDebouncedSearch = (searchTerm: string, delay: number = 300) => {
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, delay);

  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, debouncedSearchTerm]);

  return {
    debouncedSearchTerm,
    isSearching,
  };
};