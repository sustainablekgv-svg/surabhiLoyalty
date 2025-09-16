import { render, renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../auth-context';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  auth: {},
}));

// Mock auth service
jest.mock('@/lib/authService', () => ({
  getCustomerByMobile: jest.fn(),
  getStaffByMobile: jest.fn(),
  signInWithFirebase: jest.fn(),
  verifyUserExists: jest.fn(),
}));

// Mock session manager
jest.mock('@/lib/sessionManager', () => ({
  sessionManager: {
    isSessionExpired: jest.fn(),
    updateActivity: jest.fn(),
  },
}));

// Mock storage utils
jest.mock('@/lib/storage', () => ({
  storageUtils: {
    getUser: jest.fn(),
    setUser: jest.fn(),
    clearAll: jest.fn(),
  },
}));

const {
  onAuthStateChanged,
  signOut,
} = require('firebase/auth');

const {
  getCustomerByMobile,
  getStaffByMobile,
  signInWithFirebase,
  verifyUserExists,
} = require('@/lib/authService');

const { sessionManager } = require('@/lib/sessionManager');
const { storageUtils } = require('@/lib/storage');

// Mock user data
const mockCustomerUser = {
  id: '1',
  mobile: '1234567890',
  email: 'customer@test.com',
  role: 'customer',
  name: 'John Customer',
};

const mockStaffUser = {
  id: '2',
  mobile: '9876543210',
  email: 'staff@test.com',
  role: 'staff',
  name: 'Jane Staff',
};

const mockAdminUser = {
  id: '3',
  mobile: '5555555555',
  email: 'admin@test.com',
  role: 'admin',
  name: 'Admin User',
};

// Test wrapper
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
};

describe('AuthProvider and useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn(); // unsubscribe function
    });
    sessionManager.isSessionExpired.mockReturnValue(false);
    sessionManager.updateActivity.mockImplementation(() => {});
    storageUtils.getUser.mockReturnValue(null);
    storageUtils.setUser.mockImplementation(() => {});
    storageUtils.clearAll.mockImplementation(() => {});
    verifyUserExists.mockResolvedValue(true);
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });

    it('should provide auth context when used within AuthProvider', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current).toEqual({
        user: null,
        login: expect.any(Function),
        logout: expect.any(Function),
        isLoading: expect.any(Boolean),
        isAuthenticated: false,
        isInitialized: expect.any(Boolean),
      });
    });
  });

  describe('AuthProvider initialization', () => {
    it('should initialize with no stored user', async () => {
      storageUtils.getUser.mockReturnValue(null);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should initialize with stored user when session is valid', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      sessionManager.isSessionExpired.mockReturnValue(false);
      verifyUserExists.mockResolvedValue(true);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      expect(result.current.user).toEqual(mockCustomerUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(sessionManager.updateActivity).toHaveBeenCalled();
    });

    it('should clear storage when session is expired', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      sessionManager.isSessionExpired.mockReturnValue(true);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      expect(storageUtils.clearAll).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear storage when user no longer exists in database', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      sessionManager.isSessionExpired.mockReturnValue(false);
      verifyUserExists.mockResolvedValue(false);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      expect(storageUtils.clearAll).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it('should handle initialization errors gracefully', async () => {
      storageUtils.getUser.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      expect(storageUtils.clearAll).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('login function', () => {
    it('should login customer successfully', async () => {
      getCustomerByMobile.mockResolvedValue(mockCustomerUser);
      signInWithFirebase.mockResolvedValue(undefined);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('1234567890', 'password', 'customer');
      });
      
      expect(getCustomerByMobile).toHaveBeenCalledWith('1234567890', 'password');
      expect(signInWithFirebase).toHaveBeenCalledWith('customer@test.com', 'password');
      expect(storageUtils.setUser).toHaveBeenCalledWith(mockCustomerUser);
      expect(sessionManager.updateActivity).toHaveBeenCalled();
      expect(loginResult).toEqual(mockCustomerUser);
      expect(result.current.user).toEqual(mockCustomerUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should login staff successfully', async () => {
      getStaffByMobile.mockResolvedValue(mockStaffUser);
      signInWithFirebase.mockResolvedValue(undefined);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('9876543210', 'password', 'staff');
      });
      
      expect(getStaffByMobile).toHaveBeenCalledWith('9876543210', 'password', 'staff');
      expect(loginResult).toEqual(mockStaffUser);
      expect(result.current.user).toEqual(mockStaffUser);
    });

    it('should login admin successfully', async () => {
      getStaffByMobile.mockResolvedValue(mockAdminUser);
      signInWithFirebase.mockResolvedValue(undefined);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      await act(async () => {
        await result.current.login('5555555555', 'password', 'admin');
      });
      
      expect(getStaffByMobile).toHaveBeenCalledWith('5555555555', 'password', 'admin');
      expect(result.current.user).toEqual(mockAdminUser);
    });

    it('should handle login with invalid role', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      await act(async () => {
        await expect(
          result.current.login('1234567890', 'password', 'invalid')
        ).rejects.toThrow('Invalid role specified');
      });
      
      expect(result.current.user).toBeNull();
    });

    it('should handle login with invalid credentials', async () => {
      getCustomerByMobile.mockResolvedValue(null);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      await act(async () => {
        await expect(
          result.current.login('1234567890', 'wrongpassword', 'customer')
        ).rejects.toThrow('Invalid credentials');
      });
      
      expect(result.current.user).toBeNull();
    });

    it('should continue login even if Firebase auth fails', async () => {
      getCustomerByMobile.mockResolvedValue(mockCustomerUser);
      signInWithFirebase.mockRejectedValue(new Error('Firebase auth failed'));
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      await act(async () => {
        await result.current.login('1234567890', 'password', 'customer');
      });
      
      expect(result.current.user).toEqual(mockCustomerUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle login without email', async () => {
      const userWithoutEmail = { ...mockCustomerUser, email: undefined };
      getCustomerByMobile.mockResolvedValue(userWithoutEmail);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      await act(async () => {
        await result.current.login('1234567890', 'password', 'customer');
      });
      
      expect(signInWithFirebase).not.toHaveBeenCalled();
      expect(result.current.user).toEqual(userWithoutEmail);
    });

    it('should set loading state during login', async () => {
      getCustomerByMobile.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockCustomerUser), 100))
      );
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.login('1234567890', 'password', 'customer');
      });
      
      expect(result.current.isLoading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('logout function', () => {
    it('should logout successfully', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      signOut.mockResolvedValue(undefined);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.user).toEqual(mockCustomerUser);
      });
      
      await act(async () => {
        await result.current.logout();
      });
      
      expect(signOut).toHaveBeenCalled();
      expect(storageUtils.clearAll).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle Firebase logout error gracefully', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      signOut.mockRejectedValue(new Error('Firebase logout failed'));
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.user).toEqual(mockCustomerUser);
      });
      
      await act(async () => {
        await result.current.logout();
      });
      
      expect(storageUtils.clearAll).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it('should set loading state during logout', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      signOut.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.user).toEqual(mockCustomerUser);
      });
      
      act(() => {
        result.current.logout();
      });
      
      expect(result.current.isLoading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('activity tracking', () => {
    it('should set up activity event listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const wrapper = createWrapper();
      const { unmount } = render(<div>Test</div>, { wrapper });
      
      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      
      events.forEach(event => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          { passive: true }
        );
      });
      
      unmount();
      
      events.forEach(event => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        );
      });
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should update activity when user is logged in', async () => {
      storageUtils.getUser.mockReturnValue(mockCustomerUser);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.user).toEqual(mockCustomerUser);
      });
      
      // Simulate activity
      act(() => {
        window.dispatchEvent(new Event('mousemove'));
      });
      
      expect(sessionManager.updateActivity).toHaveBeenCalled();
    });
  });

  describe('Firebase auth state changes', () => {
    it('should handle Firebase auth state changes', async () => {
      let authStateCallback: (user: any) => void;
      onAuthStateChanged.mockImplementation((auth, callback) => {
        authStateCallback = callback;
        return jest.fn();
      });
      
      const wrapper = createWrapper();
      renderHook(() => useAuth(), { wrapper });
      
      // Simulate Firebase auth state change
      act(() => {
        authStateCallback!(null);
      });
      
      expect(onAuthStateChanged).toHaveBeenCalled();
    });
  });

  describe('context value memoization', () => {
    it('should memoize context value correctly', async () => {
      const wrapper = createWrapper();
      const { result, rerender } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      const firstValue = result.current;
      
      // Rerender without changing dependencies
      rerender();
      
      expect(result.current).toBe(firstValue);
    });
  });
});