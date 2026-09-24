import { Address } from '@/types/shop';
import { CustomerType } from '@/types/types';
import { doc, getDoc } from 'firebase/firestore';
import { updateCustomerProfile } from '@/lib/authService';
import { db } from './firebase';

export const getAddresses = async (userId: string): Promise<Address[]> => {
  try {
    const docSnap = await getDoc(doc(db, 'Customers', userId));

    if (docSnap.exists()) {
      const data = docSnap.data() as CustomerType;
      return data.addresses || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching addresses:', error);
    throw error;
  }
};

export const addAddress = async (userId: string, address: Address): Promise<Address[]> => {
  try {
    const docRef = doc(db, 'Customers', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Customer not found');
    }

    const data = docSnap.data() as CustomerType;
    const currentAddresses = data.addresses || [];
    const newAddresses = [...currentAddresses, address];

    await updateCustomerProfile(userId, { addresses: newAddresses });

    return newAddresses;
  } catch (error) {
    console.error('Error adding address:', error);
    throw error;
  }
};

export const updateAddress = async (userId: string, index: number, address: Address): Promise<Address[]> => {
  try {
    const docSnap = await getDoc(doc(db, 'Customers', userId));

    if (!docSnap.exists()) {
      throw new Error('Customer not found');
    }

    const data = docSnap.data() as CustomerType;
    const currentAddresses = data.addresses || [];
    
    if (index < 0 || index >= currentAddresses.length) {
      throw new Error('Invalid address index');
    }

    const newAddresses = [...currentAddresses];
    newAddresses[index] = address;

    await updateCustomerProfile(userId, { addresses: newAddresses });

    return newAddresses;
  } catch (error) {
    console.error('Error updating address:', error);
    throw error;
  }
};

export const deleteAddress = async (userId: string, index: number): Promise<Address[]> => {
  try {
    const docSnap = await getDoc(doc(db, 'Customers', userId));

    if (!docSnap.exists()) {
      throw new Error('Customer not found');
    }

    const data = docSnap.data() as CustomerType;
    const currentAddresses = data.addresses || [];

    if (index < 0 || index >= currentAddresses.length) {
      throw new Error('Invalid address index');
    }

    const newAddresses = currentAddresses.filter((_, i) => i !== index);

    await updateCustomerProfile(userId, { addresses: newAddresses });

    return newAddresses;
  } catch (error) {
    console.error('Error deleting address:', error);
    throw error;
  }
};
