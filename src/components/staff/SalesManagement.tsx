import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Calculator,
  CheckCircle,
  HandCoins,
  Loader2,
  Phone,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/auth-context';
import { decryptText, isEncrypted } from '@/lib/encryption';
import { db } from '@/lib/firebase';
import {
  AccountTxType,
  ActivityType,
  CustomerTxType,
  CustomerType,
  SalesManagementProps,
  SevaPoolType,
  StaffType,
  StoreType,
} from '@/types/types';
import { hasMetQuarterlyTarget, updateCustomerQuarterlyTarget } from '@/utils/quarterlyTargets';

// Custom rounding function: floor if decimal < 0.5, ceil if decimal >= 0.5
const customRound = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const fetchCustomerByMobile = async (mobile: string): Promise<CustomerType | null> => {
  try {
    const q = query(collection(db, 'Customers'), where('customerMobile', '==', mobile));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as CustomerType;
    }
    return null;
  } catch (error) {
    // console.error('Error fetching referrer:', error);
    return null;
  }
};

const calculateAdminCut = (saleAmount: number, storeDetails: StoreType) => {
  if (!storeDetails) return 0;
  // Use the maximum of surabhiCommission and cashOnlyCommission for surabhiAmount
  const maxCommission = Math.max(storeDetails.surabhiCommission, storeDetails.cashOnlyCommission);
  const surabhiAmount = customRound(saleAmount * (maxCommission / 100));
  const referralAmount = customRound(saleAmount * (storeDetails.referralCommission / 100));
  const sevaAmount = customRound(saleAmount * (storeDetails.sevaCommission / 100));
  // console.log('The line 74 data is', surabhiAmount, referralAmount, sevaAmount);
  return referralAmount + sevaAmount + surabhiAmount;
};

// Generate a unique invoice ID or use the provided one
const generateInvoiceId = (storePrefix: string) => {
  const timestamp = new Date().getTime();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${storePrefix}-${timestamp}-${randomStr}`;
};

export const SalesManagement = ({ storeLocation, demoStore }: SalesManagementProps) => {
  const { user } = useAuth();
  // console.log('The user in line 61 is', demoStore);
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
  const [enteredTPIN, setEnteredTPIN] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  const [_sevaPool] = useState<SevaPoolType>({
    currentSevaBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: Timestamp.now(),
    lastAllocatedDate: Timestamp.now(),
  });

  const handleSaleWithTPIN = async () => {
    if (selectedCustomer.tpin) {
      setShowTPINModal(true);
    } else {
      handleSale();
    }
  };

  const verifyTPINAndProcess = () => {
    try {
      const enteredTPINStr = String(enteredTPIN).trim();
      const storedTPIN = selectedCustomer.tpin;

      let isValidTPIN = false;

      // Since all TPINs are encrypted, decrypt the stored TPIN and compare
      if (isEncrypted(storedTPIN)) {
        const decryptedStoredTPIN = decryptText(storedTPIN);
        isValidTPIN = enteredTPINStr === decryptedStoredTPIN;
      } else {
        // Fallback for any unencrypted TPINs (direct comparison)
        isValidTPIN = enteredTPINStr === storedTPIN;
      }

      console.log('TPIN verification:', {
        entered: enteredTPINStr,
        storedEncrypted: storedTPIN,
        isEncrypted: isEncrypted(storedTPIN),
        isValid: isValidTPIN,
      });

      if (isValidTPIN) {
        setShowTPINModal(false);
        setEnteredTPIN('');
        handleSale();
      } else {
        toast.error('Invalid TPIN. Please try again.');
        setEnteredTPIN('');
      }
    } catch (error) {
      console.error('TPIN verification error:', error);
      toast.error('TPIN verification failed. Please try again.');
      setEnteredTPIN('');
    }
  };

  // Fetch customers from Firestore
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        // Fetch customers
        const customersCollection = collection(db, 'Customers');
        // console.log('The line 120 data is', demoStore);
        const custQuery = query(customersCollection, where('demoStore', '==', demoStore));
        const querySnapshot = await getDocs(custQuery);
        const customersData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...(data as CustomerType),
            mobile: data.mobile, // Using mobile as identifier
            // Ensure required properties exist with defaults
            cumTotal: data.cumTotal || 0,
            joinedDate: data.joinedDate || data.createdAt || Timestamp.now(),
            cummulativeTarget: data.cummulativeTarget || 0,
            insFrozen: data.coinsFrozen || false,
          };
        });
        setCustomers(customersData);
      } catch (error) {
        toast.error('Failed to fetch customers');
        // console.error('Error fetching customers:', error);
      } finally {
        setIsFetchingCustomers(false);
      }
    };

    fetchCustomers();
  }, [demoStore]);

  // Real-time listener for store details
  useEffect(() => {
    if (!storeLocation) return;

    const storeQuery = query(
      collection(db, 'stores'),
      where('storeStatus', '==', 'active'),
      where('storeName', '==', storeLocation),
      where('demoStore', '==', demoStore)
    );

    const unsubscribe = onSnapshot(
      storeQuery,
      querySnapshot => {
        if (!querySnapshot.empty) {
          const storeDoc = querySnapshot.docs[0];
          const storeData = {
            ...(storeDoc.data() as StoreType),
            id: storeDoc.id,
          };
          setStoreDetails(storeData);
        } else {
          toast.error('No stores found with that name');
        }
      },
      error => {
        toast.error('Failed to fetch store details');
        // console.error('Error listening to store updates:', error);
      }
    );

    return () => unsubscribe();
  }, [storeLocation, demoStore]);

  const filteredCustomers = customers.filter(
    customer =>
      (customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customerMobile.includes(searchTerm)) &&
      customer.demoStore === demoStore
  );
  // console.log(
  //   'The log values in line 225 are',
  //   selectedCustomer?.coinsFrozen,
  //   selectedCustomer?.cumTotal,
  //   selectedCustomer?.quartersPast
  // );
  // Automatically use all available Surabhi coins if customer is selected
  useEffect(() => {
    if (selectedCustomer && saleAmount && saleAmount > 0) {
      const maxCoinsToUse = Math.floor(Math.min(selectedCustomer.surabhiBalance, saleAmount));
      setSurabhiCoinsToUse(maxCoinsToUse);
    } else {
      setSurabhiCoinsToUse(0);
    }
  }, [selectedCustomer, saleAmount]);

  const calculateAdminProfit = () => {
    if (!saleCalculation) return 0;

    const cashPaymentPart =
      (saleCalculation.cashPayment *
        (storeDetails.surabhiCommission - storeDetails.cashOnlyCommission)) /
      100;
    // console.log('THe line 211 data is', cashPaymentPart);
    const surabhiCoinsPart =
      (saleCalculation.surabhiCoinsUsed *
        (storeDetails.referralCommission +
          storeDetails.surabhiCommission +
          storeDetails.sevaCommission)) /
      100;

    const totalProfit = cashPaymentPart + surabhiCoinsPart;
    // console.log('The line 219 data is', totalProfit);

    // Round to 2 decimal places (for currency)
    return Number(totalProfit.toFixed(2));
  };

  // Calculate sale details with accurate payment logic
  const calculateSale = () => {
    if (!saleAmount || saleAmount <= 0 || !storeDetails) return null;

    // Check if customer has met quarterly target before allowing coin usage
    let coinsToUse = 0;
    if (selectedCustomer) {
      try {
        // Ensure customer has required properties with defaults
        const customerWithDefaults = {
          ...selectedCustomer,
          cumTotal: selectedCustomer.cumTotal || 0,
        };

        if (hasMetQuarterlyTarget(customerWithDefaults)) {
          coinsToUse = customRound(Math.min(surabhiCoinsToUse, selectedCustomer.surabhiBalance));
        } else {
          // If target not met, coins are frozen - no coin usage allowed
          if (surabhiCoinsToUse > 0) {
            return {
              isValid: false,
              error:
                'Quarterly sales target not met. Surabhi coins are frozen until target is achieved.',
            };
          }
          coinsToUse = 0;
        }
      } catch (error) {
        // console.error('Error checking quarterly target:', error);
        // If there's an error, allow coin usage to prevent blocking sales
        coinsToUse = customRound(Math.min(surabhiCoinsToUse, selectedCustomer.surabhiBalance));
      }
    }
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
        surabhiCoinsEarned = customRound(cashPayment * (storeDetails.cashOnlyCommission / 100));
        referrerSurabhiCoinsEarned = customRound(
          cashPayment * (storeDetails.referralCommission / 100)
        );
        goSevaContribution = customRound(cashPayment * (storeDetails.sevaCommission / 100));
      } else {
        return { isValid: false, error: 'Mixed is not needed' };
      }
    } else if (paymentMethod === 'cash') {
      cashPayment = Number((saleAmount - coinsToUse).toFixed(2));
      surabhiCoinsEarned = customRound(cashPayment * (storeDetails.cashOnlyCommission / 100));
      referrerSurabhiCoinsEarned += customRound(
        cashPayment * (storeDetails.referralCommission / 100)
      );
      goSevaContribution = customRound(cashPayment * (storeDetails.sevaCommission / 100));
    }

    return {
      totalAmount: Number(saleAmount.toFixed(2)),
      surabhiCoinsUsed: coinsToUse, // Already rounded to 2 decimal places from customRound
      walletDeduction: Number(walletDeduction.toFixed(2)),
      cashPayment: Number(cashPayment.toFixed(2)),
      surabhiCoinsEarned: Number(surabhiCoinsEarned.toFixed(2)), // Already rounded to 2 decimal places from customRound
      goSevaContribution: Number(goSevaContribution.toFixed(2)), // Already rounded to 2 decimal places from customRound
      referrerSurabhiCoinsEarned: Number(referrerSurabhiCoinsEarned.toFixed(2)), // Already rounded to 2 decimal places from customRound
      isValid: true,
    };
  };

  const saleCalculation = saleAmount ? calculateSale() : null;
  const adminProfitTaken = calculateAdminProfit();
  // console.log('THe adminProfit taken is', adminProfitTaken);

  // console.log("The line 253 is", saleCalculation?.totalAmount)

  const addActivityRecord = async (activityData: Omit<ActivityType, 'id' | 'date'>) => {
    try {
      await addDoc(collection(db, 'Activity'), {
        ...activityData,
        date: new Date(),
      });
    } catch (error) {
      // console.error('Error adding activity record:', error);
      toast.error('Failed to log activity');
    }
  };

  const handleRegisteredCustomerSale = async () => {
    // console.log('Searching for customer with mobile:', selectedCustomer.customerMobile);
    // console.log('Selected customer object:', selectedCustomer);
    if (!selectedCustomer || !saleAmount || !saleCalculation || !saleCalculation.isValid) {
      toast.error('Invalid sale calculation');
      return;
    }

    setIsLoading(true);

    try {
      // First check if customer exists in database
      const customersRef = collection(db, 'Customers');
      const q = query(customersRef, where('customerMobile', '==', selectedCustomer.customerMobile));
      const querySnapshot = await getDocs(q);
      // console.log('Query snapshot empty:', querySnapshot.empty);
      // console.log('Query snapshot size:', querySnapshot.size);
      if (querySnapshot.empty) {
        throw new Error('Customer not found in database');
      }
      // Check if user-provided invoiceId already exists in the database
      let txInvoiceId;
      if (invoiceId) {
        // Query CustomerTx collection to check if invoiceId already exists
        const txQuery = query(collection(db, 'CustomerTx'), where('invoiceId', '==', invoiceId));
        const txSnapshot = await getDocs(txQuery);

        if (!txSnapshot.empty) {
          // Invoice ID already exists, show error and stop processing
          toast.error('Invoice ID already exists. Please enter a different Invoice ID.');
          setIsLoading(false);
          return; // Exit the function early
        } else {
          // Invoice ID doesn't exist, check if it has the store prefix
          if (!invoiceId.startsWith(storeDetails.storePrefix + '-')) {
            // Add the store prefix if it's not already there
            txInvoiceId = `${storeDetails.storePrefix}-${invoiceId}`;
          } else {
            // Use the provided one as is since it already has the prefix
            txInvoiceId = invoiceId;
          }
        }
      } else {
        // No invoice ID provided, generate a new one
        txInvoiceId = generateInvoiceId(storeDetails.storePrefix);
      }
      const newWalletBalance = customRound(
        selectedCustomer.walletBalance - saleCalculation.walletDeduction
      );
      const newSurabhiCoins = customRound(
        selectedCustomer.surabhiBalance -
          saleCalculation.surabhiCoinsUsed +
          saleCalculation.surabhiCoinsEarned
      );
      // console.log('Is it comig here in line 261', newWalletBalance, newSurabhiCoins);
      // Update customer balances
      const customerDoc = querySnapshot.docs[0];
      const customerRef = customerDoc.ref;
      // console.log(
      //   'Customer document in line 266 is',
      //   customerRef,
      //   newSurabhiCoins,
      //   newSurabhiCoins
      // );

      // Exclude seva balance calculations for demo stores
      const sevaContribution = storeDetails?.demoStore ? 0 : saleCalculation.goSevaContribution;
      const newSevaBalance = Number(
        ((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)
      );
      const newSevaTotal = Number(
        ((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)
      );

      // Update cumTotal and set saleElgibility based on cumulative total and student status
      const newCumTotal = customRound((selectedCustomer.cumTotal || 0) + saleAmount);
      const isEligible = selectedCustomer.isStudent
        ? newCumTotal >= 500 // Student minimum is 500
        : newCumTotal >= 2000; // Regular customer minimum is 2000

      // Only update saleElgibility to true if customer becomes eligible and wasn't already eligible
      const shouldUpdateEligibility = isEligible && selectedCustomer.saleElgibility !== true;

      // console.log(
      //   'THe isEligible in line 378 is',
      //   isEligible,
      //   newCumTotal,
      //   selectedCustomer.isStudent,
      //   'shouldUpdateEligibility:',
      //   shouldUpdateEligibility
      // );

      const updateData: any = {
        cumTotal: newCumTotal,
        walletBalance: newWalletBalance,
        surabhiBalance: newSurabhiCoins,
        sevaBalance: newSevaBalance,
        sevaTotal: newSevaTotal,
        lastTransactionDate: serverTimestamp(),
      };

      // Only update saleElgibility if customer becomes eligible for the first time
      if (shouldUpdateEligibility) {
        updateData.saleElgibility = true;
      }

      await updateDoc(customerRef, updateData);

      // Handle Referrer Income for non-cash/non-mixed payments
      // For cash/mixed payments, referrer income is handled in a separate block below
      if (
        selectedCustomer.referredBy &&
        saleCalculation.referrerSurabhiCoinsEarned > 0 &&
        paymentMethod !== 'cash' &&
        paymentMethod !== 'mixed'
      ) {
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

            // console.log('Referrer Data:', referrerData);
            // console.log('New Referred User:', selectedCustomer.customerName);
            // console.log('Referral Amount:', referralAmount);

            // Safely increment referral amount (handle null/NaN)
            const incrementAmount =
              Number.isNaN(referralAmount) || referralAmount === null ? 0 : referralAmount;

            // Update referrer's data - only update Surabhi balance without modifying referredUsers
            await updateDoc(referrerDoc.ref, {
              referralSurabhi: increment(incrementAmount),
              surabhiBalance: increment(incrementAmount),
            });

            // Add activity record for referrer
            await addActivityRecord({
              type: 'referral',
              remarks: `${selectedCustomer.referredBy} got ₹${incrementAmount} referral from ${selectedCustomer.customerName}'s recharge`,
              amount: incrementAmount,
              customerMobile: selectedCustomer.referredBy,
              storeLocation: selectedCustomer.storeLocation,
              customerName: referrerData.customerName,
              createdAt: Timestamp.fromDate(new Date()),
              demoStore: demoStore,
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
      if (
        (paymentMethod === 'cash' || paymentMethod === 'mixed') &&
        saleCalculation.goSevaContribution > 0
      ) {
        await addActivityRecord({
          type: 'seva_contribution',
          remarks: `Seva contribution of ₹${saleCalculation.goSevaContribution} from ${selectedCustomer.customerName}'s purchase`,
          amount: saleCalculation.goSevaContribution,
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          storeLocation: storeLocation,
          createdAt: Timestamp.fromDate(new Date()),
          demoStore: demoStore,
        });
      }

      // Add AccountTx record(s) based on payment method
      if (paymentMethod === 'wallet') {
        const adminCutTx = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
        const accountTxData: Omit<AccountTxType, 'id'> = {
          createdAt: Timestamp.fromDate(new Date()),
          storeName: storeDetails.storeName,
          customerName: selectedCustomer.customerName,
          customerMobile: selectedCustomer.customerMobile,
          adminProfit: Number(adminProfitTaken.toFixed(2)),
          type: 'sale',
          amount: Number(saleAmount.toFixed(2)),
          invoiceId: txInvoiceId, // Add invoice ID for consistency
          credit: Number((0).toFixed(2)),
          debit: Number((saleCalculation.totalAmount - adminCutTx).toFixed(2)),
          adminCut: Number(adminCutTx.toFixed(2)),
          adminCurrentBalance: Number(
            (-(storeDetails.storeCurrentBalance || 0) + saleAmount - adminCutTx).toFixed(2)
          ),
          currentBalance: Number(
            ((storeDetails.storeCurrentBalance || 0) - saleAmount + adminCutTx).toFixed(2)
          ),
          sevaBalance: Number(
            ((storeDetails.storeSevaBalance || 0) + saleCalculation.goSevaContribution).toFixed(2)
          ),
          remarks: `Wallet sale for ${selectedCustomer.customerName} (${selectedCustomer.customerMobile})`,
          demoStore: storeDetails.demoStore || false,
        };
        await addDoc(collection(db, 'AccountTx'), accountTxData);

        // Create CustomerTx record
        const customerTxData: Omit<CustomerTxType, 'id'> = {
          type: 'sale',
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          demoStore: storeDetails.demoStore || false,
          storeLocation: storeLocation,
          storeName: user.storeLocation,
          createdAt: Timestamp.fromDate(new Date()),
          paymentMethod: paymentMethod,
          processedBy: user.name,
          invoiceId: txInvoiceId,
          remarks: `Sale transaction for ${selectedCustomer.customerName}`,
          // Required fields with defaults
          amount: saleAmount,
          surabhiEarned: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
          sevaEarned: Number(sevaContribution.toFixed(2)),
          referralEarned: 0,
          referredBy: selectedCustomer.referredBy || '',
          adminProft: Number(calculateAdminCut(saleAmount, storeDetails).toFixed(2)),

          // Sale-Specific Fields
          surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
          cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),

          // Balance fields
          previousBalance: {
            walletBalance: Number(selectedCustomer.walletBalance.toFixed(2)),
            surabhiBalance: Number(selectedCustomer.surabhiBalance.toFixed(2)),
          },
          newBalance: {
            walletBalance: Number(
              (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
            ),
            surabhiBalance: Number(
              (
                selectedCustomer.surabhiBalance -
                saleCalculation.surabhiCoinsUsed +
                saleCalculation.surabhiCoinsEarned
              ).toFixed(2)
            ),
          },
          // Transaction amounts
          walletCredit: Number((0).toFixed(2)),
          walletDebit: Number(saleCalculation.walletDeduction.toFixed(2)),
          walletBalance: Number(
            (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
          ),
          surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          surabhiCredit: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
          surabhiBalance: Number(
            (
              selectedCustomer.surabhiBalance -
              saleCalculation.surabhiCoinsUsed +
              saleCalculation.surabhiCoinsEarned
            ).toFixed(2)
          ),
          sevaCredit: Number(sevaContribution.toFixed(2)),
          sevaDebit: Number((0).toFixed(2)),
          sevaBalance: Number(
            (selectedCustomer.sevaBalanceCurrentMonth + sevaContribution).toFixed(2)
          ),
          sevaTotal: Number((selectedCustomer.sevaTotal + sevaContribution).toFixed(2)),
          storeSevaBalance: Number((storeDetails.storeSevaBalance + sevaContribution).toFixed(2)),
        };

        await addDoc(collection(db, 'CustomerTx'), customerTxData);
        // Update store balance
        const storeQueryWallet = query(
          collection(db, 'stores'),
          where('storeName', '==', user.storeLocation),
          where('demoStore', '==', demoStore)
        );
        // console.log('The customers data in line 947 is', selectedCustomer);
        const storeSnapshotWallet = await getDocs(storeQueryWallet);
        if (!storeSnapshotWallet.empty) {
          const storeDoc = storeSnapshotWallet.docs[0];
          const storeData = storeDoc.data();
          const currentBalanceIncrement =
            accountTxData.currentBalance - storeData.storeCurrentBalance;
          const sevaBalanceIncrement = accountTxData.sevaBalance - storeData.storeSevaBalance;

          await updateDoc(storeDoc.ref, {
            storeCurrentBalance: increment(currentBalanceIncrement),
            adminCurrentBalance: increment(-currentBalanceIncrement),
            storeSevaBalance: increment(sevaBalanceIncrement),
            adminStoreProfit: increment(adminProfitTaken),
            updatedAt: serverTimestamp(),
          });

          // console.log(
          //   `Updated store balances: Current ${currentBalanceIncrement > 0 ? '+' : ''}${currentBalanceIncrement}, Seva ${sevaBalanceIncrement > 0 ? '+' : ''}${sevaBalanceIncrement}`
          // );
          // console.log(
          //   `New store balances: Current ${storeData.storeCurrentBalance + currentBalanceIncrement}, Seva ${storeData.storeSevaBalance + sevaBalanceIncrement}`
          // );
        }
      } else if (paymentMethod === 'cash') {
        const adminCutTx = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
        const accountTxData: Omit<AccountTxType, 'id'> = {
          createdAt: Timestamp.fromDate(new Date()),
          storeName: storeDetails.storeName,
          type: 'sale',
          amount: Number(saleAmount.toFixed(2)),
          invoiceId: txInvoiceId,
          demoStore: storeDetails.demoStore || false,
          customerName: selectedCustomer.customerName,
          customerMobile: selectedCustomer.customerMobile,
          credit: Number(saleCalculation.cashPayment.toFixed(2)),
          adminCut: Number(adminCutTx.toFixed(2)),
          adminProfit: Number(adminProfitTaken.toFixed(2)),
          debit: Number((saleCalculation.totalAmount - adminCutTx).toFixed(2)),
          sevaBalance: Number(
            (
              (Number(storeDetails?.storeSevaBalance) || 0) + (Number(sevaContribution) || 0)
            ).toFixed(2)
          ),
          currentBalance: Number(
            (
              (Number(storeDetails?.storeCurrentBalance) || 0) +
              (Number(saleCalculation?.cashPayment) || 0) -
              (Number(saleCalculation?.totalAmount) || 0) +
              (Number(adminCutTx) || 0)
            ) // balance + credit + debot
              .toFixed(2)
          ),
          adminCurrentBalance: Number(
            (
              -storeDetails.storeCurrentBalance -
              saleCalculation.cashPayment +
              saleCalculation.totalAmount -
              adminCutTx
            ).toFixed(2)
          ),
          remarks: `Cash sale for ${selectedCustomer.customerName} (${selectedCustomer.customerMobile})`,
        };
        await addDoc(collection(db, 'AccountTx'), accountTxData);

        // Fetch current SevaPool data to increment balance properly
        const poolRef = doc(db, 'SevaPool', 'main');
        const poolDoc = await getDoc(poolRef);
        const sevaPool = poolDoc.data();

        // Only update SevaPool for non-demo stores
        if (!storeDetails?.demoStore) {
          await updateDoc(poolRef, {
            currentSevaBalance: Number((sevaPool.currentSevaBalance + sevaContribution).toFixed(2)),
            contributionsCurrentMonth: increment(1),
            totalContributions: increment(1),
            totalAllocations: sevaPool.totalAllocations,
            allocationsCurrentMonth: sevaPool.allocationsCurrentMonth,
            lastAllocatedDate: serverTimestamp(),
          });
        }

        const customerTxData: Omit<CustomerTxType, 'id'> = {
          type: 'sale',
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          demoStore: storeDetails.demoStore || false,
          storeLocation: storeLocation,
          storeName: user.storeLocation,
          createdAt: Timestamp.fromDate(new Date()),
          paymentMethod: paymentMethod,
          processedBy: user.name,
          invoiceId: txInvoiceId,
          remarks: `Sale transaction for ${selectedCustomer.customerName}`,
          // Required fields with defaults
          amount: saleAmount,
          surabhiEarned: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
          sevaEarned: Number(sevaContribution.toFixed(2)),
          referralEarned: 0,
          referredBy: selectedCustomer.referredBy || '',
          adminProft: Number(calculateAdminCut(saleAmount, storeDetails).toFixed(2)),
          // Sale-Specific Fields
          surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
          cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),

          // Balance fields
          previousBalance: {
            walletBalance: Number(selectedCustomer.walletBalance.toFixed(2)),
            surabhiBalance: Number(selectedCustomer.surabhiBalance.toFixed(2)),
          },
          newBalance: {
            walletBalance: Number(
              (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
            ),
            surabhiBalance: Number(
              (
                selectedCustomer.surabhiBalance -
                saleCalculation.surabhiCoinsUsed +
                saleCalculation.surabhiCoinsEarned
              ).toFixed(2)
            ),
          },

          // Transaction amounts
          walletCredit: Number((0).toFixed(2)),
          walletDebit: Number(saleCalculation.walletDeduction.toFixed(2)),
          walletBalance: Number(
            (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
          ),
          surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          surabhiCredit: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
          surabhiBalance: Number(
            (
              selectedCustomer.surabhiBalance -
              saleCalculation.surabhiCoinsUsed +
              saleCalculation.surabhiCoinsEarned
            ).toFixed(2)
          ),
          sevaCredit: Number(sevaContribution.toFixed(2)),
          sevaDebit: Number((0).toFixed(2)),
          sevaBalance: Number(
            (selectedCustomer.sevaBalanceCurrentMonth + sevaContribution).toFixed(2)
          ),
          sevaTotal: Number((selectedCustomer.sevaTotal + sevaContribution).toFixed(2)),
          storeSevaBalance: Number((storeDetails.storeSevaBalance + sevaContribution).toFixed(2)),
        };

        await addDoc(collection(db, 'CustomerTx'), customerTxData);

        // Update customer document in Firestore for cash payment
        const customersRef = collection(db, 'Customers');
        const customerQuery = query(
          customersRef,
          where('customerMobile', '==', selectedCustomer.customerMobile)
        );
        const customerSnapshot = await getDocs(customerQuery);

        if (!customerSnapshot.empty) {
          const customerDoc = customerSnapshot.docs[0];
          const newSevaBalance = Number(
            ((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)
          );
          const newSevaTotal = Number(
            ((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)
          );

          // Update cumTotal and set saleElgibility based on cumulative total and student status
          const newCumTotal = customRound((selectedCustomer.cumTotal || 0) + saleAmount);
          const isEligible = selectedCustomer.isStudent
            ? newCumTotal >= 500 // Student minimum is 500
            : newCumTotal >= 2000; // Regular customer minimum is 2000

          // console.log(
          //   'Cash payment - isEligible:',
          //   isEligible,
          //   'current saleElgibility:',
          //   selectedCustomer.saleElgibility
          // );

          // Only update saleElgibility if customer becomes eligible and wasn't already eligible
          const shouldUpdateEligibility = isEligible && selectedCustomer.saleElgibility !== true;

          const updateData: any = {
            walletBalance: Number(
              (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
            ),
            surabhiBalance: Number(
              (
                selectedCustomer.surabhiBalance -
                saleCalculation.surabhiCoinsUsed +
                saleCalculation.surabhiCoinsEarned
              ).toFixed(2)
            ),
            sevaBalance: newSevaBalance,
            sevaTotal: newSevaTotal,
            cumTotal: newCumTotal,
            lastTransactionDate: serverTimestamp(),
          };

          if (shouldUpdateEligibility) {
            updateData.saleElgibility = true;
            // console.log(
            //   'Cash payment - Setting saleElgibility to true for customer:',
            //   selectedCustomer.customerName
            // );
          }

          await updateDoc(customerDoc.ref, updateData);
        }

        // Update store balance
        const storeQuery = query(
          collection(db, 'stores'),
          where('storeName', '==', user.storeLocation)
        );
        const storeSnapshot = await getDocs(storeQuery);
        if (!storeSnapshot.empty) {
          const storeDoc = storeSnapshot.docs[0];
          const storeData = storeDoc.data();
          const currentBalanceIncrement =
            accountTxData.currentBalance - storeData.storeCurrentBalance;
          const sevaBalanceIncrement = accountTxData.sevaBalance - storeData.storeSevaBalance;

          await updateDoc(storeDoc.ref, {
            storeCurrentBalance: increment(currentBalanceIncrement),
            adminCurrentBalance: increment(-currentBalanceIncrement),
            storeSevaBalance: increment(sevaBalanceIncrement),
            adminStoreProfit: increment(adminProfitTaken),
            updatedAt: serverTimestamp(),
          });

          // console.log(
          //   `Updated store balances (cash sale): Current ${currentBalanceIncrement > 0 ? '+' : ''}${currentBalanceIncrement}, Seva ${sevaBalanceIncrement > 0 ? '+' : ''}${sevaBalanceIncrement}`
          // );
          // console.log(
          //   `New store balances: Current ${storeData.storeCurrentBalance + currentBalanceIncrement}, Seva ${storeData.storeSevaBalance + sevaBalanceIncrement}`
          // );
        }
      } else {
        if (saleCalculation.cashPayment > 0) {
          const adminCutTx = calculateAdminCut(saleCalculation.totalAmount, storeDetails);
          // Generate invoice ID or use the provided one
          const cashTxData: Omit<AccountTxType, 'id'> = {
            createdAt: Timestamp.fromDate(new Date()),
            storeName: storeDetails.storeName,
            type: 'sale',
            amount: Number(saleAmount.toFixed(2)),
            invoiceId: txInvoiceId, // Add invoice ID for consistency
            customerName: selectedCustomer.customerName,
            demoStore: storeDetails.demoStore || false,
            customerMobile: selectedCustomer.customerMobile,
            adminCut: Number(adminCutTx.toFixed(2)),
            adminProfit: Number(adminProfitTaken.toFixed(2)),
            credit: Number(saleCalculation.cashPayment.toFixed(2)),
            debit: Number((saleCalculation.totalAmount - adminCutTx).toFixed(2)),
            adminCurrentBalance: Number(
              (
                -(Number(storeDetails?.storeCurrentBalance) || 0) -
                (Number(saleCalculation?.cashPayment) || 0) +
                (Number(saleCalculation?.totalAmount) || 0) -
                (Number(adminCutTx) || 0)
              ).toFixed(2)
            ),
            currentBalance: Number(
              (
                (Number(storeDetails?.storeCurrentBalance) || 0) +
                (Number(saleCalculation?.cashPayment) || 0) -
                (Number(saleCalculation?.totalAmount) || 0) +
                (Number(adminCutTx) || 0)
              ).toFixed(2)
            ),
            sevaBalance: Number(
              (
                (Number(storeDetails?.storeSevaBalance) || 0) + (Number(sevaContribution) || 0)
              ).toFixed(2)
            ),
            remarks: `Mixed sale ₹${saleCalculation.totalAmount} with cash of ₹${saleCalculation.cashPayment} and wallet of ₹${saleCalculation.walletDeduction} by ${selectedCustomer.customerName}`,
          };

          await addDoc(collection(db, 'AccountTx'), cashTxData);
          const poolRef = doc(db, 'SevaPool', 'main');
          const poolDoc = await getDoc(poolRef);
          const sevaPool = poolDoc.data();

          // Only update SevaPool for non-demo stores
          if (!storeDetails?.demoStore) {
            await updateDoc(poolRef, {
              currentSevaBalance: Number(
                (sevaPool.currentSevaBalance + sevaContribution).toFixed(2)
              ),
              contributionsCurrentMonth: increment(1),
              totalContributions: increment(1),
              totalAllocations: sevaPool.totalAllocations,
              allocationsCurrentMonth: sevaPool.allocationsCurrentMonth,
              lastAllocatedDate: serverTimestamp(),
            });
          }

          const customerTxData: Omit<CustomerTxType, 'id'> = {
            type: 'sale',
            customerMobile: selectedCustomer.customerMobile,
            customerName: selectedCustomer.customerName,
            demoStore: storeDetails.demoStore || false,
            storeLocation: storeLocation,
            storeName: user.storeLocation,
            createdAt: Timestamp.fromDate(new Date()),
            paymentMethod: paymentMethod,
            processedBy: user.name,
            invoiceId: txInvoiceId,
            remarks: `Sale transaction for ${selectedCustomer.customerName}`,
            // Required fields with defaults
            amount: saleAmount,
            surabhiEarned: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
            sevaEarned: Number(sevaContribution.toFixed(2)),
            referralEarned: 0,
            referredBy: selectedCustomer.referredBy || '',
            adminProft: Number(calculateAdminCut(saleAmount, storeDetails).toFixed(2)),
            // Sale-Specific Fields
            surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
            walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
            cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),
            // Balance fields
            previousBalance: {
              walletBalance: Number(selectedCustomer.walletBalance.toFixed(2)),
              surabhiBalance: Number(selectedCustomer.surabhiBalance.toFixed(2)),
            },
            newBalance: {
              walletBalance: Number(
                (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
              ),
              surabhiBalance: Number(
                (
                  selectedCustomer.surabhiBalance -
                  saleCalculation.surabhiCoinsUsed +
                  saleCalculation.surabhiCoinsEarned
                ).toFixed(2)
              ),
            },

            // Transaction amounts
            walletCredit: Number((0).toFixed(2)),
            walletDebit: Number(saleCalculation.walletDeduction.toFixed(2)),
            walletBalance: Number(
              (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
            ),
            surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
            surabhiCredit: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
            surabhiBalance: Number(
              (
                selectedCustomer.surabhiBalance -
                saleCalculation.surabhiCoinsUsed +
                saleCalculation.surabhiCoinsEarned
              ).toFixed(2)
            ),
            sevaCredit: Number(sevaContribution.toFixed(2)),
            sevaDebit: Number((0).toFixed(2)),
            sevaBalance: Number(
              (selectedCustomer.sevaBalanceCurrentMonth + sevaContribution).toFixed(2)
            ),
            sevaTotal: Number((selectedCustomer.sevaTotal + sevaContribution).toFixed(2)),
            storeSevaBalance: Number((storeDetails.storeSevaBalance + sevaContribution).toFixed(2)),
          };

          await addDoc(collection(db, 'CustomerTx'), customerTxData);

          // Update customer document in Firestore for mixed payment
          const customersRef = collection(db, 'Customers');
          const customerQuery = query(
            customersRef,
            where('customerMobile', '==', selectedCustomer.customerMobile)
          );
          const customerSnapshot = await getDocs(customerQuery);

          if (!customerSnapshot.empty) {
            const customerDoc = customerSnapshot.docs[0];
            const newSevaBalance = Number(
              ((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)
            );
            const newSevaTotal = Number(
              ((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)
            );

            // Update cumTotal and set saleElgibility based on cumulative total and student status
            const newCumTotal = customRound((selectedCustomer.cumTotal || 0) + saleAmount);
            const isEligible = selectedCustomer.isStudent
              ? newCumTotal >= 500 // Student minimum is 500
              : newCumTotal >= 2000; // Regular customer minimum is 2000

            // Only update saleElgibility to true if customer becomes eligible and wasn't already eligible
            const shouldUpdateEligibility = isEligible && selectedCustomer.saleElgibility !== true;

            const updateData: any = {
              walletBalance: Number(
                (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
              ),
              surabhiBalance: Number(
                (
                  selectedCustomer.surabhiBalance -
                  saleCalculation.surabhiCoinsUsed +
                  saleCalculation.surabhiCoinsEarned
                ).toFixed(2)
              ),
              sevaBalance: newSevaBalance,
              sevaTotal: newSevaTotal,
              cumTotal: newCumTotal,
              lastTransactionDate: serverTimestamp(),
            };

            // Only update saleElgibility if customer becomes eligible for the first time
            if (shouldUpdateEligibility) {
              updateData.saleElgibility = true;
            }

            await updateDoc(customerDoc.ref, updateData);
          }

          // Update store balance
          const storeQuery = query(
            collection(db, 'stores'),
            where('storeName', '==', user.storeLocation)
          );
          const storeSnapshot = await getDocs(storeQuery);
          if (!storeSnapshot.empty) {
            const storeDoc = storeSnapshot.docs[0];
            const storeData = storeDoc.data();
            const currentBalanceIncrement =
              cashTxData.currentBalance - storeData.storeCurrentBalance;
            const sevaBalanceIncrement = cashTxData.sevaBalance - storeData.storeSevaBalance;

            await updateDoc(storeDoc.ref, {
              storeCurrentBalance: increment(currentBalanceIncrement),
              storeSevaBalance: increment(sevaBalanceIncrement),
              adminCurrentBalance: increment(-currentBalanceIncrement),
              adminStoreProfit: increment(adminProfitTaken),
              updatedAt: serverTimestamp(),
            });

            // console.log(
            //   `Updated store balances (cash payment): Current ${currentBalanceIncrement > 0 ? '+' : ''}${currentBalanceIncrement}, Seva ${sevaBalanceIncrement > 0 ? '+' : ''}${sevaBalanceIncrement}`
            // );
            // console.log(
            //   `New store balances: Current ${storeData.storeCurrentBalance + currentBalanceIncrement}, Seva ${storeData.storeSevaBalance + sevaBalanceIncrement}`
            // );
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
        lastActive: Timestamp.fromDate(new Date()),
      };

      await updateDoc(staffRef, staffUpdates);

      // Handle Referrer Income - Only for cash or mixed payments
      // For mixed payments, only process if not already processed for wallet payment
      if (
        (paymentMethod === 'cash' || paymentMethod === 'mixed') &&
        selectedCustomer.referredBy &&
        saleCalculation.referrerSurabhiCoinsEarned > 0
        //  &&
        // Only process if not already processed for wallet payment
        // !(paymentMethod === 'mixed' && saleCalculation?.walletDeduction > 0)
      ) {
        try {
          // Find referrer's document
          const referrer = await fetchCustomerByMobile(selectedCustomer.referredBy);

          if (referrer) {
            const referralAmount = saleCalculation.referrerSurabhiCoinsEarned;
            const referrerRef = doc(db, 'Customers', referrer.id); // Assuming you have id field
            // console.log('The referrer id is', referrerRef);
            // Update referrer's balances - only update Surabhi balance without modifying referredUsers
            await updateDoc(referrerRef, {
              surabhiBalance: increment(referralAmount),
              referralSurabhi: increment(referralAmount),
              updatedAt: serverTimestamp(),
            });

            // Fetch store details for the referrer's store location
            const referrerStoreQuery = query(
              collection(db, 'stores'),
              where('storeName', '==', referrer.storeLocation) // Use referrer's store location
            );

            const referrerStoreSnapshot = await getDocs(referrerStoreQuery);
            let referrerStoreDetails = null;

            if (!referrerStoreSnapshot.empty) {
              referrerStoreDetails = referrerStoreSnapshot.docs[0].data() as StoreType;
            } else {
              // console.error('No store found for referrer location:', referrer.storeLocation);
            }

            // Add CustomerTx record for the referral Surabhi Coins earned by referrer
            const referrerTxData: Omit<CustomerTxType, 'id'> = {
              type: 'referral',
              customerMobile: referrer.customerMobile,
              demoStore: referrerStoreDetails?.demoStore || false,
              customerName: referrer.customerName,
              storeLocation: referrer.storeLocation,
              storeName: referrer.storeLocation,
              createdAt: Timestamp.fromDate(new Date()),
              paymentMethod: 'admin',
              processedBy: user.name,
              invoiceId: txInvoiceId,
              remarks: `Referral bonus for referring ${selectedCustomer.customerName}`,
              amount: 0,
              surabhiEarned: referralAmount,
              sevaEarned: 0,
              referralEarned: referralAmount,
              referredBy: '',
              surabhiUsed: 0,
              walletDeduction: 0,
              cashPayment: 0,
              adminProft: 0,
              previousBalance: {
                walletBalance: referrer.walletBalance,
                surabhiBalance: referrer.surabhiBalance,
              },
              newBalance: {
                walletBalance: referrer.walletBalance,
                surabhiBalance: referrer.surabhiBalance + referralAmount,
              },
              walletCredit: 0,
              walletDebit: 0,
              walletBalance: referrer.walletBalance,
              surabhiDebit: 0,
              surabhiCredit: referralAmount,
              surabhiBalance: referrer.surabhiBalance + referralAmount,
              sevaCredit: 0,
              sevaDebit: 0,
              sevaBalance: referrer.sevaBalanceCurrentMonth,
              sevaTotal: referrer.sevaTotal,
              storeSevaBalance: referrerStoreDetails ? referrerStoreDetails.storeSevaBalance : 0,
            };

            await addDoc(collection(db, 'CustomerTx'), referrerTxData);

            // Add activity record for referrer
            await addActivityRecord({
              type: 'referral',
              remarks: `${selectedCustomer.referredBy} got ₹${referralAmount} referral from ${selectedCustomer.customerName}'s purchase`,
              amount: referralAmount,
              customerMobile: selectedCustomer.referredBy,
              storeLocation: referrer.storeLocation,
              customerName: referrer.customerName,
              createdAt: Timestamp.fromDate(new Date()),
              demoStore: demoStore,
            });

            toast.success(
              `Referral bonus of ₹${referralAmount} credited to ${referrer.customerName}`
            );
          } else {
            // console.warn(`Referrer with mobile ${selectedCustomer.referredBy} not found`);
            toast.warning(`Referrer not found - bonus not credited`);
          }
        } catch (error) {
          // console.error('Error processing referral:', error);
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
        createdAt: Timestamp.fromDate(new Date()),
        demoStore: demoStore,
      };

      await addDoc(collection(db, 'Activity'), activity);

      // Update customer document in Firestore
      const customersRefNew = collection(db, 'Customers');
      const customerQuery = query(
        customersRefNew,
        where('customerMobile', '==', selectedCustomer.customerMobile)
      );
      const customerSnapshot = await getDocs(customerQuery);

      if (!customerSnapshot.empty) {
        const customerDoc = customerSnapshot.docs[0];

        // Calculate eligibility based on cumTotal and student status
        const newCumTotal = customRound((selectedCustomer.cumTotal || 0) + saleAmount);
        const isEligible = selectedCustomer.isStudent
          ? newCumTotal >= 500 // Student minimum is 500
          : newCumTotal >= 2000; // Regular customer minimum is 2000

        // Only update saleElgibility to true if customer becomes eligible and wasn't already eligible
        const shouldUpdateEligibility = isEligible && selectedCustomer.saleElgibility !== true;

        const updateData: any = {
          walletBalance: newWalletBalance,
          surabhiBalance: newSurabhiCoins,
          cumTotal: newCumTotal,
          lastTransactionDate: serverTimestamp(),
        };

        // Only update saleElgibility if customer becomes eligible for the first time
        if (shouldUpdateEligibility) {
          updateData.saleElgibility = true;
        }

        // Update quarterly target data locally
        const updatedCustomer = { ...selectedCustomer, cumTotal: newCumTotal };
        const quarterlyTargetUpdate = updateCustomerQuarterlyTarget(updatedCustomer);

        // Add quarterly target fields to the update
        Object.assign(updateData, quarterlyTargetUpdate);

        await updateDoc(customerDoc.ref, updateData);
      }

      // Update local state
      setCustomers(
        customers.map(c =>
          c.customerMobile === selectedCustomer.customerMobile
            ? {
                ...c,
                walletBalance: newWalletBalance,
                surabhiBalance: newSurabhiCoins,
                cumTotal: newCumTotal,
                lastTransactionDate: Timestamp.fromDate(new Date()),
              }
            : c
        )
      );

      toast.success(`Sale of ₹${saleAmount} completed successfully!`);

      // Reset form
      setSaleAmount(undefined);
      setPaymentMethod('wallet');
      setSurabhiCoinsToUse(0);
      setSelectedCustomer(null);
      setSearchTerm('');
      setInvoiceId(''); // Reset invoice ID for next transaction
    } catch (error) {
      // console.error('Error processing sale:', error);
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
      const remainingAfterCoins = saleAmount - saleCalculation.surabhiCoinsUsed;
      if (selectedCustomer.walletBalance < remainingAfterCoins) {
        toast.error('Insufficient wallet balance for this payment method');
        return;
      }
    }
    // console.log('Is it comig here in line 770');
    await handleRegisteredCustomerSale();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Sales Management {demoStore === true && <Badge>Demo Store</Badge>}
          </h2>
          <p className="text-gray-600">Process customer purchases at {storeLocation}</p>
          {storeDetails && (
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              <Badge variant="outline" className="border-blue-200 text-blue-800">
                Referral: {storeDetails.referralCommission}%
              </Badge>
              {storeDetails && storeDetails.walletEnabled === true && (
                <Badge variant="outline" className="border-green-200 text-green-800">
                  Surabhi: {storeDetails.surabhiCommission}%
                </Badge>
              )}
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
            <CardDescription>Search and select customer for sale transaction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              {/* <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
              <Input
                placeholder="Search by name or mobile number"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-14 h-12"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isFetchingCustomers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      // console.log('The slected Customer is', customer);
                      setSelectedCustomer(customer);
                      // Check if customer is registered at the same store as the current user
                      const isSameStore = customer.storeLocation === user.storeLocation;
                      setIsRegisteredAtSameStore(isSameStore);
                      // Reset payment method to cash if not from same store
                      if (!isSameStore) {
                        setPaymentMethod('cash');
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCustomer?.customerMobile === customer.customerMobile
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
                        {customer.referredBy && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <HandCoins className="h-3 w-3" />
                            <span> {customer.referredBy}</span>
                          </div>
                        )}
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
                          {customer.isStudent && (
                            <Badge
                              variant="outline"
                              className="border-blue-200 text-blue-800 text-xs"
                            >
                              Student
                            </Badge>
                          )}
                          {customer.coinsFrozen && (
                            <Badge
                              variant="outline"
                              className="border-red-200 text-red-800 text-xs"
                            >
                              Coins Frozen
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-green-600">
                          ₹{customer.walletBalance.toFixed(2)}
                        </p>
                        <p className="text-amber-600">
                          {customer.surabhiBalance.toFixed(2)} Surabhi Balance
                        </p>
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
            <CardDescription>Enter sale details and payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedCustomer ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Selected Customer</h3>
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-base text-blue-900">
                        {selectedCustomer.customerName}
                      </p>
                      {selectedCustomer.isStudent && (
                        <Badge variant="outline" className="border-blue-200 text-blue-800 text-xs">
                          Student
                        </Badge>
                      )}
                      {!hasMetQuarterlyTarget(selectedCustomer) && (
                        <Badge variant="outline" className="border-red-200 text-red-800 text-xs">
                          Coins Frozen
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-blue-700">{selectedCustomer.customerMobile}</p>
                    {selectedCustomer.customerEmail && (
                      <p className="text-sm text-blue-700">{selectedCustomer.customerEmail}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Wallet Balance</p>
                      <p className="font-bold">₹{selectedCustomer.walletBalance.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-amber-700">Surabhi Coins</p>
                      <p className="font-bold">{selectedCustomer.surabhiBalance.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-purple-700">Last Purchase</p>
                      <p className="font-bold">
                        {selectedCustomer.lastTransactionDate
                          ? selectedCustomer.lastTransactionDate.toDate
                            ? new Date(
                                selectedCustomer.lastTransactionDate.toDate()
                              ).toLocaleString()
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
                      {/* <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                      <Input
                        id="amount"
                        type="text"
                        placeholder="Enter sale amount"
                        value={saleAmount || ''}
                        onChange={e => setSaleAmount(Number(e.target.value))}
                        className="pl-14 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceId">Invoice ID (Optional)</Label>
                    <div className="relative">
                      {/* <ShoppingCart className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                      <Input
                        id="invoiceId"
                        type="text"
                        placeholder="Enter invoice ID or leave blank to auto-generate"
                        value={invoiceId}
                        onChange={e => setInvoiceId(e.target.value)}
                        className="pl-14 h-12"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Leave blank to auto-generate an invoice ID. If you enter an ID, the store
                      prefix ({storeDetails?.storePrefix}) will be automatically added if not
                      included.
                    </p>
                  </div>

                  {selectedCustomer && selectedCustomer.surabhiBalance > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="coins">Use Surabhi Coins</Label>
                      <div className="relative">
                        {/* <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                        <Input
                          id="coins"
                          type="text"
                          placeholder="Enter coins to use"
                          value={surabhiCoinsToUse}
                          onChange={e => {
                            const value = Number(e.target.value);
                            const maxCoins = Math.floor(
                              Math.min(selectedCustomer.surabhiBalance, saleAmount)
                            );
                            setSurabhiCoinsToUse(
                              Math.floor(Math.max(0, Math.min(value, maxCoins)))
                            );
                          }}
                          className="pl-14 h-12"
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {selectedCustomer.surabhiBalance.toFixed(2)} coins (Using{' '}
                        {surabhiCoinsToUse.toFixed(2)})
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="payment">Payment Method *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={value =>
                        setPaymentMethod(value as 'wallet' | 'cash' | 'mixed')
                      }
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
                        <span className="font-bold text-purple-600">
                          ₹{saleCalculation.totalAmount?.toFixed(2)}
                        </span>
                      </div>

                      {saleCalculation.surabhiCoinsUsed > 0 && (
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <span className="text-sm font-medium text-amber-900">
                            Surabhi Coins Used
                          </span>
                          <span className="font-bold text-amber-600">
                            -{saleCalculation.surabhiCoinsUsed.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {saleCalculation.walletDeduction > 0 && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-medium text-blue-900">
                            Wallet Deduction
                          </span>
                          <span className="font-bold text-blue-600">
                            ₹{saleCalculation.walletDeduction.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {saleCalculation.cashPayment > 0 && (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">Cash Payment</span>
                          <span className="font-bold text-green-600">
                            ₹{saleCalculation.cashPayment.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') &&
                        saleCalculation.surabhiCoinsEarned > 0 && (
                          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                            <span className="text-sm font-medium text-indigo-900">
                              Surabhi Coins Earned{' '}
                              {paymentMethod === 'cash' || paymentMethod === 'mixed'
                                ? storeDetails.cashOnlyCommission
                                : storeDetails.surabhiCommission}
                              %
                            </span>
                            <span className="font-bold text-indigo-600">
                              +{saleCalculation.surabhiCoinsEarned.toFixed(2)}{' '}
                            </span>
                          </div>
                        )}

                      {/* {storeDetails && (
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <span className="text-sm font-medium text-orange-900">
                            Surabh Percentage (Wallet{' '}
                            {storeDetails.walletEnabled ? 'Enabled' : 'Disabled'})
                          </span>
                          <span className="font-bold text-orange-600">
                            {storeDetails.surabhiCommission}%
                          </span>
                        </div>
                      )} */}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') &&
                        saleCalculation.goSevaContribution > 0 && (
                          <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                            <span className="text-sm font-medium text-pink-900">
                              Seva Contribution {storeDetails.sevaCommission}%
                            </span>
                            <span className="font-bold text-pink-600">
                              +{saleCalculation.goSevaContribution}{' '}
                            </span>
                          </div>
                        )}

                      {(paymentMethod === 'cash' || paymentMethod === 'mixed') &&
                        saleCalculation.referrerSurabhiCoinsEarned > 0 &&
                        selectedCustomer.referredBy && (
                          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                            <span className="text-sm font-medium text-yellow-900">
                              Referral Bonus {storeDetails.referralCommission}%
                            </span>
                            <span className="font-bold text-yellow-600">
                              +{saleCalculation.referrerSurabhiCoinsEarned.toFixed(2)} Referral to{' '}
                              {selectedCustomer.referredBy}{' '}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                <>
                  <Button
                    onClick={handleSaleWithTPIN}
                    disabled={
                      isLoading ||
                      !saleAmount ||
                      (selectedCustomer && !paymentMethod) ||
                      (saleCalculation && !saleCalculation.isValid)
                    }
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
                        <p className="mb-4">
                          Please enter the customer's TPIN to proceed with the sale.
                        </p>
                        <input
                          type="password"
                          value={enteredTPIN}
                          onChange={e => setEnteredTPIN(e.target.value)}
                          className="w-full p-2 border rounded mb-4"
                          placeholder="Enter TPIN"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setShowTPINModal(false);
                              setEnteredTPIN('');
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
                <p className="text-lg font-medium mb-2">Select a Customer</p>
                <p className="text-sm">Choose a customer from the list to process a sale</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
