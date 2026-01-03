import { addAddress, deleteAddress, getAddresses, updateAddress } from '@/lib/addressService';
import { Address } from '@/types/shop';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AddressForm } from './AddressForm';
import { AddressList } from './AddressList';

interface AddressManagerProps {
  userId: string;
}

export const AddressManager = ({ userId }: AddressManagerProps) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, [userId]);

  const fetchAddresses = async () => {
    setIsLoading(true);
    try {
      const data = await getAddresses(userId);
      setAddresses(data);
    } catch (error) {
      toast.error('Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAddress = async (address: Address) => {
    setIsLoading(true);
    try {
      const updatedAddresses = await addAddress(userId, address);
      setAddresses(updatedAddresses);
      setView('list');
      toast.success('Address added successfully');
    } catch (error) {
      toast.error('Failed to add address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAddress = async (address: Address) => {
    if (editIndex === null) return;
    setIsLoading(true);
    try {
      const updatedAddresses = await updateAddress(userId, editIndex, address);
      setAddresses(updatedAddresses);
      setView('list');
      setEditIndex(null);
      toast.success('Address updated successfully');
    } catch (error) {
      toast.error('Failed to update address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddress = async (index: number) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    setIsLoading(true);
    try {
      const updatedAddresses = await deleteAddress(userId, index);
      setAddresses(updatedAddresses);
      toast.success('Address deleted successfully');
    } catch (error) {
      toast.error('Failed to delete address');
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'add') {
    return (
      <AddressForm
        onSubmit={handleAddAddress}
        onCancel={() => setView('list')}
        isLoading={isLoading}
      />
    );
  }

  if (view === 'edit' && editIndex !== null) {
    return (
      <AddressForm
        initialData={addresses[editIndex]}
        onSubmit={handleUpdateAddress}
        onCancel={() => {
            setView('list');
            setEditIndex(null);
        }}
        isLoading={isLoading}
      />
    );
  }

  return (
    <AddressList
      addresses={addresses}
      onAdd={() => setView('add')}
      onEdit={(index) => {
        setEditIndex(index);
        setView('edit');
      }}
      onDelete={handleDeleteAddress}
      isLoading={isLoading}
    />
  );
};
