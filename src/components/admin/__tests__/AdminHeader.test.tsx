import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminHeader } from '../AdminHeader';
import { useToast } from '@/hooks/use-toast';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  query: jest.fn(),
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

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return 'Invalid date';
  }),
}));

// Mock toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span className={className} data-variant={variant} {...props}>{children}</span>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    open ? <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>{children}</div> : null
  ),
  DialogContent: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="dialog-content" {...props}>{children}</div>
  ),
  DialogDescription: ({ children, className, ...props }: any) => (
    <p className={className} {...props}>{children}</p>
  ),
  DialogHeader: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  DialogTitle: ({ children, className, ...props }: any) => (
    <h2 className={className} {...props}>{children}</h2>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, disabled, className, ...props }: any) => (
    <input 
      onChange={onChange} 
      value={value} 
      disabled={disabled}
      className={className}
      {...props} 
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className, ...props }: any) => (
    <label htmlFor={htmlFor} className={className} {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.('Test Store')}>
      {children}
    </div>
  ),
  SelectContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectItem: ({ children, value, className, ...props }: any) => (
    <option value={value} className={className} {...props}>{children}</option>
  ),
  SelectTrigger: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  SelectValue: ({ placeholder, ...props }: any) => <span {...props}>{placeholder}</span>,
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Coins: ({ className, ...props }: any) => <div className={className} data-testid="coins-icon" {...props} />,
  LogOut: ({ className, ...props }: any) => <div className={className} data-testid="logout-icon" {...props} />,
  Settings: ({ className, ...props }: any) => <div className={className} data-testid="settings-icon" {...props} />,
}));

const {
  collection,
  doc,
  getDocs,
  limit,
  query,
  Timestamp,
  updateDoc,
  where,
} = require('firebase/firestore');

const mockToast = jest.fn();

// Mock data
const mockUser = {
  id: 'admin1',
  staffName: 'John Admin',
  staffMobile: '9876543210',
  staffEmail: 'admin@test.com',
  storeLocation: 'Test Store',
  role: 'admin' as const,
  staffStatus: 'active' as const,
  staffPassword: 'password123',
  createdAt: {
    toDate: () => new Date('2024-01-01'),
    seconds: 1704067200,
    nanoseconds: 0,
    toMillis: () => 1704067200000,
    isEqual: () => false,
    toJSON: () => ({ seconds: 1704067200, nanoseconds: 0 })
  } as any,
  staffSalesCount: 150,
  demoStore: false,
  staffRechargesCount: 5,
};

const mockStores = [
  {
    id: 'store1',
    storeName: 'Test Store',
    storeLocation: 'Test Location 1',
  },
  {
    id: 'store2',
    storeName: 'Another Store',
    storeLocation: 'Test Location 2',
  },
];

const mockOnLogout = jest.fn();

describe('AdminHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useToast
    (useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    });
    
    // Mock Firebase functions
    getDocs.mockResolvedValue({
      docs: mockStores.map(store => ({
        id: store.id,
        data: () => store,
      })),
    });
    
    collection.mockReturnValue({ _path: { segments: ['stores'] } });
    query.mockReturnValue({ _path: { segments: ['staff'] } });
    where.mockReturnValue({});
    limit.mockReturnValue({});
    updateDoc.mockResolvedValue({});
  });

  it('should render admin header with user information', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByText('Loyalty Rewards')).toBeInTheDocument();
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
    expect(screen.getByText('John Admin')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('should render coins icon and brand elements', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByTestId('coins-icon')).toBeInTheDocument();
  });

  it('should render settings and logout buttons', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
    expect(screen.getByTestId('logout-icon')).toBeInTheDocument();
  });

  it('should call onLogout when logout button is clicked', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const logoutButton = screen.getByTestId('logout-icon').closest('button');
    fireEvent.click(logoutButton!);
    
    expect(mockOnLogout).toHaveBeenCalledTimes(1);
  });

  it('should open settings dialog when settings button is clicked', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    expect(screen.getByText('Update your profile information')).toBeInTheDocument();
  });

  it('should load stores on component mount', async () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    await waitFor(() => {
      expect(getDocs).toHaveBeenCalledWith(expect.anything());
    });
  });

  it('should display user information in settings dialog', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    expect(screen.getByDisplayValue('John Admin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
    expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument();
  });

  it('should show disabled fields for non-editable information', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const nameInput = screen.getByDisplayValue('John Admin');
    const mobileInput = screen.getByDisplayValue('9876543210');
    const emailInput = screen.getByDisplayValue('admin@test.com');
    
    expect(nameInput).toBeDisabled();
    expect(mobileInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
  });

  it('should handle store location selection', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const storeSelect = screen.getAllByTestId('select')[0]; // First select is store location
    fireEvent.click(storeSelect);
    
    expect(storeSelect).toHaveAttribute('data-value', 'Test Store');
  });

  it('should handle role selection', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const roleSelect = screen.getAllByTestId('select')[1]; // Second select is role
    fireEvent.click(roleSelect);
    
    expect(roleSelect).toHaveAttribute('data-value', 'admin');
  });

  it('should handle status selection', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const statusSelect = screen.getAllByTestId('select')[2]; // Third select is status
    fireEvent.click(statusSelect);
    
    expect(statusSelect).toHaveAttribute('data-value', 'active');
  });

  it('should handle password input change', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const passwordInput = screen.getByLabelText('New Password') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    
    expect(passwordInput.value).toBe('newpassword123');
  });

  it('should close settings dialog when cancel button is clicked', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should save changes when save button is clicked', async () => {
    getDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'staff-doc-id' }],
    });
    
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const passwordInput = screen.getByLabelText('New Password');
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile updated',
        description: 'Your changes have been saved successfully.',
        variant: 'default',
      });
    });
  });

  it('should show no changes detected when no fields are modified', async () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'No changes detected',
        description: 'Make changes before saving.',
        variant: 'default',
      });
    });
  });

  it('should handle staff not found error', async () => {
    getDocs.mockResolvedValue({
      empty: true,
      docs: [],
    });
    
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const passwordInput = screen.getByLabelText('New Password');
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Update failed',
        description: 'No staff record found for your account.',
        variant: 'destructive',
      });
    });
  });

  it('should handle update error', async () => {
    getDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'staff-doc-id' }],
    });
    
    updateDoc.mockRejectedValue(new Error('Firebase error'));
    
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    const passwordInput = screen.getByLabelText('New Password');
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Update failed',
        description: 'Firebase error',
        variant: 'destructive',
      });
    });
  });

  it('should save changes when form is submitted', async () => {
    getDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'staff-doc-id' }],
    });
    
    updateDoc.mockResolvedValue(undefined);
    
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    // Change the password to ensure there are changes to save
    const passwordInput = screen.getByDisplayValue(mockUser.staffPassword) as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    
    expect(passwordInput.value).toBe('newpassword123');
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    // Wait for save operation to complete
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
    });
    
    // Verify the updateDoc was called with correct data
    expect(updateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        staffPassword: 'newpassword123'
      })
    );
  });

  it('should display formatted creation date and sales count', () => {
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    const settingsButton = screen.getByTestId('settings-icon').closest('button');
    fireEvent.click(settingsButton!);
    
    expect(screen.getByDisplayValue('150')).toBeInTheDocument(); // Sales count
  });

  it('should handle stores loading error gracefully', async () => {
    getDocs.mockRejectedValue(new Error('Firebase error'));
    
    render(<AdminHeader user={mockUser} onLogout={mockOnLogout} />);
    
    // Component should still render even if stores fail to load
    expect(screen.getByText('Loyalty Rewards')).toBeInTheDocument();
  });

  it('should render with fallback name when staffName is not provided', () => {
    const userWithoutName = { ...mockUser, staffName: '' };
    
    render(<AdminHeader user={userWithoutName} onLogout={mockOnLogout} />);
    
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should handle role display correctly', () => {
    const staffUser = { ...mockUser, role: 'staff' as const };
    
    render(<AdminHeader user={staffUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByText('STAFF')).toBeInTheDocument();
  });
});