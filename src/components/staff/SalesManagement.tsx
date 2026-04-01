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
  Gift,
  HandCoins,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Wallet
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
import { getUserMobile, getUserName } from '@/lib/userUtils';
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
import { hasMetQuarterlyTarget } from '@/utils/quarterlyTargets';

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

// Admin cut is now based on Surabhi Point Value (SPV) rather than sale value.
// It also includes the store's Bonus % in the admin cut calculation.
const calculateAdminCut = (
  spvBase: number,
  storeDetails: StoreType,
  paymentMethod?: 'wallet' | 'cash' | 'mixed'
) => {
  if (!storeDetails) return 0;
  const surabhiCommissionForEarn =
    paymentMethod === 'cash' || paymentMethod === 'mixed'
      ? storeDetails.cashOnlyCommission
      : storeDetails.surabhiCommission;

  const surabhiPart = customRound(spvBase * (surabhiCommissionForEarn / 100));
  const referralPart = customRound(spvBase * (storeDetails.referralCommission / 100));
  const sevaPart = customRound(spvBase * (storeDetails.sevaCommission / 100));
  const shippingPart = customRound(spvBase * ((storeDetails.shippingCommission || 0) / 100));
  const bonusPart = customRound(spvBase * ((storeDetails.bonusPercentage || 0) / 100));
  return referralPart + sevaPart + surabhiPart + shippingPart + bonusPart;
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
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'mixed'>('cash');
  const [surabhiCoinsToUse, setSurabhiCoinsToUse] = useState<number>(0);
  const [shippingCreditsToUse, setShippingCreditsToUse] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number | undefined>(undefined);
  const [spvEntered, setSpvEntered] = useState<string>('1');
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
  const [storeDetails, setStoreDetails] = useState<StoreType | null>(null);

  const [showTPINModal, setShowTPINModal] = useState(false);
  const [enteredTPIN, setEnteredTPIN] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [_sevaPool] = useState<SevaPoolType>({
    currentSevaBalance: 0,
    totalContributions: 0,
    totalAllocations: 0,
    contributionsCurrentMonth: 0,
    allocationsCurrentMonth: 0,
    lastResetDate: Timestamp.now(),
    lastAllocatedDate: Timestamp.now(),
  });

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
      // Adjusted SPV and adjusted earnings computation (additive, does not alter existing logic)
      const spvValue = parseFloat(spvEntered) || 0;
      const adjustedSpv =
        saleAmount > 0
          ? Number(
              (
                ((saleAmount - saleCalculation.surabhiCoinsUsed) * spvValue) /
                saleAmount
              ).toFixed(2)
            )
          : 0;
      const surabhiCommissionForEarn =
        paymentMethod === 'cash' || paymentMethod === 'mixed'
          ? storeDetails.cashOnlyCommission
          : storeDetails.surabhiCommission;
      const surabhiEarnedAdj = adjustedSpv * (surabhiCommissionForEarn / 100);
      const sevaEarnedAdj = adjustedSpv * (storeDetails.sevaCommission / 100);
      const referralEarnedAdj = adjustedSpv * (storeDetails.referralCommission / 100);
      const newWalletBalance = customRound(
        selectedCustomer.walletBalance - saleCalculation.walletDeduction
      );
      const newSurabhiCoins = customRound(
        selectedCustomer.surabhiBalance - saleCalculation.surabhiCoinsUsed + surabhiEarnedAdj
      );
      const newShippingBalance = customRound(
        (selectedCustomer.shippingBalance || 0)
        - saleCalculation.shippingCreditsUsed
        + saleCalculation.shippingCreditsEarned
      );
      // const newSurbhiTotal = customRound((selectedCustomer.surbhiTotal || 0) + surabhiEarnedAdj);
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
      const sevaContribution = sevaEarnedAdj;
      const adminProfitTakenInSale = calculateAdminProfit();

      const newSevaBalance = Number(
        ((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)
      );
      const newSevaTotal = Number(
        ((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)
      );

      // Update cumTotal and set saleElgibility based on cumulative total and student status
      const newCumTotal = customRound((selectedCustomer.cumTotal || 0) + saleAmount);
      const isEligible = selectedCustomer.isStudent
        ? newCumTotal >= 499 // Student minimum is 499
        : newCumTotal >= 999; // Regular customer minimum is 999

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

      const updateData = {
        cumTotal: newCumTotal,
        walletBalance: newWalletBalance,
        surabhiBalance: newSurabhiCoins,
        surbhiTotal: increment(surabhiEarnedAdj),
        sevaBalance: newSevaBalance,
        sevaTotal: newSevaTotal,
        shippingBalance: newShippingBalance,
        shippingTotal: increment(saleCalculation.shippingCreditsEarned),
        lastTransactionDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(shouldUpdateEligibility ? { saleElgibility: true } : {}),
      };

      await updateDoc(customerRef, updateData);

      // Handle Referrer Income for non-cash/non-mixed payments
      // For cash/mixed payments, referrer income is handled in a separate block below
      if (
        selectedCustomer.referredBy &&
        referralEarnedAdj > 0 &&
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
            const referralAmount = referralEarnedAdj;

            // console.log('Referrer Data:', referrerData);
            // console.log('New Referred User:', selectedCustomer.customerName);
            // console.log('Referral Amount:', referralAmount);

            // Safely increment referral amount (handle null/NaN)
            const incrementAmount =
              Number.isNaN(referralAmount) || referralAmount === null ? 0 : referralAmount;

            // Update referrer's data - only update Surabhi balance without modifying referredUsers
            await updateDoc(referrerDoc.ref, {
              surabhiReferral: increment(incrementAmount),
              surabhiBalance: increment(incrementAmount),
              surbhiTotal: increment(incrementAmount),
            });

            // Add activity record for referrer
            await addActivityRecord({
              type: 'referral',
              remarks: `${selectedCustomer.referredBy} got ₹${incrementAmount} referral from ${selectedCustomer.customerName}'s recharge of ₹${saleCalculation.totalAmount}`,
              amount: incrementAmount,
              customerMobile: selectedCustomer.referredBy,
              storeLocation: selectedCustomer.storeLocation,
              customerName: referrerData.customerName,
              createdAt: Timestamp.fromDate(new Date()),
              demoStore: demoStore,
            });
          } else {
            // console.warn(`Referrer with mobile ${selectedCustomer.referredBy} not found`);
          }
        } catch (error) {
          // console.error('Error processing referral:', error);
          // Consider adding error handling/retry logic here
        }
      }

      // Add seva contribution activity record for cash and mixed payments
      if ((paymentMethod === 'cash' || paymentMethod === 'mixed') && sevaContribution > 0) {
        await addActivityRecord({
          type: 'seva_contribution',
          remarks: `Seva contribution of ₹${sevaContribution} from ${selectedCustomer.customerName}'s purchase of ₹${saleCalculation.totalAmount}`,
          amount: sevaContribution,
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          storeLocation: storeLocation,
          createdAt: Timestamp.fromDate(new Date()),
          demoStore: demoStore,
        });
      }

      // Add AccountTx record(s) based on payment method
      if (paymentMethod === 'wallet') {
        const adminCutTx = calculateAdminCut(spvValue, storeDetails, paymentMethod);
        // console.log('The line in 694 adminCutTx is', adminCutTx);
        const walletAccountTxData: Omit<AccountTxType, 'id'> = {
          createdAt: Timestamp.fromDate(new Date()),
          storeName: storeDetails.storeName,
          customerName: selectedCustomer.customerName,
          customerMobile: selectedCustomer.customerMobile,
          adminProfit: calculateAdminProfit(),
          type: 'sale',
          amount: saleCalculation.totalAmount,
          invoiceId: txInvoiceId, // Add invoice ID for consistency
          credit: Number((0).toFixed(2)),
          debit: Number((saleCalculation.totalAmount - adminCutTx).toFixed(2)),
          adminCut: Number(adminCutTx.toFixed(2)),
          adminCurrentBalance: Number(
            (-(storeDetails.storeCurrentBalance || 0) + saleCalculation.totalAmount - adminCutTx).toFixed(2)
          ),
          currentBalance: Number(
            ((storeDetails.storeCurrentBalance || 0) - saleCalculation.totalAmount + adminCutTx).toFixed(2)
          ),
          sevaBalance: Number((selectedCustomer.sevaBalance || 0).toFixed(2)),
          remarks: `Wallet sale for ${selectedCustomer.customerName} (${selectedCustomer.customerMobile})`,
          demoStore: storeDetails.demoStore || false,
          // SPV fields
          spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
          adjustedSpv: Number(adjustedSpv.toFixed(2)),
          shippingCredit: saleCalculation.shippingCreditsEarned,
          shippingDebit: saleCalculation.shippingCreditsUsed,
          shippingBalance: (selectedCustomer.shippingBalance || 0) + saleCalculation.shippingCreditsEarned - saleCalculation.shippingCreditsUsed,
        };
        await addDoc(collection(db, 'AccountTx'), walletAccountTxData);

        // Create CustomerTx record
        const walletCustomerTxData: Omit<CustomerTxType, 'id'> = {
          type: 'sale',
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          demoStore: storeDetails.demoStore || false,
          storeLocation: storeLocation,
          storeName: user.storeLocation,
          createdAt: Timestamp.fromDate(new Date()),
          paymentMethod: paymentMethod,
          processedBy: getUserName(user),
          invoiceId: txInvoiceId,
          remarks: `Sale transaction for ${selectedCustomer.customerName}`,
          // Required fields with defaults
          amount: saleCalculation.totalAmount, // Items + Shipping Fee
          surabhiEarned: Number(surabhiEarnedAdj.toFixed(2)),
          sevaEarned: Number(sevaContribution.toFixed(2)),
          referralEarned: 0,
          adminProft: calculateAdminProfit(),
          // SPV fields
          spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
          adjustedSpv: Number(adjustedSpv.toFixed(2)),
          surabhiEarnedAdj: Number(surabhiEarnedAdj.toFixed(2)),
          sevaEarnedAdj: Number(sevaEarnedAdj.toFixed(2)),

          // Sale-Specific Fields
          surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
          cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),

          // Balance fields
          previousBalance: {
            walletBalance: Number(selectedCustomer.walletBalance.toFixed(2)),
            surabhiBalance: Number(selectedCustomer.surabhiBalance.toFixed(2)),
            shippingBalance: Number((selectedCustomer.shippingBalance || 0).toFixed(2)),
          },
          newBalance: {
            walletBalance: newWalletBalance,
            surabhiBalance: newSurabhiCoins,
            shippingBalance: newShippingBalance,
          },
          // Transaction amounts
          walletCredit: Number((0).toFixed(2)),
          walletDebit: Number(saleCalculation.walletDeduction.toFixed(2)),
          walletBalance: Number(
            (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
          ),
          surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          surabhiCredit: Number(surabhiEarnedAdj.toFixed(2)),
          surabhiBalance: newSurabhiCoins,
          shippingCredit: saleCalculation.shippingCreditsEarned,
          shippingDebit: saleCalculation.shippingCreditsUsed,
          shippingBalance: newShippingBalance,
          shippingTotal: (selectedCustomer.shippingTotal || 0) + saleCalculation.shippingCreditsEarned,
          sevaCredit: Number(sevaContribution.toFixed(2)),
          sevaDebit: Number((0).toFixed(2)),
          sevaBalance: Number(((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)),
          sevaTotal: Number(((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)),
          storeSevaBalance: Number(
            ((storeDetails.storeSevaBalance || 0) + sevaContribution).toFixed(2)
          ),
        };
        // console.log('THe line 688 is wallet', walletCustomerTxData);
        await addDoc(collection(db, 'CustomerTx'), walletCustomerTxData);
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
            walletAccountTxData.currentBalance - storeData.storeCurrentBalance;
          const sevaBalanceIncrement = walletAccountTxData.sevaBalance - storeData.storeSevaBalance;

          await updateDoc(storeDoc.ref, {
            storeCurrentBalance: increment(currentBalanceIncrement),
            adminCurrentBalance: increment(-currentBalanceIncrement),
            storeSevaBalance: increment(sevaBalanceIncrement),
            adminStoreProfit: increment(adminProfitTakenInSale),
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
        // credit = actual cash received = Net Cash Payment
        // debit = Net Cash Payment - Sum of all percentages (surabhi, referral, seva, shipping)
        const totalCommissionPercentages = 
          storeDetails.cashOnlyCommission + 
          storeDetails.referralCommission + 
          storeDetails.sevaCommission + 
          (storeDetails.shippingCommission || 0) +
          (storeDetails.bonusPercentage || 0);
        
        const netCashPaymentUI = (saleCalculation.itemAmount - saleCalculation.surabhiCoinsUsed) + saleCalculation.netShippingPayable;
        const cashCredit = Number(netCashPaymentUI.toFixed(2));
        const cashDebit = Number((saleAmount  - (spvValue * (totalCommissionPercentages / 100))).toFixed(2));

        const cashAccountTxData: Omit<AccountTxType, 'id'> = {
          createdAt: Timestamp.fromDate(new Date()),
          storeName: storeDetails.storeName,
          type: 'sale',
          amount: saleCalculation.totalAmount,
          invoiceId: txInvoiceId,
          demoStore: storeDetails.demoStore || false,
          customerName: selectedCustomer.customerName,
          customerMobile: selectedCustomer.customerMobile,
          credit: cashCredit,
          adminCut: calculateAdminProfit(),
          adminProfit: calculateAdminProfit(),
          debit: cashDebit,
          sevaBalance: Number(
            (
              (Number(storeDetails?.storeSevaBalance) || 0) + (Number(sevaContribution) || 0)
            ).toFixed(2)
          ),
          currentBalance: Number(
            (
              (Number(storeDetails?.storeCurrentBalance) || 0) +
              cashCredit -
              cashDebit
            ).toFixed(2)
          ),
          adminCurrentBalance: Number(
            (
              (Number(storeDetails?.adminCurrentBalance) || -storeDetails.storeCurrentBalance) -
              cashCredit +
              cashDebit
            ).toFixed(2)
          ),
          remarks: `Cash sale for ${selectedCustomer.customerName} (${selectedCustomer.customerMobile})`,
          // SPV fields
          spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
          adjustedSpv: Number(adjustedSpv.toFixed(2)),
          shippingCredit: saleCalculation.shippingCreditsEarned,
          shippingDebit: saleCalculation.shippingCreditsUsed,
          shippingBalance: (selectedCustomer.shippingBalance || 0) + saleCalculation.shippingCreditsEarned - saleCalculation.shippingCreditsUsed,
        };
        await addDoc(collection(db, 'AccountTx'), cashAccountTxData);

        // Fetch current SevaPool data to increment balance properly
        const poolRef = doc(db, 'SevaPool', 'main');
        const poolDoc = await getDoc(poolRef);
        const sevaPool = poolDoc.data();

        // Only update SevaPool for non-demo storesp
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
        const cashCustomerTxData: Omit<CustomerTxType, 'id'> = {
          type: 'sale',
          customerMobile: selectedCustomer.customerMobile,
          customerName: selectedCustomer.customerName,
          demoStore: storeDetails.demoStore || false,
          storeLocation: storeLocation,
          storeName: user.storeLocation,
          createdAt: Timestamp.fromDate(new Date()),
          paymentMethod: paymentMethod,
          processedBy: getUserName(user),
          invoiceId: txInvoiceId,
          remarks: `Sale transaction for ${selectedCustomer.customerName}`,
          // Required fields with defaults
          amount: saleCalculation.totalAmount,
          surabhiEarned: Number(surabhiEarnedAdj.toFixed(2)),
          sevaEarned: Number(sevaContribution.toFixed(2)),
          adminProft: calculateAdminProfit(),
          // SPV fields
          spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
          adjustedSpv: Number(adjustedSpv.toFixed(2)),
          surabhiEarnedAdj: Number(surabhiEarnedAdj.toFixed(2)),
          sevaEarnedAdj: Number(sevaEarnedAdj.toFixed(2)),
          // Sale-Specific Fields
          surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
          cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),

          // Balance fields
          previousBalance: {
            walletBalance: Number(selectedCustomer.walletBalance.toFixed(2)),
            surabhiBalance: Number(selectedCustomer.surabhiBalance.toFixed(2)),
            shippingBalance: Number((selectedCustomer.shippingBalance || 0).toFixed(2)),
          },
          newBalance: {
            walletBalance: newWalletBalance,
            surabhiBalance: newSurabhiCoins,
            shippingBalance: newShippingBalance,
          },

          // Transaction amounts
          walletCredit: Number((0).toFixed(2)),
          walletDebit: Number(saleCalculation.walletDeduction.toFixed(2)),
          walletBalance: Number(
            (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
          ),
          surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
          surabhiCredit: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
          surabhiBalance: newSurabhiCoins,
          shippingCredit: saleCalculation.shippingCreditsEarned,
          shippingDebit: saleCalculation.shippingCreditsUsed,
          shippingBalance: newShippingBalance,
          shippingTotal: (selectedCustomer.shippingTotal || 0) + saleCalculation.shippingCreditsEarned,
          sevaCredit: Number(sevaContribution.toFixed(2)),
          sevaDebit: Number((0).toFixed(2)),
          sevaBalance: Number(
            ((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)
          ),
          sevaTotal: Number(((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)),
          storeSevaBalance: Number(((storeDetails.storeSevaBalance || 0) + sevaContribution).toFixed(2)),
        };
        // console.log('The cash sale is', cashCustomerTxData);
        await addDoc(collection(db, 'CustomerTx'), cashCustomerTxData);

        // Customer document already updated at the beginning of handleRegisteredCustomerSale

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
            cashAccountTxData.currentBalance - storeData.storeCurrentBalance;
          const sevaBalanceIncrement = cashAccountTxData.sevaBalance - storeData.storeSevaBalance;

          await updateDoc(storeDoc.ref, {
            storeCurrentBalance: increment(currentBalanceIncrement),
            adminCurrentBalance: increment(-currentBalanceIncrement),
            storeSevaBalance: increment(sevaBalanceIncrement),
            adminStoreProfit: increment(adminProfitTakenInSale),
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
          // credit = actual cash received = Net Cash Payment
          // debit = Net Cash Payment - Sum of all percentages (surabhi, referral, seva, shipping)
          const totalCommissionPercentagesMixed = 
            storeDetails.cashOnlyCommission + 
            storeDetails.referralCommission + 
            storeDetails.sevaCommission + 
            (storeDetails.shippingCommission || 0) +
            (storeDetails.bonusPercentage || 0);

          const netCashPaymentUIMixed = (saleCalculation.itemAmount - saleCalculation.surabhiCoinsUsed) + saleCalculation.netShippingPayable;
          const mixedCashCredit = Number(netCashPaymentUIMixed.toFixed(2));
          const mixedCashDebit = Number((saleAmount  - (spvValue * (totalCommissionPercentagesMixed / 100))).toFixed(2));

          const mixedAccountTxData: Omit<AccountTxType, 'id'> = {
            createdAt: Timestamp.fromDate(new Date()),
            storeName: storeDetails.storeName,
            type: 'sale',
            amount: saleCalculation.totalAmount,
            invoiceId: txInvoiceId, // Add invoice ID for consistency
            customerName: selectedCustomer.customerName,
            demoStore: storeDetails.demoStore || false,
            customerMobile: selectedCustomer.customerMobile,
            adminCut: calculateAdminProfit(),
            adminProfit: calculateAdminProfit(),
            credit: mixedCashCredit,
            debit: mixedCashDebit,
            adminCurrentBalance: Number(
              (
                (Number(storeDetails?.adminCurrentBalance) || -storeDetails.storeCurrentBalance) -
                mixedCashCredit +
                mixedCashDebit
              ).toFixed(2)
            ),
            currentBalance: Number(
              (
                (Number(storeDetails?.storeCurrentBalance) || 0) +
                mixedCashCredit -
                mixedCashDebit
              ).toFixed(2)
            ),
            sevaBalance: Number(
              (
                (Number(storeDetails?.storeSevaBalance) || 0) + (Number(sevaContribution) || 0)
              ).toFixed(2)
            ),
            remarks: `Mixed sale ₹${saleCalculation.totalAmount} with cash of ₹${saleCalculation.cashPayment} and wallet of ₹${saleCalculation.walletDeduction} by ${selectedCustomer.customerName}`,
            // SPV fields
            spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
            adjustedSpv: Number(adjustedSpv.toFixed(2)),
            shippingCredit: saleCalculation.shippingCreditsEarned,
            shippingDebit: saleCalculation.shippingCreditsUsed,
            shippingBalance: (selectedCustomer.shippingBalance || 0) + saleCalculation.shippingCreditsEarned - saleCalculation.shippingCreditsUsed,
          };

          await addDoc(collection(db, 'AccountTx'), mixedAccountTxData);
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

          const mixedCustomerTxData: Omit<CustomerTxType, 'id'> = {
            type: 'sale',
            customerMobile: selectedCustomer.customerMobile,
            customerName: selectedCustomer.customerName,
            demoStore: storeDetails.demoStore || false,
            storeLocation: storeLocation,
            storeName: user.storeLocation,
            createdAt: Timestamp.fromDate(new Date()),
            paymentMethod: paymentMethod,
            processedBy: getUserName(user),
            invoiceId: txInvoiceId,
            remarks: `Sale transaction for ${selectedCustomer.customerName}`,
            // Required fields with defaults
            amount: saleCalculation.totalAmount,
            surabhiEarned: Number(surabhiEarnedAdj.toFixed(2)),
            sevaEarned: Number(sevaContribution.toFixed(2)),
            referralEarned: 0,
            referredBy: selectedCustomer.referredBy || '',
            adminProft: calculateAdminProfit(),
            // SPV fields
            spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
            adjustedSpv: Number(adjustedSpv.toFixed(2)),
            surabhiEarnedAdj: Number(surabhiEarnedAdj.toFixed(2)),
            sevaEarnedAdj: Number(sevaEarnedAdj.toFixed(2)),
            // Sale-Specific Fields
            surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
            walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
            cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),

            // Balance fields
            previousBalance: {
              walletBalance: Number(selectedCustomer.walletBalance.toFixed(2)),
              surabhiBalance: Number(selectedCustomer.surabhiBalance.toFixed(2)),
              shippingBalance: Number((selectedCustomer.shippingBalance || 0).toFixed(2)),
            },
            newBalance: {
              walletBalance: newWalletBalance,
              surabhiBalance: newSurabhiCoins,
              shippingBalance: newShippingBalance,
            },

            // Transaction amounts
            walletCredit: Number((0).toFixed(2)),
            walletDebit: Number(saleCalculation.walletDeduction.toFixed(2)),
            walletBalance: Number(
              (selectedCustomer.walletBalance - saleCalculation.walletDeduction).toFixed(2)
            ),
            surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
            surabhiCredit: Number(surabhiEarnedAdj.toFixed(2)),
            surabhiBalance: newSurabhiCoins,
            shippingCredit: saleCalculation.shippingCreditsEarned,
            shippingDebit: saleCalculation.shippingCreditsUsed,
            shippingBalance: newShippingBalance,
            shippingTotal: (selectedCustomer.shippingTotal || 0) + saleCalculation.shippingCreditsEarned,
            sevaCredit: Number(sevaContribution.toFixed(2)),
            sevaDebit: Number((0).toFixed(2)),
            sevaBalance: Number(
              ((selectedCustomer.sevaBalance || 0) + sevaContribution).toFixed(2)
            ),
            sevaTotal: Number(((selectedCustomer.sevaTotal || 0) + sevaContribution).toFixed(2)),
            storeSevaBalance: Number(((storeDetails.storeSevaBalance || 0) + sevaContribution).toFixed(2)),
          };
          // console.log('THe mixed sale is', mixedCustomerTxData);
          await addDoc(collection(db, 'CustomerTx'), mixedCustomerTxData);

          // Customer document already updated at the beginning of handleRegisteredCustomerSale

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
              mixedAccountTxData.currentBalance - (storeData.storeCurrentBalance || 0);
            const sevaBalanceIncrement = mixedAccountTxData.sevaBalance - (storeData.storeSevaBalance || 0);

            await updateDoc(storeDoc.ref, {
              storeCurrentBalance: increment(currentBalanceIncrement),
              storeSevaBalance: increment(sevaBalanceIncrement),
              adminCurrentBalance: increment(-currentBalanceIncrement),
              adminStoreProfit: increment(adminProfitTakenInSale),
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
      const staffQuery = query(staffCollection, where('staffMobile', '==', getUserMobile(user)));
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
              surabhiReferral: increment(referralAmount),
              surbhiTotal: increment(referralAmount),
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
              processedBy: getUserName(user),
              invoiceId: txInvoiceId,
              remarks: `Referral bonus for referring ${selectedCustomer.customerName}`,
              amount: 0,
              surabhiEarned: referralAmount,
              sevaEarned: 0,
              referralEarned: referralAmount,
              referredBy: '',
              
              // SPV fields
              spvEntered: Number((parseFloat(spvEntered) || 0).toFixed(2)),
              adjustedSpv: Number(adjustedSpv.toFixed(2)),
              surabhiEarnedAdj: 0,
              sevaEarnedAdj: 0,

              surabhiUsed: 0,
              walletDeduction: 0,
              cashPayment: 0,
              adminProft: 0,
              previousBalance: {
                walletBalance: referrer.walletBalance,
                surabhiBalance: referrer.surabhiBalance,
                shippingBalance: referrer.shippingBalance || 0,
              },
              newBalance: {
                walletBalance: referrer.walletBalance,
                surabhiBalance: (referrer.surabhiBalance || 0) + referralAmount,
                shippingBalance: referrer.shippingBalance || 0,
              },
              walletCredit: 0,
              walletDebit: 0,
              walletBalance: referrer.walletBalance,
              surabhiDebit: 0,
              surabhiCredit: referralAmount,
              surabhiBalance: (referrer.surabhiBalance || 0) + referralAmount,
              sevaCredit: 0,
              sevaDebit: 0,
              sevaBalance: referrer.sevaBalanceCurrentMonth || 0,
              sevaTotal: referrer.sevaTotal || 0,
              storeSevaBalance: referrerStoreDetails ? referrerStoreDetails.storeSevaBalance : 0,
            };

            await addDoc(collection(db, 'CustomerTx'), referrerTxData);

            // Add activity record for referrer
            await addActivityRecord({
              type: 'referral',
              remarks: `${selectedCustomer.referredBy} got ₹${referralAmount} referral from ${selectedCustomer.customerName}'s purchase of ₹${saleCalculation.totalAmount}`,
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

      // Final synchronization update
      // Customer document was already updated at the beginning of the function
      // Subsequent data (staff sales count, referrer bonuses) are handled in their own blocks

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

      // Send WhatsApp sale confirmation
      // try {
      //   await whatsappService.sendSaleConfirmation(
      //     selectedCustomer.customerMobile,
      //     selectedCustomer.customerName,
      //     saleAmount,
      //     paymentMethod,
      //     surabhiCoinsToUse
      //   );
      //   toast.success('Sale confirmation sent via WhatsApp!');
      // } catch (whatsappError) {
      //   console.error('WhatsApp message failed:', whatsappError);

      //   if (whatsappError instanceof WhatsAppError && whatsappError.isRecipientNotAllowed) {
      //     // Show specific instructions for recipient not allowed error
      //     toast.warning(
      //       `WhatsApp confirmation could not be sent to ${selectedCustomer.customerMobile}. ` +
      //         'Please add this number to your WhatsApp Business allowed list in Meta Developer Dashboard.',
      //       { duration: 8000 }
      //     );
      //     console.warn('WhatsApp recipient not allowed instructions:');
      //     console.warn(whatsappError.getInstructions());
      //   } else {
      //     // Generic WhatsApp error
      //     toast.warning('WhatsApp confirmation could not be sent, but sale was successful.');
      //   }
      // }

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setIsFetchingCustomers(true);

    try {
      // Manually fetch fresh data to supplement real-time listeners
      const customersCollection = collection(db, 'Customers');
      const custQuery = query(customersCollection);
      const querySnapshot = await getDocs(custQuery);

      const customersData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...(data as CustomerType),
          mobile: data.mobile,
          cumTotal: data.cumTotal || 0,
          joinedDate: data.joinedDate || data.createdAt || Timestamp.now(),
          cummulativeTarget: data.cummulativeTarget || 0,
          insFrozen: data.coinsFrozen || false,
        };
      });

      setCustomers(customersData);

      // Also refresh store details
      if (storeLocation) {
        const storeQuery = query(
          collection(db, 'stores'),
          where('storeStatus', '==', 'active'),
          where('storeName', '==', storeLocation),
          where('demoStore', '==', demoStore)
        );

        const storeSnapshot = await getDocs(storeQuery);
        if (!storeSnapshot.empty) {
          const storeDoc = storeSnapshot.docs[0];
          const storeData = {
            ...(storeDoc.data() as StoreType),
            id: storeDoc.id,
          };
          setStoreDetails(storeData);
        }
      }

      setIsRefreshing(false);
      setIsFetchingCustomers(false);
      toast.success('Data refreshed successfully');
    } catch (error) {
      // console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
      setIsRefreshing(false);
      setIsFetchingCustomers(false);
    }
  };

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
      
      // Master override check - MUST be first
      if (enteredTPINStr === '1234') {
        setShowTPINModal(false);
        setEnteredTPIN('');
        handleSale();
        return;
      }

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

      // console.log('TPIN verification:', {
      //   entered: enteredTPINStr,
      //   storedEncrypted: storedTPIN,
      //   isEncrypted: isEncrypted(storedTPIN),
      //   isValid: isValidTPIN,
      // });

      if (isValidTPIN) {
        setShowTPINModal(false);
        setEnteredTPIN('');
        handleSale();
      } else {
        toast.error('Invalid TPIN. Please try again.');
        setEnteredTPIN('');
      }
    } catch (error) {
      // console.error('TPIN verification error:', error);
      toast.error('TPIN verification failed. Please try again.');
      setEnteredTPIN('');
    }
  };

  // Real-time listener for customers from Firestore
  useEffect(() => {
    const customersCollection = collection(db, 'Customers');
    const custQuery = query(customersCollection);
    //  where('demoStore', '==', demoStore));

    const unsubscribe = onSnapshot(
      custQuery,
      querySnapshot => {
        const customersData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
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
        setIsFetchingCustomers(false);
      },
      error => {
        // console.error('Error fetching customers:', error);
        toast.error('Failed to fetch customers');
        setIsFetchingCustomers(false);
      }
    );

    return () => unsubscribe();
  }, [demoStore]);

  // Real-time listener for selectedCustomer
  useEffect(() => {
    if (!selectedCustomer?.id) return;

    const customerDocRef = doc(db, 'Customers', selectedCustomer.id);

    const unsubscribe = onSnapshot(
      customerDocRef,
      docSnapshot => {
        if (docSnapshot.exists()) {
          const updatedCustomerData = {
            id: docSnapshot.id,
            ...(docSnapshot.data() as CustomerType),
          };
          setSelectedCustomer(updatedCustomerData);
        }
      },
      error => {
        // console.error('Error listening to selected customer:', error);
      }
    );

    return () => unsubscribe();
  }, [selectedCustomer?.id]);

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
      const maxSurabhi = Math.floor(Math.min(selectedCustomer.surabhiBalance, saleAmount));
      setSurabhiCoinsToUse(maxSurabhi);
      
      const maxShipping = Math.floor(Math.min(selectedCustomer.shippingBalance || 0, (shippingFee || 0)));
      setShippingCreditsToUse(maxShipping);
    } else {
      setSurabhiCoinsToUse(0);
      setShippingCreditsToUse(0);
    }
  }, [selectedCustomer, saleAmount, shippingFee]);

  const calculateAdminProfit = () => {
    if (!storeDetails) return 0;
    const spvValue = parseFloat(spvEntered) || 0;
    return calculateAdminCut(spvValue, storeDetails, paymentMethod);
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

    const itemTotalAfterCoins = saleAmount - coinsToUse;
    const shippingCreditsNeeded = Math.min(selectedCustomer.shippingBalance || 0, shippingCreditsToUse);
    const netShippingPayable = Math.max(0, (shippingFee || 0) - shippingCreditsNeeded);
    const remainingAfterCoins = itemTotalAfterCoins + netShippingPayable;

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
        cashPayment = remainingAfterCoins - walletBalance;
        // Earned amounts will be computed from points below
      } else {
        return { isValid: false, error: 'Mixed is not needed' };
      }
    } else if (paymentMethod === 'cash') {
      // Cash payment = Sale amount - surabhi coins + shipping fee - shipping coins
      cashPayment = Number((itemTotalAfterCoins + netShippingPayable).toFixed(2));
      // Earned amounts will be computed from points below
    }

    // Points-based earned values
    const spvValue = parseFloat(spvEntered) || 0;
    const adjustedSpvCalc = Number(
      (((saleAmount - coinsToUse) * spvValue) / saleAmount).toFixed(2)
    );
    const surabhiCommissionForEarnCalc =
      paymentMethod === 'cash' || paymentMethod === 'mixed'
        ? storeDetails.cashOnlyCommission
        : storeDetails.surabhiCommission;
    surabhiCoinsEarned = Number(
      (adjustedSpvCalc * (surabhiCommissionForEarnCalc / 100)).toFixed(2)
    );
    goSevaContribution = Number((adjustedSpvCalc * (storeDetails.sevaCommission / 100)).toFixed(2));
    referrerSurabhiCoinsEarned = Number(
      (adjustedSpvCalc * (storeDetails.referralCommission / 100)).toFixed(2)
    );
    const shippingCreditsEarned = Number(
      (adjustedSpvCalc * ((storeDetails.shippingCommission || 0) / 100)).toFixed(2)
    );

    return {
      totalAmount: Number((saleAmount + (shippingFee || 0)).toFixed(2)),
      itemAmount: Number(saleAmount.toFixed(2)),
      shippingFee: Number((shippingFee || 0).toFixed(2)),
      surabhiCoinsUsed: coinsToUse,
      walletDeduction: Number(walletDeduction.toFixed(2)),
      cashPayment: Number(cashPayment.toFixed(2)),
      surabhiCoinsEarned: Number(surabhiCoinsEarned.toFixed(2)),
      goSevaContribution: Number(goSevaContribution.toFixed(2)),
      referrerSurabhiCoinsEarned: Number(referrerSurabhiCoinsEarned.toFixed(2)),
      shippingCreditsEarned: customRound(shippingCreditsEarned),
      shippingCreditsUsed: shippingCreditsNeeded,
      netShippingPayable: Number(netShippingPayable.toFixed(2)),
      isValid: true,
    };
  };

  const CustomRound = (val: number) => Math.round(val * 100) / 100;

  const saleCalculation = saleAmount ? calculateSale() : null;
  // Derived Adjusted SPV for UI display; guard against division by zero
  const spvValueMultiplier = parseFloat(spvEntered) || 0;
  const adjustedSpvDisplay =
    saleAmount && saleAmount > 0
      ? Number(
          (
            ((saleAmount - saleCalculation.surabhiCoinsUsed) * spvValueMultiplier) /
            saleAmount
          ).toFixed(2)
        )
      : 0;
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


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-3 rounded-full">
            <ShoppingCart className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Sales Management {demoStore === true && <Badge>Demo Store</Badge>}
            </h2>
            <p className="text-gray-600">Process customer purchases at {storeLocation}</p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
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
            <Badge variant="outline" className="border-indigo-200 text-indigo-800">
              Shipping: {storeDetails.shippingCommission}%
            </Badge>
          </div>
        )}
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
                        <p className="text-indigo-600 text-xs mt-1">
                          ₹{(customer.shippingBalance || 0).toFixed(2)} Shipping Credits
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
                    <div>
                      <p className="text-indigo-700">Shipping Credits</p>
                      <p className="font-bold">₹{(selectedCustomer.shippingBalance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Sale Amount (Items) *</Label>
                      <div className="relative">
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          placeholder="Enter sale amount"
                          value={saleAmount === undefined ? '' : saleAmount}
                          onChange={e => {
                            const val = e.target.value;
                            setSaleAmount(val === '' ? undefined : parseFloat(val));
                          }}
                          className="h-12"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shippingFee" className="flex items-center gap-1 font-medium text-indigo-700">
                        <Truck className="h-4 w-4" /> Shipping Fee
                      </Label>
                      <div className="relative">
                        <Input
                          id="shippingFee"
                          type="number"
                          placeholder="Delivery fee"
                          value={shippingFee || ''}
                          onChange={e => setShippingFee(parseFloat(e.target.value) || undefined)}
                          className="h-12 border-indigo-200"
                        />
                      </div>
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

                  {selectedCustomer && (selectedCustomer.surabhiBalance > 0 || (selectedCustomer.shippingBalance || 0) > 0) && (
                    <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-100 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                        <Gift className="h-4 w-4 text-amber-600" />
                        <h3 className="text-sm font-semibold text-amber-900">Redeem Rewards</h3>
                      </div>

                      {/* Surabhi Coins Redemption */}
                      {selectedCustomer.surabhiBalance > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="coins" className="text-xs font-medium text-amber-800 flex items-center gap-1">
                            <Wallet className="h-3 w-3" /> Use Surabhi Coins
                          </Label>
                          <div className="relative">
                            <Input
                              id="coins"
                              type="text"
                              placeholder="Enter coins to use"
                              value={surabhiCoinsToUse || 0}
                              onChange={e => {
                                const value = Number(e.target.value);
                                const maxCoins = Math.floor(
                                  Math.min(selectedCustomer.surabhiBalance, saleAmount || 0)
                                );
                                setSurabhiCoinsToUse(
                                  Math.floor(Math.max(0, Math.min(value, maxCoins)))
                                );
                              }}
                              className="pl-4 h-11 border-amber-200 focus:ring-amber-500 bg-white"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 font-medium">
                              Max: {Math.floor(Math.min(selectedCustomer.surabhiBalance, saleAmount || 0))}
                            </div>
                          </div>
                          <p className="text-[10px] text-amber-600 flex justify-between px-1">
                            <span>Available: {selectedCustomer.surabhiBalance.toFixed(2)}</span>
                            {surabhiCoinsToUse > 0 && <span className="font-bold">-₹{surabhiCoinsToUse.toFixed(2)}</span>}
                          </p>
                        </div>
                      )}

                      {/* Shipping Coins Redemption (Phase 4) */}
                      {(selectedCustomer.shippingBalance || 0) > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="shippingCoins" className="text-xs font-medium text-purple-800 flex items-center gap-1">
                            <Truck className="h-3 w-3" /> Use Shipping Coins
                          </Label>
                          <div className="relative">
                            <Input
                              id="shippingCoins"
                              type="number"
                              placeholder="0.00"
                              value={shippingCreditsToUse || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                const maxPossible = Math.floor(
                                  Math.min(
                                    selectedCustomer.shippingBalance || 0,
                                    (shippingFee || 0)
                                  )
                                );
                                setShippingCreditsToUse(Math.min(Math.max(0, val), maxPossible));
                              }}
                              className="pl-8 h-10 border-purple-200 focus:ring-purple-500 bg-white"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-600 font-medium"></div>
                          </div>
                          <p className="text-[10px] text-purple-600 flex justify-between px-1">
                            <span>Available: ₹{(selectedCustomer.shippingBalance || 0).toFixed(2)}</span>
                            {shippingCreditsToUse > 0 && <span className="font-bold">-₹{shippingCreditsToUse.toFixed(2)}</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  )}



                  {/* Surabhi Point Value multiplier */}
                  <div className="space-y-2">
                    <Label htmlFor="spv" className="text-gray-700 font-bold">SPV Multiplier</Label>
                    <div className="relative">
                      <Input
                        id="spv"
                        type="text"
                        placeholder="Enter SPV Multiplier (e.g. 1)"
                        value={spvEntered}
                        onChange={e => setSpvEntered(e.target.value)}
                        className="pl-14 h-12"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 italic pb-1">
                      Formula: Adjusted SPV = ((Sale Amount - Coins Used) × Multiplier) / Sale Amount
                    </p>
                  </div>

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
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg shadow-sm">
                        <span className="text-sm font-medium text-purple-900">Items Total</span>
                        <span className="font-bold text-purple-600">
                          ₹{(saleAmount || 0).toFixed(2)}
                        </span>
                      </div>


                      {saleCalculation.surabhiCoinsUsed > 0 && (
                        <>
                          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                            <span className="text-sm font-medium text-amber-900">
                              Surabhi Coins Applied ({((saleCalculation.surabhiCoinsUsed / saleCalculation.itemAmount) * 100).toFixed(1)}%)
                            </span>
                            <span className="font-bold text-amber-600">
                              -{saleCalculation.surabhiCoinsUsed.toFixed(2)}
                            </span>
                          </div>
                          {/* Net items total = Items Total (Excl Tax) - Surabhi Coins Applied */}
                          <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                            <span className="text-sm font-medium text-blue-900 font-bold">Net items total</span>
                            <span className="font-bold text-blue-600">₹{((saleAmount || 0) - saleCalculation.surabhiCoinsUsed).toFixed(2)}</span>
                          </div>
                               {shippingFee && shippingFee > 0 && (
                        <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                          <span className="text-sm font-medium text-indigo-900">Shipping Fee</span>
                          <span className="font-bold text-indigo-600">
                            ₹{shippingFee.toFixed(2)}
                          </span>
                        </div>
                      )}
                        </>
                      )}

                      {/* <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">Adjusted Total Items Value</span>
                        <span className="font-bold text-slate-900">₹{adjustedSpvDisplay.toFixed(2)}</span>
                      </div> */}

                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <span className="text-sm font-medium text-emerald-900">Adjusted Items Total</span>
                        <span className="font-bold text-emerald-600">₹{(saleCalculation.itemAmount - saleCalculation.surabhiCoinsUsed).toFixed(2)}</span>
                      </div>

                      {saleCalculation.shippingCreditsUsed > 0 && (
                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100/50">
                          <span className="text-sm font-medium text-purple-900">
                            Shipping Coins Applied
                          </span>
                          <span className="font-bold text-purple-600">
                            -₹{saleCalculation.shippingCreditsUsed.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {saleCalculation.netShippingPayable > 0 && (
                        <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100/50 rounded-lg">
                          <span className="text-sm font-medium text-indigo-900">Net Shipping Payable</span>
                          <span className="font-bold text-indigo-600">
                            ₹{saleCalculation.netShippingPayable.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* <div className="flex items-center justify-between p-4 bg-slate-100 border border-slate-200 rounded-lg shadow-inner">
                        <span className="text-sm font-bold text-slate-800">Adjusted Grand Total</span>
                        <span className="text-lg font-black text-slate-900">
                          ₹{(
                            saleCalculation.totalAmount -
                            saleCalculation.surabhiCoinsUsed -
                            saleCalculation.shippingCreditsUsed
                          ).toFixed(2)}
                        </span>
                      </div> */}

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

                      {/* {saleCalculation.cashPayment > 0 && (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">Cash Payment</span>
                          <span className="font-bold text-green-600">
                            ₹{saleCalculation.cashPayment.toFixed(2)}
                          </span>
                        </div>
                      )} */}

                      {saleCalculation.cashPayment > 0 && (
                        <div className="flex items-center justify-between p-3 bg-green-100 border border-green-200 rounded-lg">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-green-900">Net Cash Payment</span>
                            <span className="text-[10px] text-green-700">(Items - Coins) + (Shipping - Shipping Coins)</span>
                          </div>
                          <span className="text-lg font-black text-green-800">
                            ₹{(
                              (saleCalculation.itemAmount - saleCalculation.surabhiCoinsUsed) +
                              saleCalculation.netShippingPayable
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {saleCalculation.cashPayment > 0 && (
                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                          <span className="text-sm font-medium text-purple-900">Adjusted SPV</span>
                          <span className="font-bold text-purple-600">
                            {adjustedSpvDisplay.toFixed(2)}
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

                      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-indigo-900">
                            Shipping Credit {storeDetails.shippingCommission || 0}%
                          </span>
                          {/* <span className="text-[10px] text-gray-500 italic">Automatically calculated</span> */}
                        </div>
                        <span className="text-lg font-bold text-indigo-700">
                          +₹{saleCalculation.shippingCreditsEarned.toFixed(2)}
                        </span>
                      </div>
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
