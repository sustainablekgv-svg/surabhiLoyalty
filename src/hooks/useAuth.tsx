import { useState, useEffect, createContext, useContext } from 'react';

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
  login: (mobile: string, password: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock authentication service
const mockAuthService = {
  login: async (mobile: string, password: string): Promise<User> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock users for testing
    const mockUsers: Record<string, User> = {
      '9999999999': {
        id: '1',
        mobile: '9999999999',
        role: 'admin',
        name: 'Super Admin',
        email: 'admin@example.com',
        createdAt: new Date().toISOString()
      },
      '8888888888': {
        id: '2',
        mobile: '8888888888',
        role: 'staff',
        name: 'Store Manager',
        email: 'staff@example.com',
        storeLocation: 'Store 1',
        createdAt: new Date().toISOString()
      },
      '7777777777': {
        id: '3',
        mobile: '7777777777',
        role: 'customer',
        name: 'John Doe',
        email: 'customer@example.com',
        createdAt: new Date().toISOString()
      }
    };
    
    const user = mockUsers[mobile];
    if (!user || password !== 'password123') {
      throw new Error('Invalid credentials');
    }
    
    return user;
  }
};

const useAuthLogic = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (mobile: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const user = await mockAuthService.login(mobile, password);
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
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
