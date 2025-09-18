import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedSearch } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));

    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 300 },
    });

    expect(result.current).toBe('initial');

    // Change the value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 299ms - should still be old value
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Fast-forward time by 1ms more (total 300ms) - should update
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'initial' },
    });

    // Change value multiple times rapidly
    rerender({ value: 'change1' });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'change2' });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'final' });

    // Should still be initial value
    expect(result.current).toBe('initial');

    // After full delay from last change, should update to final value
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('final');
  });

  it('should work with different data types', () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: 0 },
      }
    );

    numberRerender({ value: 42 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(numberResult.current).toBe(42);

    // Test with object
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: { name: 'initial' } },
      }
    );

    const newObject = { name: 'updated' };
    objectRerender({ value: newObject });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(objectResult.current).toEqual(newObject);
  });

  it('should use custom delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 500 },
    });

    rerender({ value: 'updated', delay: 500 });

    // Should not update after 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('initial');

    // Should update after 500ms
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('updated');
  });

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 300 },
    });

    rerender({ value: 'updated', delay: 100 });

    // Should update after 100ms (new delay)
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });
});

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial search term and not searching state', () => {
    const { result } = renderHook(() => useDebouncedSearch('initial', 300));

    expect(result.current.debouncedSearchTerm).toBe('initial');
    expect(result.current.isSearching).toBe(false);
  });

  it('should set isSearching to true when search term changes', () => {
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebouncedSearch(searchTerm, 300),
      {
        initialProps: { searchTerm: 'initial' },
      }
    );

    // Change search term
    rerender({ searchTerm: 'updated' });

    expect(result.current.debouncedSearchTerm).toBe('initial');
    expect(result.current.isSearching).toBe(true);
  });

  it('should set isSearching to false after debounce delay', () => {
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebouncedSearch(searchTerm, 300),
      {
        initialProps: { searchTerm: 'initial' },
      }
    );

    // Change search term
    rerender({ searchTerm: 'updated' });

    expect(result.current.isSearching).toBe(true);

    // After debounce delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('updated');
    expect(result.current.isSearching).toBe(false);
  });

  it('should handle rapid search term changes', () => {
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebouncedSearch(searchTerm, 300),
      {
        initialProps: { searchTerm: 'initial' },
      }
    );

    // Rapid changes
    rerender({ searchTerm: 'a' });
    expect(result.current.isSearching).toBe(true);

    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ searchTerm: 'ab' });
    expect(result.current.isSearching).toBe(true);

    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ searchTerm: 'abc' });
    expect(result.current.isSearching).toBe(true);

    // Should still be searching and debounced term should be initial
    expect(result.current.debouncedSearchTerm).toBe('initial');

    // After full delay from last change
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('abc');
    expect(result.current.isSearching).toBe(false);
  });

  it('should work with empty search terms', () => {
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebouncedSearch(searchTerm, 300),
      {
        initialProps: { searchTerm: '' },
      }
    );

    expect(result.current.debouncedSearchTerm).toBe('');
    expect(result.current.isSearching).toBe(false);

    rerender({ searchTerm: 'search' });
    expect(result.current.isSearching).toBe(true);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('search');
    expect(result.current.isSearching).toBe(false);

    // Clear search
    rerender({ searchTerm: '' });
    expect(result.current.isSearching).toBe(true);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('should use custom delay', () => {
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebouncedSearch(searchTerm, 500),
      {
        initialProps: { searchTerm: 'initial' },
      }
    );

    rerender({ searchTerm: 'updated' });

    // Should still be searching after 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.isSearching).toBe(true);
    expect(result.current.debouncedSearchTerm).toBe('initial');

    // Should complete after 500ms
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.isSearching).toBe(false);
    expect(result.current.debouncedSearchTerm).toBe('updated');
  });
});
