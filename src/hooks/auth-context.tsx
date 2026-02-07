import { onAuthStateChanged, signOut } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
    getCustomerByMobile,
    getStaffByMobile,
    ensureFirebaseAuth,
    verifyUserExists,
} from '@/lib/authService';
import { auth } from '@/lib/firebase';
import { sessionManager } from '@/lib/sessionManager';
import { storageUtils } from '@/lib/storage';
import { tabSync } from '@/lib/tabSync';
import { User } from '@/types/types';

interface AuthContextType {
  user: User | null;
  login: (mobile: string, password: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const DEFAULT_AUTH_CONTEXT: AuthContextType = {
  user: null,
  login: async () => {
    throw new Error('AuthProvider is not mounted');
  },
  logout: async () => {},
  isLoading: false,
  isAuthenticated: false,
  isInitialized: false,
};

const AuthContext = createContext<AuthContextType>(DEFAULT_AUTH_CONTEXT);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authUnsubscribe, setAuthUnsubscribe] = useState<(() => void) | null>(null);

  // Update initializeAuth to be more robust
  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      // Ensure a valid tab session exists before checking expiration
      // Initialize a new session if missing; otherwise update activity timestamp
      try {
        const hasSession = !!sessionManager.getSessionToken();
        if (!hasSession) {
          sessionManager.initializeSession();
        } else {
          sessionManager.updateActivity();
        }
      } catch {
        // If session init fails, proceed without clearing user state here
      }

      const storedUser = storageUtils.getUser();

      if (!storedUser) {
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Check if session is expired (after ensuring/init session)
      if (sessionManager.isSessionExpired()) {
        // console.log('Session expired, clearing storage');
        storageUtils.clearAll();
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Verify user still exists in database
      const userExists = await verifyUserExists(storedUser);

      if (userExists) {
        setUser(storedUser);
        sessionManager.updateActivity();
      } else {
        storageUtils.clearAll();
      }
    } catch (error) {
      // console.error('Auth initialization error:', error);
      storageUtils.clearAll();
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, []);

  // Update the main useEffect with tab synchronization
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let tabSyncUnsubscribers: (() => void)[] = [];

    const initAuth = async () => {
      try {
        // Only the main tab should handle Firebase auth state changes
        if (sessionManager.isMainTab()) {
          unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
            if (!isInitialized) {
              await initializeAuth();
            }

            // Broadcast auth state change to other tabs
            tabSync.broadcast('AUTH_STATE_CHANGE', {
              user: firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null,
              timestamp: Date.now(),
            });
          });
          setAuthUnsubscribe(() => unsubscribe);
        }

        // Set up tab synchronization listeners
        const logoutUnsubscribe = tabSync.subscribe('LOGOUT', message => {
          if (message.tabId !== tabSync.getTabId()) {
            // Another tab logged out, clear local state
            setUser(null);
            storageUtils.clearAll();
          }
        });

        const authChangeUnsubscribe = tabSync.subscribe('AUTH_STATE_CHANGE', message => {
          if (message.tabId !== tabSync.getTabId()) {
            // Another tab changed auth state, sync local state
            if (!message.payload.user) {
              setUser(null);
              storageUtils.clearAll();
            }
          }
        });

        tabSyncUnsubscribers = [logoutUnsubscribe, authChangeUnsubscribe];

        if (!isInitialized) {
          await initializeAuth();
        }
      } catch (error) {
        // console.error('Auth initialization error:', error);
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      tabSyncUnsubscribers.forEach(unsub => unsub());
    };
  }, [initializeAuth, isInitialized]);

  const updateActivity = useCallback(() => {
    if (user) {
      sessionManager.updateActivity();
    }
  }, [user]);

  const login = async (mobile: string, password: string, role: string): Promise<User> => {
    setIsLoading(true);
    try {
      let userData: User | null = null;

      // Authenticate based on role
      if (role === 'customer') {
        userData = await getCustomerByMobile(mobile, password);
      } else if (role === 'staff' || role === 'admin') {
        userData = await getStaffByMobile(mobile, password, role);
        // console.log('TView and manage all customer accounts', userData);
      } else {
        throw new Error('Invalid role specified');
      }

      if (!userData) {
        throw new Error('Invalid credentials');
      }

      const isValidEmail = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return false;
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      };

      // Try to sign in with Firebase if email exists
      const email = userData.role === 'customer' 
        ? (userData as import('@/types/types').CustomerType).customerEmail 
        : (userData as import('@/types/types').StaffType).staffEmail;

      const normalizedEmail = email?.trim();
      const shouldAttemptFirebaseAuth =
        !!normalizedEmail && isValidEmail(normalizedEmail) && password.length >= 6;

      if (shouldAttemptFirebaseAuth) {
        // Ensure Firebase auth so callable functions work (e.g. R2 upload URL)
        await ensureFirebaseAuth(normalizedEmail!, password, {
          allowCreate: role !== 'customer',
          tolerateFailure: true,
        });
      }

      // Set user state and storage
      setUser(userData);
      storageUtils.setUser(userData);
      sessionManager.updateActivity();

      return userData;
    } catch (error) {
      // console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Only sign out from Firebase if this is the main tab
      if (sessionManager.isMainTab()) {
        await signOut(auth);
      }

      // Clear session for this tab (this will broadcast to other tabs)
      sessionManager.clearSession();
    } catch (error) {
      // console.error('Firebase logout error:', error);
    } finally {
      // Clear local state and storage
      setUser(null);
      storageUtils.clearAll();
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up activity listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isLoading,
      isAuthenticated: !!user,
      isInitialized,
    }),
    [user, isLoading, isInitialized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === DEFAULT_AUTH_CONTEXT && import.meta.env.DEV) {
    console.error('useAuth used outside AuthProvider. Check provider wiring.');
  }
  return context;
};
