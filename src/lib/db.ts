import {Customer, StaffType} from "@/types/types"
import { collection, where, getDocs,query } from "firebase/firestore";
import { db } from "./firebase";
export const getCustomerByMobile = async (mobile: string): Promise<Customer | null> => {
  const customersRef = collection(db, 'customers');
  const q = query(customersRef, where('mobile', '==', mobile));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
  } as unknown as Customer;
};

export const getStaffByMobile = async (mobile: string): Promise<StaffType | null> => {
  const staffRef = collection(db, 'staff');
  const q = query(staffRef, where('mobile', '==', mobile));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  return {
    id: querySnapshot.docs[0].id,
    ...querySnapshot.docs[0].data()
  } as StaffType;
};