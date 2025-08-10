import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingCart,
  Search,
  DollarSign,
  Coins,
  Calculator,
  CheckCircle,
  Phone,
  HandCoins,
  Loader2
} from 'lucide-react';
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  increment,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  CustomerType,
  SalesManagementProps,
  ActivityType,
  StoreType,
  AccountTxType,
  StaffType,
  SevaPoolType,
  CustomerTxType
} from '@/types/types';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/auth-context';

const fetchCustomerByMobile = async (mobile: string): Promise<CustomerType | null> => {
  try {
    const q = query(collection(db, 'Customers'), where('customerMobile', '==', mobile));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as CustomerType;
    }
    return null;
  } catch (error) {
    console.error('Error fetching referrer:', error);
    return null;
  }
};

const calculateAdminCut = (saleAmount: number, storeDetails: StoreType) => {
  if (!storeDetails) return 0;
  // const remainingAmount = saleAmount - surabhiCoinsToUse;
  const surabhiAmount = Math.floor(saleAmount * (storeDetails.surabhiCommission / 100));
  const referralAmount = Math.floor(saleAmount * (storeDetails.referralCommission / 100));
  const sevaAmount = Math.floor(saleAmount * (storeDetails.sevaCommission / 100));

  return referralAmount + sevaAmount + surabhiAmount;
};

export const SalesManagement = ({ storeLocation }: SalesManagementProps) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  console.log("The user in line 61 is", user);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
  const [isRegisteredAtSameStore, setIsRegisteredAtSameStore] = useState<boolean>(false);
  const [saleAmount, setSaleAmount] = useState<number | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'mixed'>('wallet');
  const [surabhiCoinsToUse, setSurabhiCoinsToUse] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
  const [storeDetails, setStoreDetails] = useState<StoreType | null>(null);

  const [showTPINModal, setShowTPINModal] = useState(false);
  const [enteredTPIN, setEnteredTPIN] = useState("");

  const [sevaPool, setSevaPool] = useState<SevaPoolType>({
    currentSevaBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: Timestamp.now(),
    lastAllocatedDate: Timestamp.now()
  });

  const handleSaleWithTPIN = async () => {
    if (selectedCustomer.tpin) {
      setShowTPINModal(true);
    } else {
      handleSale();
    }
  };

  const verifyTPINAndProcess = () => {
    if (enteredTPIN === selectedCustomer.tpin) {
      setShowTPINModal(false);
      setEnteredTPIN("");
      handleSale();
    } else {
      toast.error("Invalid TPIN. Please try again.");
      setEnteredTPIN("");
    }
  };

  // Fetch customers from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch store details first
        const q = query(
          collection(db, 'stores'),
          where('storeName', '==', storeLocation) // exact match
        );

        const querySnapshotStores = await getDocs(q);
        if (!querySnapshotStores.empty) {
          querySnapshotStores.forEach((doc) => {
            setStoreDetails(doc.data() as StoreType);
          });
        } else {
          toast.error('No stores found with that name');
        }

        // Then fetch customers
        const customersCollection = collection(db, 'Customers');
        const querySnapshot = await getDocs(customersCollection);
        const customersData = querySnapshot.docs.map(doc => ({
          ...doc.data() as CustomerType,
          mobile: doc.data().mobile // Using mobile as identifier
        }));
        setCustomers(customersData);
      } catch (error) {
        toast.error('Failed to fetch data');
        console.error('Error fetching data:', error);
      } finally {
        setIsFetchingCustomers(false);
      }
    };

    const fetchCustomers = async () => {
      setIsFetchingCustomers(true);
      try {
        const q = query(collection(db, 'Customers'));
        const querySnapshot = await getDocs(q);
        const customersData: CustomerType[] = [];
        querySnapshot.forEach((doc) => {
          customersData.push({ id: doc.id, ...doc.data() } as unknown as CustomerType);
        });
        setCustomers(customersData);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to load customers');
      } finally {
        setIsFetchingCustomers(false);
      }
    };
    fetchCustomers();
    fetchData();
  }, [storeLocation]);

  const filteredCustomers = customers.filter(customer =>
    customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customerMobile.includes(searchTerm)
  );

  // Automatically use all available Surabhi coins if customer is selected
  useEffect(() => {
    if (selectedCustomer && saleAmount && saleAmount > 0) {
      const maxCoinsToUse = Math.min(selectedCustomer.surabhiBalance, saleAmount);
      setSurabhiCoinsToUse(maxCoinsToUse);
    } else {
      setSurabhiCoinsToUse(0);
    }
  }, [selectedCustomer, saleAmount]);

  const calculateAdminProfit = () => {
    if (!saleCalculation) return 0;
    
    const cashPaymentPart = saleCalculation.cashPayment * 
      (storeDetails.surabhiCommission - storeDetails.cashOnlyCommission) / 100;
      
    const surabhiCoinsPart = saleCalculation.surabhiCoinsUsed * 
      (storeDetails.referralCommission + storeDetails.cashOnlyCommission + storeDetails.sevaCommission) / 100;
    
    const totalProfit = cashPaymentPart + surabhiCoinsPart;
    
    // Round to 2 decimal places (for currency)
    return Math.round(totalProfit * 100) / 100;
  };

  // Calculate sale details with accurate payment logic
  const calculateSale = () => {
    if (!saleAmount || saleAmount <= 0 || !storeDetails) return null;

    const coinsToUse = selectedCustomer
      ? Math.min(surabhiCoinsToUse, selectedCustomer.surabhiBalance)
      : 0;
    // let totalAmount = saleAmount;
    let walletDeduction = 0;
    let cashPayment = 0;
    let surabhiCoinsEarned = 0;
    let referrerSurabhiCoinsEarned = 0;
    let goSevaContribution = 0;

    const remainingAfterCoins = saleAmount - coinsToUse;

    // For registered customers
    if (!selectedCustomer) return null;

    const walletBalance = selectedCustomer.walletBalance;

    // Payment method logic
    if (paymentMethod === 'wallet') {
      if (walletBalance >= remainingAfterCoins) {
        surabhiCoinsEarned = 0;
        walletDeduction = remainingAfterCoins;
        referrerSurabhiCoinsEarned = 0;
      } else {
        return { isValid: false, error: 'Insufficient wallet balance' };
      }
    } else if (paymentMethod === 'mixed') {
      if (walletBalance < remainingAfterCoins) {
        walletDeduction = walletBalance;
        cashPayment = saleAmount - walletBalance - coinsToUse;
        // Wallet portion gets surabhi commission, cash portion gets cashOnly commission
        surabhiCoinsEarned = Math.floor(
          cashPayment * (storeDetails.cashOnlyCommission / 100));
        referrerSurabhiCoinsEarned = Math.floor(
          cashPayment * (storeDetails.referralCommission / 100)
        );
        goSevaContribution = Math.floor(cashPayment * (storeDetails.sevaCommission / 100));
      } else {
        return { isValid: false, error: 'Mixed is not needed' };
      }
    } else if (paymentMethod === 'cash') {
      cashPayment = saleAmount - coinsToUse;
      surabhiCoinsEarned = Math.floor(cashPayment * (storeDetails.cashOnlyCommission / 100));
      referrerSurabhiCoinsEarned += Math.floor(cashPayment * (storeDetails.referralCommission / 100));
      goSevaContribution = Math.floor(cashPayment * (storeDetails.sevaCommission / 100));
    }

    return {
      totalAmount: saleAmount,
      surabhiCoinsUsed: coinsToUse,
      walletDeduction,
      cashPayment,
      surabhiCoinsEarned,
      goSevaContribution,
      referrerSurabhiCoinsEarned,
      isValid: true
    };
  };

  const saleCalculation = saleAmount ? calculateSale() : null;
    const adminProfitTaken = calculateAdminProfit();

  // console.log("The line 253 is", saleCalculation?.totalAmount)

  const addActivityRecord = async (activityData: Omit<ActivityType, 'id' | 'date'>) => {
    try {
      await addDoc(collection(db, 'Activity'), {
        ...activityData,
        date: new Date()
      });
    } catch (error) {
      console.error('Error adding activity record:', error);
      toast.error('Failed to log activity');
    }
  };

  const handleRegisteredCustomerSale = async () => {
    console.log('Searching for customer with mobile:', selectedCustomer.customerMobile);
    console.log('Selected customer object:', selectedCustomer);
    if (!selectedCustomer || !saleAmount || !saleCalculation || !saleCalculation.isValid) {
      toast.error('Invalid sale calculation');
      return;
    }

    setIsLoading(true);

    try {
      // First check if customer exists in database
      const customersRef = collection(db, "Customers");
      const q = query(customersRef, where("customerMobile", "==", selectedCustomer.customerMobile));
      const querySnapshot = await getDocs(q);
      console.log('Query snapshot empty:', querySnapshot.empty);
      console.log('Query snapshot size:', querySnapshot.size);
      if (querySnapshot.empty) {
        throw new Error('Customer not found in database');
      }
      console.log("Is it comig here in line 259")
      const newWalletBalance = (selectedCustomer.walletBalance) - saleCalculation.walletDeduction;
      const newSurabhiCoins = (selectedCustomer.surabhiBalance) - saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned; 
      console.log("Is it comig here in line 261", newWalletBalance, newSurabhiCoins)
      // Update customer balances
      const customerDoc = querySnapshot.docs[0];
      const customerRef = customerDoc.ref;
      console.log('Customer document in line 266 is', customerRef, newSurabhiCoins, newSurabhiCoins);

      await updateDoc(customerRef, {
        saleElgibility: true,
        walletBalance: newWalletBalance,
        surabhiBalance: newSurabhiCoins,
        lastTransactionDate: serverTimestamp(),
      });

      // Record transaction
      const customerTxData: Partial<CustomerTxType>= {
        type: 'sale',
        customerName: selectedCustomer.customerName,
        customerMobile: selectedCustomer.customerMobile,
        storeLocation: storeLocation,
        storeName: user.storeLocation, 
        createdAt: Timestamp.fromDate(new Date()),
        paymentMethod: paymentMethod,
        processedBy: user.name, 
      
        // Recharge-Specific Fields (with defaults)
        amount: saleAmount,
        surabhiEarned: saleCalculation.surabhiCoinsEarned,
        sevaEarned: saleCalculation.goSevaContribution,
        referralEarned: saleCalculation.referrerSurabhiCoinsEarned,
      
        // Sale-Specific Fields
        surabhiUsed: saleCalculation.surabhiCoinsUsed,
        walletDeduction: saleCalculation.walletDeduction,
        cashPayment: saleCalculation.cashPayment,
        adminProft : saleCalculation.cashPayment * (storeDetails.surabhiCommission - storeDetails.cashOnlyCommission)/100 + saleCalculation.surabhiCoinsUsed*(storeDetails.referralCommission + storeDetails.cashOnlyCommission + storeDetails.sevaCommission)/100,
      
        // Balance information
        previousBalance: {
          walletBalance: selectedCustomer.walletBalance,
          surabhiBalance: selectedCustomer.surabhiBalance,
        },
        newBalance: {
          walletBalance: newWalletBalance,
          surabhiBalance: newSurabhiCoins,
        },
      
        // Transaction amounts
        walletCredit: 0,
        walletDebit: saleCalculation.walletDeduction,
        walletBalance: newWalletBalance,
        surabhiDebit: saleCalculation.surabhiCoinsUsed,
        surabhiCredit: saleCalculation.surabhiCoinsEarned, 
        surabhiBalance: newSurabhiCoins,
        sevaCredit: saleCalculation.goSevaContribution, 
        sevaDebit: 0,
        sevaBalance: selectedCustomer.sevaBalance,
        sevaTotal: selectedCustomer.sevaTotal
      };
      await addDoc(collection(db, 'CustomerTx'), customerTxData);

      // Handle Referrer Income 
      if (selectedCustomer.referredBy && saleCalculation.referrerSurabhiCoinsEarned > 0) {
        try {
          // Find referrer's document
          const customersCollection = collection(db, 'Customers');
          const referrerQuery = query(
            customersCollection,
            where('customerMobile', '==', selectedCustomer.referredBy)
          );
          const referrerSnapshot = await getDocs(referrerQuery);

          if (!referrerSnapshot.empty) {
            const referrerDoc = referrerSnapshot.docs[0];
            const referrerData = referrerDoc.data() as CustomerType;
            const referralAmount = saleCalculation.referrerSurabhiCoinsEarned;

            console.log('Referrer Data:', referrerData);
            console.log('New Referred User:', selectedCustomer.customerName);
            console.log('Referral Amount:', referralAmount);

            // Safely increment referral amount (handle null/NaN)
            const incrementAmount = Number.isNaN(referralAmount) || referralAmount === null ? 0 : referralAmount;

            // Update referrer's data
            await updateDoc(referrerDoc.ref, {
              referralSurabhi: increment(incrementAmount),
              surabhiBalance: increment(incrementAmount)
            });

            // Add activity record for referrer
            await addActivityRecord({
              type: 'referral',
              remarks: `${selectedCustomer.referredBy} got ₹${incrementAmount} referral from ${selectedCustomer.customerName}'s recharge`,
              amount: incrementAmount,
              customerMobile: selectedCustomer.referredBy,
              storeLocation: selectedCustomer.storeLocation,
              customerName: selectedCustomer.customerName,
              createdAt : Timestamp.fromDate(new Date())

            });
          } else {
            console.warn(`Referrer with mobile ${selectedCustomer.referredBy} not found`);
          }
        } catch (error) {
          console.error('Error processing referral:', error);
          // Consider adding error handling/retry logic here
        }
      }

      // Add seva contribution activity record for cash and mixed payments
      if ((paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.goSevaContribution > 0) {
        await addActivityRecord({
          type: 'seva_contribution',
          remarks: `Seva contribution of ₹${saleCalculation.goSevaContribution} from ${selectedCustomer.customerName}'s purchase`,
          amount: saleCalculation.goSevaContribution,
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          storeLocation: storeLocation,
          createdAt: Timestamp.fromDate(new Date())
        });
      }

      // Add AccountTx record(s) based on payment method
      if (paymentMethod === "wallet") {
        const adminCutTx = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
        const accountTxData: Omit<AccountTxType, 'id'> = {
          createdAt: Timestamp.fromDate(new Date()),
          storeName: storeDetails.storeName,
          customerName: selectedCustomer.customerName,
          customerMobile:selectedCustomer.customerMobile,
          adminProfit:adminProfitTaken,
          type: 'sale',
          amount: saleAmount,
          credit: 0,
          debit: saleCalculation.totalAmount - adminCutTx,
          adminCut: adminCutTx,
          currentBalance: (storeDetails.storeCurrentBalance) - saleAmount + adminCutTx,
          sevaBalance: (storeDetails.storeSevaBalance) + saleCalculation.goSevaContribution,
          remarks: `Wallet sale for ${selectedCustomer.customerName} (${selectedCustomer.customerMobile})`,
        };
        await addDoc(collection(db, 'AccountTx'), accountTxData);

//         interface CustomerTxType {
//   id?: string;
//   type: 'recharge' | 'sale';

//   // Common Fields
//   customerMobile: string;
//   customerName: string;
//   storeLocation: string;
//   storeName: string; // Only for recharge
//   createdAt: Timestamp;
//   paymentMethod?: 'cash' | 'wallet' | 'mixed';
//   staffName: string; // Used in recharge
//   processedBy: string; // Used in sale

//   // Recharge-Specific Fields
//   amount: number; // Recharge amount
//   surabhiEarned: number;
//   sevaEarned?: number;
//   referralEarned?: number;
//   referredBy?: string | null;

//   // Sale-Specific Fields
//   surabhiUsed?: number;
//   walletDeduction?: number;
//   cashPayment?: number;

//   previousBalance?: {
//     walletBalance: number;
//     surabhiBalance: number;
//   };

//   newBalance?: {
//     walletBalance: number;
//     surabhiBalance: number;
//   };

//   walletCredit: number;
//   walletDebit: number;
//   walletBalance: number;
//   surabhiDebit: number;
//   surabhiCredit: number;
//   surabhiBalance: number;
//   sevaCredit: number;
//   sevaDebit: number;
//   sevaBalance: number;
//   sevaTotal: number;
// }

        // Create CustomerTx record
        const customerTxData: Omit<Partial<CustomerTxType>, 'id'> = {
          type: 'sale', // Added the required type field
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName, // Added customerName
          // storeLocation: storeLocation,
          storeName: user.storeLocation, 
          createdAt: Timestamp.fromDate(new Date()),
          paymentMethod: paymentMethod, 
          processedBy: user.name, 
          
          // Sale-Specific Fields
          surabhiUsed: saleCalculation.surabhiCoinsUsed,
          walletDeduction: saleCalculation.walletDeduction,
          cashPayment: saleCalculation.cashPayment,
          
          // Balance fields
          previousBalance: {
            walletBalance: selectedCustomer.walletBalance,
            surabhiBalance: selectedCustomer.surabhiBalance
          },
          newBalance: {
            walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
            surabhiBalance: selectedCustomer.surabhiBalance -saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned
          },
          
          // Transaction amounts
          walletCredit: 0,
          walletDebit: saleCalculation.walletDeduction,
          walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
          surabhiDebit: saleCalculation.surabhiCoinsUsed,
          surabhiCredit: saleCalculation.surabhiCoinsEarned,
          surabhiBalance: selectedCustomer.surabhiBalance + saleCalculation.surabhiCoinsEarned,
          sevaCredit: saleCalculation.goSevaContribution,
          sevaDebit: 0,
          sevaBalance: (selectedCustomer.sevaBalanceCurrentMonth) + saleCalculation.goSevaContribution,
          sevaTotal: (selectedCustomer.sevaTotal) + saleCalculation.goSevaContribution,
        };

        await addDoc(collection(db, 'CustomerTx'), customerTxData);
        // Update store balance
        const storeQueryWallet = query(
          collection(db, 'stores'),
          where('storeName', '==', user.storeLocation)
        );
        const storeSnapshotWallet = await getDocs(storeQueryWallet);
        if (!storeSnapshotWallet.empty) {
          const storeDoc = storeSnapshotWallet.docs[0];
          const storeData = storeDoc.data();
          const currentBalanceIncrement = accountTxData.currentBalance - storeData.storeCurrentBalance;
          const sevaBalanceIncrement = accountTxData.sevaBalance - storeData.storeSevaBalance;
          
          await updateDoc(storeDoc.ref, {
            storeCurrentBalance: increment(currentBalanceIncrement),
            storeSevaBalance: increment(sevaBalanceIncrement),
            updatedAt: serverTimestamp()
          });
          
          console.log(`Updated store balances: Current ${currentBalanceIncrement > 0 ? '+' : ''}${currentBalanceIncrement}, Seva ${sevaBalanceIncrement > 0 ? '+' : ''}${sevaBalanceIncrement}`);
          console.log(`New store balances: Current ${storeData.storeCurrentBalance + currentBalanceIncrement}, Seva ${storeData.storeSevaBalance + sevaBalanceIncrement}`);
        }
      } else
        if (paymentMethod === 'cash') {
          const adminCutTx = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
          const accountTxData: Omit<AccountTxType, 'id'> = {
            createdAt: Timestamp.fromDate(new Date()),
            storeName: storeDetails.storeName,
            type: 'sale',
            amount: saleAmount,
            customerName: selectedCustomer.customerName,
            customerMobile: selectedCustomer.customerMobile,
            credit: saleCalculation.cashPayment,
            adminCut: adminCutTx,
            adminProfit: adminProfitTaken,
            debit: saleCalculation.totalAmount - adminCutTx,
            sevaBalance: (Number(storeDetails?.storeSevaBalance) || 0) + 
            (Number(saleCalculation?.goSevaContribution) || 0),
            currentBalance: (Number(storeDetails?.storeCurrentBalance) || 0) + 
            (Number(saleCalculation?.cashPayment) || 0) - 
            (Number(saleCalculation?.totalAmount) || 0) + 
            (Number(adminCutTx) || 0), // balance + credit + debot
            remarks: `Cash sale for ${selectedCustomer.customerName} (${selectedCustomer.customerMobile})`,
          }
          await addDoc(collection(db, 'AccountTx'), accountTxData);


          // Fetch current SevaPool data to increment balance properly
          const poolRef = doc(db, 'SevaPool', 'main');
          const poolDoc = await getDoc(poolRef);
          const sevaPool = poolDoc.data();

          await updateDoc(poolRef, {
            currentSevaBalance: (sevaPool.currentSevaBalance) + saleCalculation.goSevaContribution,
            contributionsCurrentMonth: increment(1),
            totalContributions:increment(1),
            totalAllocations: sevaPool.totalAllocations,
            allocationsCurrentMonth: sevaPool.allocationsCurrentMonth,
            lastAllocatedDate: serverTimestamp()
          });

          // Create CustomerTx record
          // const customerTxData: Omit<Partial<CustomerTxType>, 'id'> = {
          //   createdAt: Timestamp.fromDate(new Date()),
          //   type: 'sale',
          //   customerName: selectedCustomer.customerName,
          //   customerMobile: selectedCustomer.customerMobile,
          //   storeName: storeDetails.storeName,
          //   storeLocation: storeLocation,
          //   processedBy: user.name,
          //   walletCredit: 0,
          //   walletDebit: saleCalculation.walletDeduction,
          //   walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
          //   surabhiDebit: saleCalculation.surabhiCoinsUsed,
          //   surabhiCredit: saleCalculation.surabhiCoinsEarned,
          //   surabhiBalance: selectedCustomer.surabhiBalance + saleCalculation.surabhiCoinsEarned,
          //   sevaCredit: saleCalculation.goSevaContribution,
          //   sevaDebit: 0,
          //   sevaBalance: (selectedCustomer.sevaBalanceCurrentMonth) + saleCalculation.goSevaContribution,
          //   sevaTotal: (selectedCustomer.sevaBalance) + saleCalculation.goSevaContribution
          // };

          const customerTxData: Omit<Partial<CustomerTxType>, 'id'> = {
            type: 'sale', // Added the required type field
            customerMobile: selectedCustomer.customerMobile,
            customerName: selectedCustomer.customerName, // Added customerName
            // storeLocation: storeLocation,
            storeName: user.storeLocation, 
            createdAt: Timestamp.fromDate(new Date()),
            paymentMethod: paymentMethod, 
            processedBy: user.name, 
            
            // Sale-Specific Fields
            surabhiUsed: saleCalculation.surabhiCoinsUsed,
            walletDeduction: saleCalculation.walletDeduction,
            cashPayment: saleCalculation.cashPayment,
            
            // Balance fields
            previousBalance: {
              walletBalance: selectedCustomer.walletBalance,
              surabhiBalance: selectedCustomer.surabhiBalance
            },
            newBalance: {
              walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
              surabhiBalance: selectedCustomer.surabhiBalance -saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned
            },
            
            // Transaction amounts
            walletCredit: 0,
            walletDebit: saleCalculation.walletDeduction,
            walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
            surabhiDebit: saleCalculation.surabhiCoinsUsed,
            surabhiCredit: saleCalculation.surabhiCoinsEarned,
            surabhiBalance: selectedCustomer.surabhiBalance + saleCalculation.surabhiCoinsEarned,
            sevaCredit: saleCalculation.goSevaContribution,
            sevaDebit: 0,
            sevaBalance: (selectedCustomer.sevaBalanceCurrentMonth) + saleCalculation.goSevaContribution,
            sevaTotal: (selectedCustomer.sevaTotal) + saleCalculation.goSevaContribution,
          };

          await addDoc(collection(db, 'CustomerTx'), customerTxData);

          // Update store balance
          const storeQuery = query(
            collection(db, 'stores'),
            where('storeName', '==', user.storeLocation)
          );
          const storeSnapshot = await getDocs(storeQuery);
          if (!storeSnapshot.empty) {
            const storeDoc = storeSnapshot.docs[0];
            const storeData = storeDoc.data();
            const currentBalanceIncrement = accountTxData.currentBalance - storeData.storeCurrentBalance;
            const sevaBalanceIncrement = accountTxData.sevaBalance - storeData.storeSevaBalance;
            
            await updateDoc(storeDoc.ref, {
              storeCurrentBalance: increment(currentBalanceIncrement),
              storeSevaBalance: increment(sevaBalanceIncrement),
              updatedAt: serverTimestamp()
            });
            
            console.log(`Updated store balances (cash sale): Current ${currentBalanceIncrement > 0 ? '+' : ''}${currentBalanceIncrement}, Seva ${sevaBalanceIncrement > 0 ? '+' : ''}${sevaBalanceIncrement}`);
            console.log(`New store balances: Current ${storeData.storeCurrentBalance + currentBalanceIncrement}, Seva ${storeData.storeSevaBalance + sevaBalanceIncrement}`);
          }
        } else {
          // Mixed payment - create two separate records

          // 1. Wallet portion record
          // if (saleCalculation.walletDeduction > 0) {
          //   const walletAdminCut = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
          //   const walletTxData: Omit<AccountTx, 'id'> = {
          //     date: Timestamp.fromDate(new Date()),
          //     storeName: storeDetails.name,
          //     type: 'sale',
          //     amount: saleCalculation.totalAmount,
          //     debit: saleCalculation.walletDeduction - walletAdminCut,
          //     adminCut: walletAdminCut,
          //     credit: 0,
          //     balance: storeDetails.currentBalance - saleCalculation.walletDeduction - walletAdminCut,
          //     description: `Wallet portion (${saleCalculation.walletDeduction}) of mixed payment for ${selectedCustomer.name}`,
          //     settled: false
          //   };
          //   await addDoc(collection(db, 'AccountTx'), walletTxData);
          // }

          // 2. Cash portion record
          // if (saleCalculation.cashPayment > 0) {
          //   const cashAdminCut = calculateAdminCut(saleCalculation.cashPayment, storeDetails, saleCalculation.surabhiCoinsUsed);
          //   const cashTxData: Omit<AccountTx, 'id'> = {
          //     date: Timestamp.fromDate(new Date()),
          //     storeName: storeDetails.name,
          //     type: 'sale',
          //     amount: saleCalculation.cashPayment,
          //     credit: saleCalculation.cashPayment,
          //     debit: cashAdminCut,
          //     balance: storeDetails.currentBalance + saleCalculation.cashPayment - cashAdminCut,
          //     description: `Cash portion (${saleCalculation.cashPayment}) of mixed payment for ${selectedCustomer.name}`,
          //     settled: false
          //   };
          //   await addDoc(collection(db, 'AccountTx'), cashTxData);
          //   const poolRef = doc(db, 'SevaPool', 'main');
          //   await updateDoc(poolRef, {
          //     currentBalance: sevaPool.currentBalance + saleCalculation.goSevaContribution,
          //     totalAllocations: sevaPool.totalAllocations,
          //     allocationsCurrentMonth: sevaPool.allocationsCurrentMonth,
          //     lastAllocatedDate: serverTimestamp()
          //   });
          // }

          if (saleCalculation.cashPayment > 0) {
            const adminCutTx = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
            const cashTxData: Omit<AccountTxType, 'id'> = {
              createdAt: Timestamp.fromDate(new Date()),
              storeName: storeDetails.storeName,
              type: 'sale',
              amount: saleAmount,
              customerName: selectedCustomer.customerName,
              customerMobile: selectedCustomer.customerMobile,
              adminCut: adminCutTx,
              adminProfit: adminProfitTaken,
              credit: saleCalculation.cashPayment,
              debit: saleCalculation.totalAmount - adminCutTx,
              currentBalance: (Number(storeDetails?.storeCurrentBalance) || 0) + 
    (Number(saleCalculation?.cashPayment) || 0) - 
    (Number(saleCalculation?.totalAmount) || 0) + 
    (Number(adminCutTx) || 0),         
              sevaBalance: (Number(storeDetails?.storeSevaBalance) || 0) + 
    (Number(saleCalculation?.goSevaContribution) || 0),
              remarks: `Mixed sale ₹${saleCalculation.totalAmount} with cash of ₹${saleCalculation.cashPayment} and wallet of ₹${saleCalculation.walletDeduction} by ${selectedCustomer.customerName}`, 
            };


            await addDoc(collection(db, 'AccountTx'), cashTxData);
            const poolRef = doc(db, 'SevaPool', 'main');
            const poolDoc = await getDoc(poolRef);
            const sevaPool = poolDoc.data();

            await updateDoc(poolRef, {
              currentSevaBalance: (sevaPool.currentSevaBalance) + saleCalculation.goSevaContribution,
              contributionsCurrentMonth:increment(1),
              totalContributions:increment(1),
              totalAllocations: sevaPool.totalAllocations,
              allocationsCurrentMonth: sevaPool.allocationsCurrentMonth,
              lastAllocatedDate: serverTimestamp()
            });


            // Create CustomerTx record
            // const customerTxData: Omit<CustomerTxType>, 'id'> = {
            //   createdAt: Timestamp.fromDate(new Date()),
            //   customerMobile: selectedCustomer.customerMobile,
            //   storeLocation: storeLocation,
            //   walletCredit: 0,
            //   walletDebit: saleCalculation.walletDeduction,
            //   walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
            //   surabhiDebit: saleCalculation.surabhiCoinsUsed,
            //   surabhiCredit: saleCalculation.surabhiCoinsEarned,
            //   surabhiBalance: selectedCustomer.surabhiBalance + saleCalculation.surabhiCoinsEarned,
            //   sevaCredit: saleCalculation.goSevaContribution,
            //   sevaDebit: 0,
            //   sevaBalance: selectedCustomer.sevaBalance + saleCalculation.goSevaContribution,
            //   sevaTotal: selectedCustomer.sevaTotal + saleCalculation.goSevaContribution
            // };

            const customerTxData: Omit<Partial<CustomerTxType>, 'id'> = {
              type: 'sale', // Added the required type field
              customerMobile: selectedCustomer.customerMobile,
              customerName: selectedCustomer.customerName, // Added customerName
              // storeLocation: storeLocation,
              storeName: user.storeLocation, 
              createdAt: Timestamp.fromDate(new Date()),
              paymentMethod: paymentMethod, 
              processedBy: user.name, 
              
              // Sale-Specific Fields
              surabhiUsed: saleCalculation.surabhiCoinsUsed,
              walletDeduction: saleCalculation.walletDeduction,
              cashPayment: saleCalculation.cashPayment,
              
              // Balance fields
              previousBalance: {
                walletBalance: selectedCustomer.walletBalance,
                surabhiBalance: selectedCustomer.surabhiBalance
              },
              newBalance: {
                walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
                surabhiBalance: selectedCustomer.surabhiBalance -saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned
              },
              
              // Transaction amounts
              walletCredit: 0,
              walletDebit: saleCalculation.walletDeduction,
              walletBalance: selectedCustomer.walletBalance - saleCalculation.walletDeduction,
              surabhiDebit: saleCalculation.surabhiCoinsUsed,
              surabhiCredit: saleCalculation.surabhiCoinsEarned,
              surabhiBalance: selectedCustomer.surabhiBalance + saleCalculation.surabhiCoinsEarned,
              sevaCredit: saleCalculation.goSevaContribution,
              sevaDebit: 0,
              sevaBalance: (selectedCustomer.sevaBalanceCurrentMonth) + saleCalculation.goSevaContribution,
              sevaTotal: (selectedCustomer.sevaTotal) + saleCalculation.goSevaContribution,
            };
            

            await addDoc(collection(db, 'CustomerTx'), customerTxData);

            // Update store balance
            const storeQuery = query(
              collection(db, 'stores'),
              where('storeName', '==', user.storeLocation)
            );
            const storeSnapshot = await getDocs(storeQuery);
            if (!storeSnapshot.empty) {
              const storeDoc = storeSnapshot.docs[0];
              const storeData = storeDoc.data();
              const currentBalanceIncrement = cashTxData.currentBalance - storeData.storeCurrentBalance;
              const sevaBalanceIncrement = cashTxData.sevaBalance - storeData.storeSevaBalance;
              
              await updateDoc(storeDoc.ref, {
                storeCurrentBalance: increment(currentBalanceIncrement),
                storeSevaBalance: increment(sevaBalanceIncrement),
                updatedAt: serverTimestamp()
              });
              
              console.log(`Updated store balances (cash payment): Current ${currentBalanceIncrement > 0 ? '+' : ''}${currentBalanceIncrement}, Seva ${sevaBalanceIncrement > 0 ? '+' : ''}${sevaBalanceIncrement}`);
              console.log(`New store balances: Current ${storeData.storeCurrentBalance + currentBalanceIncrement}, Seva ${storeData.storeSevaBalance + sevaBalanceIncrement}`);
            }
          }

        }

      const staffCollection = collection(db, 'staff');
      const staffQuery = query(staffCollection, where('staffMobile', '==', user.mobile));
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        throw new Error('Staff member not found in database');
      }

      const staffDoc = staffSnapshot.docs[0];
      const staffRef = staffDoc.ref;

      // Validate updateData against StaffType interface
      const staffUpdates: Partial<StaffType> = {
        staffSalesCount: increment(1) as unknown as number,
        lastActive: Timestamp.fromDate(new Date())
      };

      await updateDoc(staffRef, staffUpdates);

      // Handle Referrer Income - Only for cash or mixed payments
    if (
      (paymentMethod === 'cash' || paymentMethod === 'mixed') &&
      selectedCustomer.referredBy && 
      saleCalculation.referrerSurabhiCoinsEarned > 0
    ) {
      try {
        // Find referrer's document
        const referrer = await fetchCustomerByMobile(selectedCustomer.referredBy);
        
        if (referrer) {
          const referralAmount = saleCalculation.referrerSurabhiCoinsEarned;
          const referrerRef = doc(db, 'Customers', referrer.id); // Assuming you have id field
          console.log("The referrer id is", referrerRef);
          // Update referrer's balances
          await updateDoc(referrerRef, {
            surabhiBalance: increment(referralAmount),
            referralSurabhi: increment(referralAmount),
            updatedAt: serverTimestamp()
          });

          // Add activity record for referrer
          await addActivityRecord({
            type: 'referral',
            remarks: `${selectedCustomer.referredBy} got ₹${referralAmount} referral from ${selectedCustomer.customerName}'s purchase`,
            amount: referralAmount,
            customerMobile: selectedCustomer.referredBy,
            storeLocation: storeLocation,
            customerName: referrer.customerName,
            createdAt: Timestamp.fromDate(new Date())
          });

          toast.success(`Referral bonus of ₹${referralAmount} credited to ${referrer.customerName}`);
        } else {
          console.warn(`Referrer with mobile ${selectedCustomer.referredBy} not found`);
          toast.warning(`Referrer not found - bonus not credited`);
        }
      } catch (error) {
        console.error('Error processing referral:', error);
        toast.error('Failed to process referral bonus');
      }
    }

      // Record activity
      const activity: ActivityType = {
        type: 'sale',
        remarks: `${paymentMethod} Purchase of ₹${saleCalculation.totalAmount} by ${selectedCustomer.customerName}`,
        amount: saleCalculation.totalAmount,
        customerName: selectedCustomer.customerName,
        customerMobile: selectedCustomer.customerMobile,
        storeLocation: storeLocation,
        createdAt: Timestamp.fromDate(new Date())
      };

      await addDoc(collection(db, 'Activity'), activity);

      // Update local state
      setCustomers(customers.map(c =>
        c.customerMobile === selectedCustomer.customerMobile ?
          {
            ...c,
            walletBalance: newWalletBalance,
            surabhiBalance: newSurabhiCoins,
            lastTransactionDate: Timestamp.fromDate(new Date())
          } : c
      ));

      toast.success(`Sale of ₹${saleAmount} completed successfully!`);

      // Reset form
      setSaleAmount(undefined);
      setPaymentMethod('wallet');
      setSurabhiCoinsToUse(0);
      setSelectedCustomer(null);
      setSearchTerm('');

    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Sale failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSale = async () => {
    if (!selectedCustomer || !saleAmount) {
      toast.error('Please select a customer and enter sale amount');
      return;
    }

    if (paymentMethod === 'wallet') {
      const remainingAfterCoins = saleAmount - (saleCalculation.surabhiCoinsUsed);
      if ((selectedCustomer.walletBalance) < remainingAfterCoins) {
        toast.error('Insufficient wallet balance for this payment method');
        return;
      }
    }
    console.log("Is it comign here in line 770");
    await handleRegisteredCustomerSale();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Management</h2>
          <p className="text-gray-600">Process customer purchases at {storeLocation}</p>
          {storeDetails && (
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              <Badge variant="outline" className="border-blue-200 text-blue-800">
                Referral: {storeDetails.referralCommission}%
              </Badge>
              <Badge variant="outline" className="border-green-200 text-green-800">
                Surabhi: {storeDetails.surabhiCommission}%
              </Badge>
              <Badge variant="outline" className="border-red-200 text-red-800">
                Cash Only: {storeDetails.cashOnlyCommission}%
              </Badge>
              <Badge variant="outline" className="border-purple-200 text-purple-800">
                Seva: {storeDetails.sevaCommission}%
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Selection */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Select Customer
            </CardTitle>
            <CardDescription>
              Search and select customer for sale transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or mobile number"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isFetchingCustomers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      // Check if customer is registered at the same store as the current user
                      const isSameStore = customer.storeLocation === user.storeLocation;
                      setIsRegisteredAtSameStore(isSameStore);
                      // Reset payment method to cash if not from same store
                      if (!isSameStore) {
                        setPaymentMethod('cash');
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedCustomer?.customerMobile === customer.customerMobile
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{customer.customerName}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{customer.customerMobile}</span>
                        </div>
                        {customer.referredBy && <div className="flex items-center gap-2 text-sm text-gray-600">
                          <HandCoins className="h-3 w-3" />
                          <span> {customer.referredBy}</span>
                        </div>}
                      </div>
                      <div className="text-right text-sm">
                        <div className="flex items-center justify-end gap-2 mb-1">
                          {customer.storeLocation === user.storeLocation ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs font-medium">Same Store</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-orange-600">
                              <Phone className="h-3 w-3" />
                              <span className="text-xs font-medium">Other Store</span>
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-green-600">₹{customer.walletBalance}</p>
                        <p className="text-amber-600">{customer.surabhiBalance} Surabhi Balance</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No customers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              Process Sale
            </CardTitle>
            <CardDescription>
              Enter sale details and payment method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedCustomer ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Customer Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Wallet Balance</p>
                      <p className="font-bold">₹{selectedCustomer.walletBalance}</p>
                    </div>
                    <div>
                      <p className="text-amber-700">Surabhi Coins</p>
                      <p className="font-bold">{selectedCustomer.surabhiBalance}</p>
                    </div>
                    <div>
                      <p className="text-purple-700">Last Purchase</p>
                      <p className="font-bold">
                        {selectedCustomer.lastTransactionDate
                          ? selectedCustomer.lastTransactionDate.toDate
                            ? new Date(selectedCustomer.lastTransactionDate.toDate()).toLocaleString()
                            : selectedCustomer.lastTransactionDate instanceof Timestamp
                              ? selectedCustomer.lastTransactionDate.toDate().toLocaleString()
                              : typeof selectedCustomer.lastTransactionDate === 'string'
                                ? new Date(selectedCustomer.lastTransactionDate).toLocaleString()
                                : 'Never'
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Sale Amount (₹) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter sale amount"
                        value={saleAmount || ''}
                        onChange={(e) => setSaleAmount(Number(e.target.value))}
                        className="pl-10 h-12"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  {selectedCustomer && selectedCustomer.surabhiBalance > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="coins">Use Surabhi Coins</Label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="coins"
                          type="number"
                          placeholder="Enter coins to use"
                          value={surabhiCoinsToUse}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const maxCoins = Math.min(
                              selectedCustomer.surabhiBalance,
                              saleAmount
                            );
                            setSurabhiCoinsToUse(Math.max(0, Math.min(value, maxCoins)));
                          }}
                          className="pl-10 h-12"
                          min="0"
                          max={selectedCustomer.surabhiBalance}
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {selectedCustomer.surabhiBalance} coins (Using {surabhiCoinsToUse})
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="payment">Payment Method *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as 'wallet' | 'cash' | 'mixed')}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {isRegisteredAtSameStore && (
                          <SelectItem value="wallet">Wallet Only</SelectItem>
                        )}
                        <SelectItem value="cash">Cash Only</SelectItem>
                        {isRegisteredAtSameStore && (
                          <SelectItem value="mixed">Wallet + Cash</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {paymentMethod === 'wallet' && (
                      <p className="text-xs text-blue-600">
                        Full amount (after coins) will be deducted from wallet
                      </p>
                    )}
                    {paymentMethod === 'cash' && (
                      <p className="text-xs text-blue-600">
                        Full amount (after coins) will be paid in cash
                      </p>
                    )}
                    {paymentMethod === 'mixed' && (
                      <p className="text-xs text-blue-600">
                        Maximum wallet amount will be used first, then cash
                      </p>
                    )}
                  </div>
                </div>

                {saleCalculation && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">Transaction Summary</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium text-purple-900">Total Amount</span>
                        <span className="font-bold text-purple-600">₹{saleCalculation.totalAmount}</span>
                      </div>

                      {saleCalculation.surabhiCoinsUsed > 0 && (
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <span className="text-sm font-medium text-amber-900">Surabhi Coins Used</span>
                          <span className="font-bold text-amber-600">-{saleCalculation.surabhiCoinsUsed}</span>
                        </div>
                      )}

                      {saleCalculation.walletDeduction > 0 && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-medium text-blue-900">Wallet Deduction</span>
                          <span className="font-bold text-blue-600">₹{saleCalculation.walletDeduction}</span>
                        </div>
                      )}

                      {saleCalculation.cashPayment > 0 && (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">Cash Payment</span>
                          <span className="font-bold text-green-600">₹{saleCalculation.cashPayment}</span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.surabhiCoinsEarned > 0 && (
                        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                          <span className="text-sm font-medium text-indigo-900">Surabhi Coins Earned  {paymentMethod === 'cash' || paymentMethod === 'mixed' ? storeDetails.cashOnlyCommission : storeDetails.surabhiCommission}%</span>
                          <span className="font-bold text-indigo-600">+{saleCalculation.surabhiCoinsEarned} </span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.goSevaContribution > 0 && (
                        <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                          <span className="text-sm font-medium text-pink-900">Seva Contribution  {storeDetails.sevaCommission}%</span>
                          <span className="font-bold text-pink-600">+{saleCalculation.goSevaContribution} </span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') && saleCalculation.referrerSurabhiCoinsEarned > 0 && selectedCustomer.referredBy && (
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <span className="text-sm font-medium text-yellow-900">Referral Bonus  {storeDetails.referralCommission}%</span>
                          <span className="font-bold text-yellow-600">+{saleCalculation.referrerSurabhiCoinsEarned} Referral to {selectedCustomer.referredBy} </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <>
                  <Button
                    onClick={handleSaleWithTPIN}
                    disabled={isLoading || !saleAmount ||
                      (selectedCustomer && !paymentMethod) ||
                      (saleCalculation && !saleCalculation.isValid)}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Process Sale
                  </Button>

                  {/* TPIN Verification Modal */}
                  {showTPINModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white p-6 rounded-lg max-w-md w-full">
                        <h3 className="text-lg font-medium mb-4">TPIN Verification</h3>
                        <p className="mb-4">Please enter the customer's TPIN to proceed with the sale.</p>
                        <input
                          type="password"
                          value={enteredTPIN}
                          onChange={(e) => setEnteredTPIN(e.target.value)}
                          className="w-full p-2 border rounded mb-4"
                          placeholder="Enter TPIN"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setShowTPINModal(false);
                              setEnteredTPIN("");
                            }}
                            className="px-4 py-2 border rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={verifyTPINAndProcess}
                            className="px-4 py-2 bg-green-600 text-white rounded"
                          >
                            Verify
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">
                  Select a Customer
                </p>
                <p className="text-sm">
                  Choose a customer from the list to process a sale
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};