import { useState, useEffect, createContext, useContext } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '@/lib/firebase';

interface User {
  id: string;
  mobile: string;
  role: 'admin' | 'staff' | 'customer';
  name?: string;
  email?: string;
  storeLocation?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (mobile: string, password: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuthLogic = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (mobile: string, password: string, role: string): Promise<User> => {
    setIsLoading(true);
    try {
      let userData: User | null = null;
      
      // Check the appropriate collection based on role
      if (role === 'customer') {
        const customersRef = collection(db, 'customers');
        const q = query(customersRef, where('mobile', '==', mobile));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('No customer found with this mobile number');
        }
        
        const customerDoc = querySnapshot.docs[0];
        const customerData = customerDoc.data();
        
        // Verify password
        if (customerData.customerPassword !== password) {
          throw new Error('Invalid password');
        }
        
        userData = {
          id: customerDoc.id,
          mobile: customerData.mobile,
          role: 'customer',
          name: customerData.name,
          email: customerData.email,
          storeLocation: customerData.storeLocation,
          createdAt: customerData.createdAt?.toDate().toISOString() || new Date().toISOString()
        };
      } 
      else if (role === 'staff' || role === 'admin') {
        const staffRef = collection(db, 'staff');
        const q = query(staffRef, where('mobile', '==', mobile));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('No staff member found with this mobile number');
        }
        
        const staffDoc = querySnapshot.docs[0];
        const staffData = staffDoc.data();
        
        // Verify password
        if (staffData.staffPassword !== password) {
          throw new Error('Invalid password');
        }
        
        // Verify role matches
        if (staffData.role !== role) {
          throw new Error(`User is not registered as ${role}`);
        }
        
        userData = {
          id: staffDoc.id,
          mobile: staffData.mobile,
          role: staffData.role,
          name: staffData.name,
          email: staffData.email,
          storeLocation: staffData.storeLocation,
          createdAt: staffData.createdAt || new Date().toISOString()
        };
      } else {
        throw new Error('Invalid role specified');
      }
      
      if (!userData) {
        throw new Error('Authentication failed');
      }
      
      // Sign in with Firebase Auth if email exists (optional)
      if (userData.email) {
        try {
          await signInWithEmailAndPassword(auth, userData.email, password);
        } catch (error) {
          console.warn('Firebase auth login failed, continuing with custom auth');
        }
      }
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Firebase logout error:', error);
    }
    setUser(null);
    localStorage.removeItem('user');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        // Verify the user still exists in the database
        try {
          let userDoc;
          if (parsedUser.role === 'customer') {
            userDoc = await getDoc(doc(db, 'customers', parsedUser.id));
          } else {
            userDoc = await getDoc(doc(db, 'staff', parsedUser.id));
          }
          
          if (userDoc.exists()) {
            setUser(parsedUser);
          } else {
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.error('Error verifying user:', error);
          localStorage.removeItem('user');
        }
      }
    };
    
    initializeAuth();
  }, []);

  return {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuthLogic();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};