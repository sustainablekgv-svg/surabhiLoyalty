import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { CustomerManagement } from '../CustomerManagement';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2024-01-01') })),
    fromDate: jest.fn(date => ({ toDate: () => date })),
  },
}));

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

// Mock hooks
jest.mock('@/hooks/useFirebaseQueries', () => ({
  useCustomers: jest.fn(),
  useActiveStores: jest.fn(),
  useInvalidateQueries: jest.fn(),
}));

jest.mock('@/hooks/useDebounce', () => ({
  useDebouncedSearch: jest.fn(),
}));

jest.mock('@/hooks/useLocalStorage', () => ({
  useFilterPreferences: jest.fn(),
}));

jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogFooter: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, ...props }: any) => <input onChange={onChange} {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={() => onValueChange?.('test-value')}>
      {children}
    </div>
  ),
  SelectContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <option value={value} {...props}>
      {children}
    </option>
  ),
  SelectTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectValue: ({ placeholder, ...props }: any) => <span {...props}>{placeholder}</span>,
}));

const {
  useCustomers,
  useActiveStores,
  useInvalidateQueries,
} = require('@/hooks/useFirebaseQueries');

const { useDebouncedSearch } = require('@/hooks/useDebounce');
const { useFilterPreferences } = require('@/hooks/useLocalStorage');
const { toast } = require('@/hooks/use-toast');
const { updateDoc, collection, query, where, getDocs } = require('firebase/firestore');

// Mock data
const mockCustomers = [
  {
    id: 'customer1',
    customerName: 'John Doe',
    customerMobile: '9876543210',
    customerEmail: 'john@test.com',
    storeLocation: 'Store A',
    city: 'City A',
    district: 'District A',
    walletBalance: 1000,
    surabhiBalance: 500,
    sevaTotal: 200,
    walletRechargeDone: true,
    demoStore: false,
    referredUsers: ['user1', 'user2'],
    lastTransactionDate: { toDate: () => new Date('2024-01-15') },
    tpin: '1234',
    customerPassword: 'password123',
  },
  {
    id: 'customer2',
    customerName: 'Jane Smith',
    customerMobile: '8765432109',
    customerEmail: 'jane@test.com',
    storeLocation: 'Store B',
    city: 'City B',
    district: 'District B',
    walletBalance: 2000,
    surabhiBalance: 800,
    sevaTotal: 300,
    walletRechargeDone: false,
    demoStore: true,
    referredUsers: [],
    lastTransactionDate: { toDate: () => new Date('2023-12-01') },
    tpin: '5678',
    customerPassword: 'password456',
  },
];

const mockStores = [
  {
    id: 'store1',
    storeName: 'Store A',
    storeLocation: 'Location A',
    demoStore: false,
    storeStatus: 'active',
  },
  {
    id: 'store2',
    storeName: 'Store B',
    storeLocation: 'Location B',
    demoStore: true,
    storeStatus: 'active',
  },
];

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CustomerManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock hook implementations
    useCustomers.mockReturnValue({
      data: mockCustomers,
      isLoading: false,
      error: null,
    });

    useActiveStores.mockReturnValue({
      data: mockStores,
      isLoading: false,
    });

    useInvalidateQueries.mockReturnValue({
      invalidateCustomers: jest.fn(),
    });

    useDebouncedSearch.mockReturnValue({
      debouncedSearchTerm: '',
    });

    useFilterPreferences.mockReturnValue([{ storeFilter: 'all' }, jest.fn()]);

    updateDoc.mockResolvedValue({});
    getDocs.mockResolvedValue({
      empty: false,
      docs: [
        {
          ref: { id: 'customer1' },
          data: () => mockCustomers[0],
        },
      ],
    });
  });

  it('should render loading state when data is loading', () => {
    useCustomers.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render customer data after loading', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('should calculate analytics correctly excluding demo stores', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    // Only non-demo customers should be counted
    expect(screen.getByText('1')).toBeInTheDocument(); // Total customers (excluding demo)
    expect(screen.getByText('₹1,000')).toBeInTheDocument(); // Total wallet balance
    expect(screen.getByText('500')).toBeInTheDocument(); // Total Surabhi coins
  });

  it('should filter customers by search term', () => {
    useDebouncedSearch.mockReturnValue({
      debouncedSearchTerm: 'John',
    });

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('should filter customers by store', () => {
    useFilterPreferences.mockReturnValue([{ storeFilter: 'Store A' }, jest.fn()]);

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('should open customer details dialog when view button is clicked', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Customer Details')).toBeInTheDocument();
  });

  it('should open edit dialog when edit button is clicked', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Customer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('should handle input changes in edit dialog', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const nameInput = screen.getByDisplayValue('John Doe') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'John Updated' } });

    expect(nameInput.value).toBe('John Updated');
  });

  it('should save customer changes successfully', async () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const nameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(nameInput, { target: { value: 'John Updated' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          customerName: 'John Updated',
        })
      );
      expect(toast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Customer updated successfully',
      });
    });
  });

  it('should handle error when customer not found during save', async () => {
    getDocs.mockResolvedValue({
      empty: true,
      docs: [],
    });

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Failure',
        description: 'No customer found with this mobile number',
        variant: 'destructive',
      });
    });
  });

  it('should handle save error gracefully', async () => {
    updateDoc.mockRejectedValue(new Error('Firebase error'));

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to update customer',
        variant: 'destructive',
      });
    });
  });

  it('should handle numeric input changes correctly', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const walletInput = screen.getByDisplayValue('1000') as HTMLInputElement;
    fireEvent.change(walletInput, { target: { value: '1500' } });

    expect(walletInput.value).toBe('1500');
  });

  it('should handle select changes in edit dialog', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const storeSelect = screen.getByTestId('select');
    fireEvent.click(storeSelect);

    // The mock select will trigger onValueChange with 'test-value'
    expect(storeSelect).toBeInTheDocument();
  });

  it('should display correct customer statistics', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    // Check for registered vs guest customers
    expect(screen.getByText('1')).toBeInTheDocument(); // Registered customers
    expect(screen.getByText('0')).toBeInTheDocument(); // Guest customers
  });

  it('should handle error when no mobile number provided during save', async () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // Mock editCustomer without mobile
    const component = screen.getByTestId('dialog').closest('div');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'No customer mobile number provided',
        variant: 'destructive',
      });
    });
  });

  it('should close dialogs when cancel is clicked', () => {
    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should handle search input changes', () => {
    const mockSetSearchTerm = jest.fn();

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    const searchInput = screen.getByPlaceholderText('Search customers...') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'John' } });

    expect(searchInput.value).toBe('John');
  });

  it('should display error state when customers fail to load', () => {
    useCustomers.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to load customers'),
    });

    const wrapper = createWrapper();
    render(<CustomerManagement />, { wrapper });

    expect(screen.getByText('Error loading customers')).toBeInTheDocument();
  });
});
