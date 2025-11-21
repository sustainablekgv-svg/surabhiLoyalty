import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { toast } from 'sonner';

import { StaffManagement } from '../StaffManagement';


// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2024-01-01') })),
    fromDate: jest.fn(date => ({ toDate: () => date })),
  },
}));

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

// Mock encryption
jest.mock('@/lib/encryption', () => ({
  encryptText: jest.fn(text => `encrypted_${text}`),
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

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ ...props }: any) => <div data-testid="skeleton" {...props} />,
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

const {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} = require('firebase/firestore');

const { encryptText } = require('@/lib/encryption');

// Mock data
const mockStores = [
  {
    id: 'store1',
    storeName: 'Test Store 1',
    storeLocation: 'Location 1',
    storeAddress: 'Address 1',
    storeContactNumber: '1234567890',
    storePrefix: 'TS1',
    storeCurrentBalance: 1000,
    storeSevaBalance: 500,
    referralCommission: 10,
    surabhiCommission: 5,
    sevaCommission: 3,
    cashOnlyCommission: 2,
    storeStatus: 'active',
    walletEnabled: true,
    demoStore: false,
    adminCurrentBalance: 2000,
    adminStoreProfit: 100,
    storeCreatedAt: new Date('2024-01-01'),
    storeUpdatedAt: new Date('2024-01-01'),
  },
];

const mockStaff = [
  {
    id: 'staff1',
    staffName: 'John Doe',
    staffMobile: '9876543210',
    staffEmail: 'john@test.com',
    storeLocation: 'Test Store 1',
    demoStore: false,
    role: 'staff',
    staffStatus: 'active',
    staffSalesCount: 10,
    staffPassword: 'encrypted_password',
    staffRechargesCount: 5,
    lastActive: new Date('2024-01-01'),
    createdAt: { toDate: () => new Date('2024-01-01') },
  },
];

describe('StaffManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getDocs to return mock data
    getDocs.mockImplementation(queryRef => {
      // Handle both collection references and query references
      const path = queryRef._path || queryRef.path || queryRef;
      const collectionName = path?.segments?.[0] || (typeof path === 'string' ? path : 'unknown');

      if (collectionName === 'stores' || collectionName.includes('stores')) {
        return Promise.resolve({
          docs: mockStores.map(store => ({
            id: store.id,
            data: () => store,
          })),
          empty: false,
        });
      }

      if (collectionName === 'staff' || collectionName.includes('staff')) {
        return Promise.resolve({
          docs: mockStaff.map(staff => ({
            id: staff.id,
            data: () => staff,
          })),
          empty: false,
        });
      }

      return Promise.resolve({ docs: [], empty: true });
    });

    collection.mockImplementation((db, collectionName) => ({
      _path: { segments: [collectionName] },
      path: collectionName,
    }));
    doc.mockReturnValue({});
    query.mockImplementation((collectionRef, ...constraints) => ({
      _path: collectionRef._path,
      path: collectionRef.path,
    }));
    where.mockReturnValue({});
    addDoc.mockResolvedValue({ id: 'new-id' });
    updateDoc.mockResolvedValue({});
    deleteDoc.mockResolvedValue({});
    encryptText.mockImplementation(text => `encrypted_${text}`);
  });

  it('should render loading state initially', () => {
    render(<StaffManagement />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('should render staff and stores data after loading', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
    });
  });

  it('should open staff dialog when Add Staff button is clicked', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addStaffButton = screen.getByText('Add Staff');
    fireEvent.click(addStaffButton);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('should validate staff email format', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addStaffButton = screen.getByText('Add Staff');
    fireEvent.click(addStaffButton);

    const emailInput = screen.getByPlaceholderText('Enter staff email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const saveButton = screen.getByText('Save Staff');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('should validate staff mobile number format', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addStaffButton = screen.getByText('Add Staff');
    fireEvent.click(addStaffButton);

    const mobileInput = screen.getByPlaceholderText('Enter staff mobile');
    fireEvent.change(mobileInput, { target: { value: '123' } });

    const saveButton = screen.getByText('Save Staff');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid 10-digit mobile number')).toBeInTheDocument();
    });
  });

  it('should create new staff successfully', async () => {
    // Mock query to return empty results (no existing email/mobile)
    getDocs.mockImplementation(queryRef => {
      if (queryRef._path) {
        return Promise.resolve({ docs: [], empty: true });
      }
      // Original mock for collections
      const collectionName = queryRef._path?.segments?.[0] || 'unknown';
      if (collectionName === 'stores') {
        return Promise.resolve({
          docs: mockStores.map(store => ({
            id: store.id,
            data: () => store,
          })),
        });
      }
      return Promise.resolve({
        docs: mockStaff.map(staff => ({ id: staff.id, data: () => staff })),
      });
    });

    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addStaffButton = screen.getByText('Add Staff');
    fireEvent.click(addStaffButton);

    // Fill form
    const nameInput = screen.getByPlaceholderText('Enter staff name');
    const emailInput = screen.getByPlaceholderText('Enter staff email');
    const mobileInput = screen.getByPlaceholderText('Enter staff mobile');
    const passwordInput = screen.getByPlaceholderText('Enter staff password');

    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(mobileInput, { target: { value: '1234567890' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const saveButton = screen.getByText('Save Staff');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          staffName: 'Jane Doe',
          staffEmail: 'jane@test.com',
          staffMobile: '1234567890',
          staffPassword: 'encrypted_password123',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Staff created successfully');
    });
  });

  it('should switch between staff and stores tabs', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const storesTab = screen.getByText('Stores');
    fireEvent.click(storesTab);

    expect(screen.getByText('Test Store 1')).toBeInTheDocument();
  });

  it('should handle edit staff functionality', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('should handle delete staff functionality', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Staff')).toBeInTheDocument();
  });

  it('should handle store creation', async () => {
    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const storesTab = screen.getByText('Stores');
    fireEvent.click(storesTab);

    const addStoreButton = screen.getByText('Add Store');
    fireEvent.click(addStoreButton);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('should handle error when fetching data fails', async () => {
    getDocs.mockRejectedValue(new Error('Firebase error'));

    await act(async () => {
      render(<StaffManagement />);
    });

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith('Error fetching data');
      },
      { timeout: 3000 }
    );
  });

  it('should validate duplicate email when creating staff', async () => {
    // Mock query to return existing email
    getDocs.mockImplementation(queryRef => {
      if (queryRef._path) {
        return Promise.resolve({
          docs: [{ id: 'existing-id', data: () => ({ staffEmail: 'existing@test.com' }) }],
          empty: false,
        });
      }
      return Promise.resolve({
        docs: mockStaff.map(staff => ({ id: staff.id, data: () => staff })),
      });
    });

    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addStaffButton = screen.getByText('Add Staff');
    fireEvent.click(addStaffButton);

    const emailInput = screen.getByPlaceholderText('Enter staff email');
    fireEvent.change(emailInput, { target: { value: 'existing@test.com' } });

    const saveButton = screen.getByText('Save Staff');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('This email is already registered')).toBeInTheDocument();
    });
  });

  it('should validate duplicate mobile when creating staff', async () => {
    // Mock query to return existing mobile
    getDocs.mockImplementation(queryRef => {
      if (queryRef._path) {
        return Promise.resolve({
          docs: [{ id: 'existing-id', data: () => ({ staffMobile: '9999999999' }) }],
          empty: false,
        });
      }
      return Promise.resolve({
        docs: mockStaff.map(staff => ({ id: staff.id, data: () => staff })),
      });
    });

    render(<StaffManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addStaffButton = screen.getByText('Add Staff');
    fireEvent.click(addStaffButton);

    const mobileInput = screen.getByPlaceholderText('Enter staff mobile');
    fireEvent.change(mobileInput, { target: { value: '9999999999' } });

    const saveButton = screen.getByText('Save Staff');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('This mobile number is already registered')).toBeInTheDocument();
    });
  });
});
