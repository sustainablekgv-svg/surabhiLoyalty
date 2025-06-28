import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  User, 
  getCustomerByMobile, 
  getStaffByMobile, 
  verifyUserExists,
  signInWithFirebase 
} from '@/lib/authService';
import { storageUtils } from '@/lib/storage';
import { sessionManager } from '@/lib/sessionManager';

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
        console.log('THe line 46 userData is', userData);
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
          console.warn('Firebase auth failed, continuing with custom auth');
        }
      }
      
      // Set user state and storage
      setUser(userData);
      storageUtils.setUser(userData);
      sessionManager.updateActivity();
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
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
      console.error('Firebase logout error:', error);
    } finally {
      // Clear local state and storage
      setUser(null);
      storageUtils.clearAll();
      setIsLoading(false);
    }
  };

  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const storedUser = storageUtils.getUser();
      
      if (!storedUser) {
        return; // No stored user, initialization complete
      }

      // Check if session is expired
      if (sessionManager.isSessionExpired()) {
        console.log('Session expired, clearing storage');
        storageUtils.clearAll();
        return;
      }

      // Verify user still exists in database
      const userExists = await verifyUserExists(storedUser);
      
      if (userExists) {
        setUser(storedUser);
        sessionManager.updateActivity();
        console.log('User restored from storage');
      } else {
        console.log('User no longer exists in database, clearing storage');
        storageUtils.clearAll();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      storageUtils.clearAll();
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    // Initialize auth state
    const initAuth = async () => {
      // Listen to Firebase auth state changes
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!isInitialized) {
          initializeAuth();
        }
      });

      // If Firebase user is not immediately available, initialize anyway
      if (!isInitialized) {
        await initializeAuth();
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initializeAuth, isInitialized]);

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

  const value = useMemo(() => ({
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
    isInitialized
  }), [user, isLoading, isInitialized]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};