import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SalesManagement } from '../SalesManagement';
import { toast } from 'sonner';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2024-01-01') })),
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
  updateDoc: jest.fn(),
  where: jest.fn(),
}));

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

// Mock auth context
jest.mock('@/hooks/auth-context', () => ({
  useAuth: jest.fn(),
}));

// Mock quarterly targets utility
jest.mock('@/utils/quarterlyTargets', () => ({
  hasMetQuarterlyTarget: jest.fn(),
  updateCustomerQuarterlyTarget: jest.fn(),
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, ...props }: any) => (
    <input onChange={onChange} value={value} {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.('wallet')}>
      {children}
    </div>
  ),
  SelectContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <option value={value} {...props}>{children}</option>
  ),
  SelectTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectValue: ({ placeholder, ...props }: any) => <span {...props}>{placeholder}</span>,
}));

const {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} = require('firebase/firestore');

const { useAuth } = require('@/hooks/auth-context');
const { hasMetQuarterlyTarget, updateCustomerQuarterlyTarget } = require('@/utils/quarterlyTargets');

// Mock data
const mockUser = {
  id: 'staff1',
  staffName: 'John Staff',
  staffMobile: '9876543210',
  role: 'staff',
  storeLocation: 'Test Store',
};

const mockStoreDetails = {
  id: 'store1',
  storeName: 'Test Store',
  storeLocation: 'Test Location',
  storePrefix: 'TS',
  surabhiCommission: 10,
  cashOnlyCommission: 5,
  referralCommission: 3,
  sevaCommission: 2,
  storeCurrentBalance: 10000,
  storeSevaBalance: 5000,
  demoStore: false,
  storeStatus: 'active',
};

const mockCustomers = [
  {
    id: 'customer1',
    customerName: 'John Doe',
    customerMobile: '9876543210',
    customerEmail: 'john@test.com',
    storeLocation: 'Test Store',
    walletBalance: 1000,
    surabhiBalance: 500,
    sevaTotal: 200,
    walletRechargeDone: true,
    demoStore: false,
    tpin: '1234',
    quarterlyTarget: 5000,
    carriedForwardTarget: 0,
    cumTotal: 6000,
    targetMet: true,
    coinsFrozen: false,
    joinedDate: { toDate: () => new Date('2024-01-01') },
  },
  {
    id: 'customer2',
    customerName: 'Jane Smith',
    customerMobile: '8765432109',
    customerEmail: 'jane@test.com',
    storeLocation: 'Test Store',
    walletBalance: 2000,
    surabhiBalance: 800,
    sevaTotal: 300,
    walletRechargeDone: true,
    demoStore: false,
    tpin: '5678',
    quarterlyTarget: 5000,
    carriedForwardTarget: 0,
    cumTotal: 3000,
    targetMet: false,
    coinsFrozen: true,
    joinedDate: { toDate: () => new Date('2024-01-01') },
  },
];

const mockProps = {
  storeLocation: 'Test Store',
  demoStore: false,
};

describe('SalesManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAuth
    useAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
    
    // Mock Firebase functions
    getDocs.mockImplementation((queryRef) => {
      // Mock store query
      if (queryRef._path?.segments?.includes('stores')) {
        return Promise.resolve({
          empty: false,
          docs: [{
            id: mockStoreDetails.id,
            data: () => mockStoreDetails,
          }],
        });
      }
      
      // Mock customers query
      if (queryRef._path?.segments?.includes('Customers')) {
        return Promise.resolve({
          empty: false,
          docs: mockCustomers.map(customer => ({
            id: customer.id,
            data: () => customer,
          })),
        });
      }
      
      return Promise.resolve({ empty: true, docs: [] });
    });
    
    collection.mockReturnValue({ _path: { segments: ['stores'] } });
    query.mockReturnValue({ _path: { segments: ['stores'] } });
    where.mockReturnValue({});
    addDoc.mockResolvedValue({ id: 'new-transaction-id' });
    updateDoc.mockResolvedValue({});
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockStoreDetails });
    
    hasMetQuarterlyTarget.mockReturnValue(true);
    updateCustomerQuarterlyTarget.mockResolvedValue({});
  });

  it('should render sales management interface', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sales Management')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search customers...')).toBeInTheDocument();
    });
  });

  it('should load and display customers', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('should filter customers based on search term', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search customers...');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('should select customer when clicked', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    expect(screen.getByText('Selected Customer: John Doe')).toBeInTheDocument();
  });

  it('should handle sale amount input', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    expect((saleAmountInput as HTMLInputElement).value).toBe('1000');
  });

  it('should calculate sale details correctly', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    await waitFor(() => {
      expect(screen.getByText('Sale Calculation')).toBeInTheDocument();
    });
  });

  it('should handle payment method selection', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const paymentSelect = screen.getByTestId('select');
    fireEvent.click(paymentSelect);
    
    expect(paymentSelect).toHaveAttribute('data-value', 'wallet');
  });

  it('should show TPIN modal when customer has TPIN', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    const processButton = screen.getByText('Process Sale');
    fireEvent.click(processButton);
    
    await waitFor(() => {
      expect(screen.getByText('Enter TPIN')).toBeInTheDocument();
    });
  });

  it('should verify TPIN correctly', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    const processButton = screen.getByText('Process Sale');
    fireEvent.click(processButton);
    
    await waitFor(() => {
      expect(screen.getByText('Enter TPIN')).toBeInTheDocument();
    });
    
    const tpinInput = screen.getByPlaceholderText('Enter 4-digit TPIN');
    fireEvent.change(tpinInput, { target: { value: '1234' } });
    
    const verifyButton = screen.getByText('Verify & Process');
    fireEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(addDoc).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Sale processed successfully!');
    });
  });

  it('should handle invalid TPIN', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    const processButton = screen.getByText('Process Sale');
    fireEvent.click(processButton);
    
    await waitFor(() => {
      expect(screen.getByText('Enter TPIN')).toBeInTheDocument();
    });
    
    const tpinInput = screen.getByPlaceholderText('Enter 4-digit TPIN');
    fireEvent.change(tpinInput, { target: { value: '9999' } });
    
    const verifyButton = screen.getByText('Verify & Process');
    fireEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid TPIN. Please try again.');
    });
  });

  it('should handle customers with frozen coins', async () => {
    hasMetQuarterlyTarget.mockReturnValue(false);
    
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('Jane Smith').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    // Should show warning about frozen coins
    await waitFor(() => {
      expect(screen.getByText(/coins are frozen/i)).toBeInTheDocument();
    });
  });

  it('should handle sale processing error', async () => {
    addDoc.mockRejectedValue(new Error('Firebase error'));
    
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    const processButton = screen.getByText('Process Sale');
    fireEvent.click(processButton);
    
    await waitFor(() => {
      const tpinInput = screen.getByPlaceholderText('Enter 4-digit TPIN');
      fireEvent.change(tpinInput, { target: { value: '1234' } });
      
      const verifyButton = screen.getByText('Verify & Process');
      fireEvent.click(verifyButton);
    });
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to process sale. Please try again.');
    });
  });

  it('should handle store not found error', async () => {
    getDocs.mockImplementation((queryRef) => {
      if (queryRef._path?.segments?.includes('stores')) {
        return Promise.resolve({ empty: true, docs: [] });
      }
      return Promise.resolve({
        empty: false,
        docs: mockCustomers.map(customer => ({
          id: customer.id,
          data: () => customer,
        })),
      });
    });
    
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No stores found with that name');
    });
  });

  it('should handle data fetching error', async () => {
    getDocs.mockRejectedValue(new Error('Firebase error'));
    
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch data');
    });
  });

  it('should automatically calculate Surabhi coins to use', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '300' } });
    
    // Should automatically set coins to use based on available balance and sale amount
    await waitFor(() => {
      const coinsInput = screen.getByDisplayValue('300'); // Min of 500 (balance) and 300 (sale amount)
      expect(coinsInput).toBeInTheDocument();
    });
  });

  it('should handle cash payment method', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '1000' } });
    
    // Change payment method to cash
    const paymentSelect = screen.getByTestId('select');
    fireEvent.click(paymentSelect);
    
    expect(screen.getByText('Sale Calculation')).toBeInTheDocument();
  });

  it('should validate sale amount input', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const customerCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(customerCard!);
    
    const saleAmountInput = screen.getByPlaceholderText('Enter sale amount');
    fireEvent.change(saleAmountInput, { target: { value: '0' } });
    
    const processButton = screen.getByText('Process Sale');
    expect(processButton).toBeDisabled();
  });

  it('should clear selection when new customer is selected', async () => {
    render(<SalesManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Select first customer
    const johnCard = screen.getByText('John Doe').closest('div');
    fireEvent.click(johnCard!);
    
    expect(screen.getByText('Selected Customer: John Doe')).toBeInTheDocument();
    
    // Select second customer
    const janeCard = screen.getByText('Jane Smith').closest('div');
    fireEvent.click(janeCard!);
    
    expect(screen.getByText('Selected Customer: Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('Selected Customer: John Doe')).not.toBeInTheDocument();
  });
});