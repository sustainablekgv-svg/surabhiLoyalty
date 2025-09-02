import { signOut, onAuthStateChanged } from 'firebase/auth';
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';

import {
  User,
  getCustomerByMobile,
  getStaffByMobile,
  verifyUserExists,
  signInWithFirebase,
} from '@/lib/authService';
import { auth } from '@/lib/firebase';
import { sessionManager } from '@/lib/sessionManager';
import { storageUtils } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  login: (mobile: string, password: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Update initializeAuth to be more robust
  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      const storedUser = storageUtils.getUser();

      if (!storedUser) {
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Check if session is expired
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

  // Update the main useEffect
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
          if (!isInitialized) {
            await initializeAuth();
          }
        });

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

      // Try to sign in with Firebase if email exists
      if (userData.email) {
        try {
          await signInWithFirebase(userData.email, password);
        } catch (error) {
          // console.warn('Firebase auth failed, continuing with custom auth');
        }
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
      // Sign out from Firebase
      await signOut(auth);
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
  // console.log('The line 190 is', context);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
