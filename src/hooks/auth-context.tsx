import { onAuthStateChanged, signOut } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
    getCustomerByMobile,
    getStaffByMobile,
    ensureFirebaseAuth,
    verifyUserExists,
} from '@/lib/authService';
import { safeDecryptText } from '@/lib/encryption';
import { auth } from '@/lib/firebase';
import { sessionManager } from '@/lib/sessionManager';
import { storageUtils } from '@/lib/storage';
import { tabSync } from '@/lib/tabSync';
import { User, StaffType, CustomerType } from '@/types/types';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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

      if (!auth.currentUser) {
        // Give Firebase Auth indexedDB persistence a moment to initialize
        await new Promise(r => setTimeout(r, 200));
      }

      if (auth.currentUser) {
        try {
          const tokenResult = await auth.currentUser.getIdTokenResult();
          const verifiedRole = (tokenResult.claims.role as 'admin' | 'staff' | 'customer') || storedUser.role;
          const verifiedUser = {
            ...storedUser,
            role: verifiedRole,
          };
          setUser(verifiedUser);
          sessionManager.updateActivity();
        } catch {
          storageUtils.clearAll();
          setUser(null);
        }
      } else {
        // No valid Firebase Auth session found
        storageUtils.clearAll();
        setUser(null);
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
        // Every tab should listen to its own Firebase auth state changes
        // to ensure auth.currentUser is populated and httpsCallable works.
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

  // Real-time listener for user data
  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    if (user && isInitialized) {
      const collectionName = user.role === 'customer' ? 'Customers' : 'staff';
      const userDocId = user.id;

      if (userDocId) {
        unsubscribeDoc = onSnapshot(
          doc(db, collectionName, userDocId),
          (snapshot) => {
            if (snapshot.exists()) {
              const updatedData = {
                ...snapshot.data(),
                id: snapshot.id,
                role: user.role,
              } as User;

              setUser(prevUser => {
                if (JSON.stringify(prevUser) !== JSON.stringify(updatedData)) {
                  storageUtils.setUser(updatedData);
                  return updatedData;
                }
                return prevUser;
              });
            }
          },
          (error) => {
            console.error('Realtime listener error:', error);
          }
        );
      }
    }

    return () => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, [user?.id, user?.role, isInitialized]);

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
        throw new Error('Authentication failed: No user data returned');
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
      // Sign out from Firebase in this tab
      await signOut(auth);

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
