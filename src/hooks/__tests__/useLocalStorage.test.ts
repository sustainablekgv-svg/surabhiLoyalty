import { renderHook, act } from '@testing-library/react';
import {
  useLocalStorage,
  useSessionStorage,
  useUserPreferences,
  useFilterPreferences,
} from '../useLocalStorage';

// Mock localStorage and sessionStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should return initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    expect(result.current[0]).toBe('initial-value');
  });

  it('should return stored value from localStorage', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
  });

  it('should handle function updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 10));

    act(() => {
      result.current[1](prev => prev + 5);
    });

    expect(result.current[0]).toBe(15);
  });

  it('should remove value from localStorage when removeValue is called', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe('initial-value');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
  });

  it('should handle JSON parsing errors gracefully', () => {
    localStorageMock.setItem('test-key', 'invalid-json');

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    expect(result.current[0]).toBe('initial-value');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle localStorage errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should work with complex objects', () => {
    const complexObject = { name: 'John', age: 30, hobbies: ['reading', 'coding'] };

    const { result } = renderHook(() => useLocalStorage('user', complexObject));

    act(() => {
      result.current[1]({ ...complexObject, age: 31 });
    });

    expect(result.current[0]).toEqual({ ...complexObject, age: 31 });
  });
});

describe('useSessionStorage', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should return initial value when sessionStorage is empty', () => {
    const { result } = renderHook(() => useSessionStorage('test-key', 'initial-value'));

    expect(result.current[0]).toBe('initial-value');
  });

  it('should return stored value from sessionStorage', () => {
    sessionStorageMock.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useSessionStorage('test-key', 'initial-value'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('should update sessionStorage when setValue is called', () => {
    const { result } = renderHook(() => useSessionStorage('test-key', 'initial-value'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify('new-value')
    );
  });

  it('should remove value from sessionStorage when removeValue is called', () => {
    sessionStorageMock.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useSessionStorage('test-key', 'initial-value'));

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe('initial-value');
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('test-key');
  });
});

describe('useUserPreferences', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should return default user preferences', () => {
    const { result } = renderHook(() => useUserPreferences());

    expect(result.current[0]).toEqual({
      theme: 'system',
      itemsPerPage: 10,
    });
  });

  it('should update user preferences', () => {
    const { result } = renderHook(() => useUserPreferences());

    act(() => {
      result.current[1]({
        theme: 'dark',
        itemsPerPage: 25,
      });
    });

    expect(result.current[0]).toEqual({
      theme: 'dark',
      itemsPerPage: 25,
    });
  });
});

describe('useFilterPreferences', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should return default filter preferences', () => {
    const filterParams = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      activeTab: 'sales' as const,
    };

    const { result } = renderHook(() => useFilterPreferences(filterParams));

    expect(result.current[0]).toEqual({
      storeFilter: 'all',
      paymentFilter: 'all',
    });
  });

  it('should update filter preferences', () => {
    const filterParams = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      activeTab: 'recharges' as const,
    };

    const { result } = renderHook(() => useFilterPreferences(filterParams));

    act(() => {
      result.current[1]({
        storeFilter: 'store1',
        paymentFilter: 'cash',
      });
    });

    expect(result.current[0]).toEqual({
      storeFilter: 'store1',
      paymentFilter: 'cash',
    });
  });
});
