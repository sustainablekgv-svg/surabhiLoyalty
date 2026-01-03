
import { db } from '@/lib/firebase';
import { AccountTxType, CustomerTxType, CustomerType, StoreType } from '@/types/types';
import { updateCustomerQuarterlyTarget } from '@/utils/quarterlyTargets';
import {
    addDoc,
    collection,
    doc,
    getDocs,
    increment,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';

// --- Types ---

export interface SaleCalculation {
  totalAmount: number;
  surabhiCoinsUsed: number;
  walletDeduction: number;
  cashPayment: number;
  surabhiCoinsEarned: number;
  goSevaContribution: number;
  referrerSurabhiCoinsEarned: number;
}

// --- Utils ---

export const customRound = (num: number): number => {
  return Math.round(num * 100) / 100;
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
    console.error('Error fetching customer for sales logic:', error);
    return null;
  }
};

export const calculateAdminCut = (
  spvBase: number,
  storeDetails: StoreType,
  paymentMethod: 'wallet' | 'cash' | 'mixed'
) => {
  if (!storeDetails) return 0;
  
  // For Online (treated as cash/external), use cash commission or surabhi?
  // SalesManagement uses 'cashOnlyCommission' for 'cash' or 'mixed'.
  // Using that for consistency.
  const surabhiCommissionForEarn =
    paymentMethod === 'cash' || paymentMethod === 'mixed'
      ? storeDetails.cashOnlyCommission
      : storeDetails.surabhiCommission;

  const surabhiPart = customRound(spvBase * (surabhiCommissionForEarn / 100));
  const referralPart = customRound(spvBase * (storeDetails.referralCommission / 100));
  const sevaPart = customRound(spvBase * (storeDetails.sevaCommission / 100));
  const bonusPart = customRound(spvBase * ((storeDetails.bonusPercentage || 0) / 100));

  return referralPart + sevaPart + surabhiPart + bonusPart;
};


// --- Sales Logic ---

export const calculateSale = (
  amount: number,
  customer: CustomerType,
  storeDetails: StoreType,
  paymentMethod: 'wallet' | 'cash' | 'mixed',
  // surabhiCoinsToUse: number = 0 // Removed as unused in online flow
): SaleCalculation => {
  const totalAmount = Number(amount);
  let walletDeduction = 0;
  let surabhiCoinsUsed = 0;
  let cashPayment = totalAmount; // Default for Online is full payment

  // SPV Calculation (Surabhi Point Value)
  // Currently assuming SPV = Sale Amount.
  const spv = amount; 

  // Commissions
  const selectedCommission = storeDetails.cashOnlyCommission || 0; 
  const sevaCommission = storeDetails.sevaCommission || 0;
  const referralCommission = storeDetails.referralCommission || 0;

  // Calculate earnings
  const surabhiCoinsEarned = customRound((Number(spv) * selectedCommission) / 100);
  const goSevaContribution = customRound((Number(spv) * sevaCommission) / 100);
  const referrerSurabhiCoinsEarned = customRound((Number(spv) * referralCommission) / 100);

  return {
    totalAmount,
    surabhiCoinsUsed, 
    walletDeduction, 
    cashPayment,
    surabhiCoinsEarned,
    goSevaContribution,
    referrerSurabhiCoinsEarned
  };
};

export const processSaleTransaction = async (params: {
    orderId: string,
    invoiceId: string,
    amount: number,
    customer: CustomerType,
    storeDetails: StoreType,
    user: any, 
    paymentMethod: 'online' | 'cod', // Input type
    paymentDetails?: any
}) => {
    const { orderId, invoiceId, amount, customer, storeDetails, user, paymentMethod, paymentDetails } = params;
    
    // We only process sales logic (coins/ledger) for ONLINE payments right now.
    // COD is treated as "Pending" until delivery/payment confirmation (future task).
    if (paymentMethod === 'cod') {
        return;
    }

    // Treat 'online' as 'cash' for calculation logic (External Money)
    const methodForCalc = 'cash'; 
    
    // 1. Calculate Sale details
    const saleCalculation = calculateSale(amount, customer, storeDetails, methodForCalc);
    
    const spvEntered = amount;
    const adjustedSpv = amount; 
    const surabhiEarnedAdj = saleCalculation.surabhiCoinsEarned;
    const sevaEarnedAdj = saleCalculation.goSevaContribution;
    const sevaContribution = saleCalculation.goSevaContribution;

    // 2. Admin Cut
    const adminCutTx = calculateAdminCut(adjustedSpv, storeDetails, methodForCalc);
    const adminProfitTaken = adminCutTx; 

    // 3. Create AccountTx (Store Ledger)
    const accountTxData: Omit<AccountTxType, 'id'> = {
        createdAt: Timestamp.fromDate(new Date()),
        storeName: storeDetails.storeName,
        type: 'sale',
        amount: Number(amount.toFixed(2)),
        invoiceId: invoiceId,
        demoStore: storeDetails.demoStore || false,
        customerName: customer.customerName,
        customerMobile: customer.customerMobile,
        credit: Number(saleCalculation.cashPayment.toFixed(2)),
        adminCut: Number(adminCutTx.toFixed(2)),
        adminProfit: Number(adminProfitTaken.toFixed(2)),
        debit: Number((amount - adminCutTx).toFixed(2)),
        sevaBalance: Number(((Number(storeDetails?.storeSevaBalance) || 0) + (Number(sevaContribution) || 0)).toFixed(2)),
        currentBalance: Number(((Number(storeDetails?.storeCurrentBalance) || 0) + amount - amount + adminCutTx).toFixed(2)), // Store gets adminCut/profit added?
        adminCurrentBalance: Number((-storeDetails.storeCurrentBalance + adminCutTx).toFixed(2)), 
        remarks: `Online sale for ${customer.customerName} via Order #${orderId}`,
        spvEntered: Number(spvEntered.toFixed(2)),
        adjustedSpv: Number(adjustedSpv.toFixed(2)),
    };
    
    await addDoc(collection(db, 'AccountTx'), accountTxData);

    // 4. Update Seva Pool
    if (!storeDetails?.demoStore) {
        const poolRef = doc(db, 'SevaPool', 'main');
        await updateDoc(poolRef, {
            currentSevaBalance: increment(sevaContribution),
            contributionsCurrentMonth: increment(1),
            totalContributions: increment(1),
        });
    }

    // 5. Create CustomerTx (Customer Ledger)
    const customerTxData: Omit<CustomerTxType, 'id'> = {
        type: 'sale',
        customerMobile: customer.customerMobile,
        customerName: customer.customerName,
        demoStore: storeDetails.demoStore || false,
        storeLocation: customer.storeLocation || storeDetails.storeName,
        storeName: storeDetails.storeName,
        createdAt: Timestamp.fromDate(new Date()),
        paymentMethod: 'online', // Mapped
        processedBy: 'Online System',
        invoiceId: invoiceId,
        remarks: `Online Order #${orderId}`,
        amount: amount,
        surabhiEarned: Number(surabhiEarnedAdj.toFixed(2)),
        sevaEarned: Number(sevaContribution.toFixed(2)),
        referralEarned: 0,
        referredBy: customer.referredBy || '',
        adminProft: Number(adminCutTx.toFixed(2)),
        spvEntered: Number(spvEntered.toFixed(2)),
        adjustedSpv: Number(adjustedSpv.toFixed(2)),
        surabhiEarnedAdj: Number(surabhiEarnedAdj.toFixed(2)),
        sevaEarnedAdj: Number(sevaEarnedAdj.toFixed(2)),
        surabhiUsed: 0,
        walletDeduction: 0,
        cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),
        
        // Balances 
        previousBalance: {
            walletBalance: Number(customer.walletBalance.toFixed(2)),
            surabhiBalance: Number(customer.surabhiBalance.toFixed(2)),
        },
        newBalance: {
            walletBalance: Number(customer.walletBalance.toFixed(2)),
            surabhiBalance: Number((customer.surabhiBalance + saleCalculation.surabhiCoinsEarned).toFixed(2)),
        },
        walletCredit: 0,
        walletDebit: 0,
        walletBalance: Number(customer.walletBalance.toFixed(2)),
        surabhiDebit: 0,
        surabhiCredit: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
        surabhiBalance: Number((customer.surabhiBalance + saleCalculation.surabhiCoinsEarned).toFixed(2)),
        sevaCredit: Number(sevaContribution.toFixed(2)),
        sevaDebit: 0,
        sevaBalance: Number(((customer.sevaBalanceCurrentMonth || 0) + sevaContribution).toFixed(2)),
        sevaTotal: Number(((customer.sevaTotal || 0) + sevaContribution).toFixed(2)),
        storeSevaBalance: Number((storeDetails.storeSevaBalance + sevaContribution).toFixed(2)),
    };
    
    await addDoc(collection(db, 'CustomerTx'), customerTxData);

    // 6. Update Customer Document
    const customerRef = doc(db, 'Customers', customer.id);
    const newCumTotal = customRound((customer.cumTotal || 0) + amount);
    const isEligible = customer.isStudent ? newCumTotal >= 499 : newCumTotal >= 999;
    const shouldUpdateEligibility = isEligible && customer.saleElgibility !== true;

    const updateData: any = {
        surabhiBalance: increment(saleCalculation.surabhiCoinsEarned),
        sevaBalance: increment(sevaContribution),
        sevaTotal: increment(sevaContribution),
        cumTotal: newCumTotal,
        lastTransactionDate: serverTimestamp(),
    };

    if (shouldUpdateEligibility) {
        updateData.saleElgibility = true;
    }

    // Update Quarterly Target
    const updatedCustomerState = { ...customer, cumTotal: newCumTotal };
    const quarterlyTargetUpdate = updateCustomerQuarterlyTarget(updatedCustomerState);
    Object.assign(updateData, quarterlyTargetUpdate);

    await updateDoc(customerRef, updateData);

    // 7. Update Store Balances
    const storeRef = doc(db, 'stores', storeDetails.id);
    
    await updateDoc(storeRef, {
        storeCurrentBalance: increment(adminCutTx), 
        adminStoreProfit: increment(adminProfitTaken),
        storeSevaBalance: increment(sevaContribution),
        updatedAt: serverTimestamp(),
    });

    // 8. Handle Referrer
    if (customer.referredBy && saleCalculation.referrerSurabhiCoinsEarned > 0) {
        const referrer = await fetchCustomerByMobile(customer.referredBy);
        if (referrer) {
             const referralAmount = saleCalculation.referrerSurabhiCoinsEarned;
             const referrerRef = doc(db, 'Customers', referrer.id);
             
             await updateDoc(referrerRef, {
                  surabhiBalance: increment(referralAmount),
                  surabhiReferral: increment(referralAmount),
                  surbhiTotal: increment(referralAmount),
                  updatedAt: serverTimestamp(),
             });
             
             // Add Referrer Tx Record
             await addDoc(collection(db, 'CustomerTx'), {
                  type: 'referral',
                  customerMobile: referrer.customerMobile,
                  demoStore: storeDetails.demoStore || false,
                  customerName: referrer.customerName,
                  storeLocation: referrer.storeLocation,
                  storeName: referrer.storeLocation,
                  createdAt: Timestamp.fromDate(new Date()),
                  paymentMethod: 'admin',
                  processedBy: 'Online System',
                  invoiceId: invoiceId,
                  remarks: `Referral bonus for online order by ${customer.customerName}`,
                  amount: 0,
                  surabhiEarned: referralAmount,
                  sevaEarned: 0,
                  referralEarned: referralAmount,
                  // ... other fields 0
                  spvEntered: 0,
                  adjustedSpv: 0,
                  surabhiEarnedAdj: 0,
                  sevaEarnedAdj: 0,
                  surabhiUsed: 0, 
                  walletDeduction: 0,
                  cashPayment: 0,
                  adminProft: 0,
                  referredBy: '',
                  previousBalance: {
                      walletBalance: Number(referrer.walletBalance.toFixed(2)),
                      surabhiBalance: Number(referrer.surabhiBalance.toFixed(2)),
                  },
                  newBalance: {
                      walletBalance: Number(referrer.walletBalance.toFixed(2)),
                      surabhiBalance: Number((referrer.surabhiBalance + referralAmount).toFixed(2))
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
                  storeSevaBalance: 0, 
             });
             
             // Activity
             await addDoc(collection(db, 'Activity'), {
                 type: 'referral',
                 remarks: `Referral bonus from Online Order`,
                 amount: referralAmount,
                 customerMobile: referrer.customerMobile,
                 createdAt: Timestamp.fromDate(new Date())
             });
        }
    }
    
    // 9. Activity Log for Sale
     await addDoc(collection(db, 'Activity'), {
        type: 'sale',
        remarks: `Online Purchase of ₹${amount} by ${customer.customerName}`,
        amount: amount,
        customerName: customer.customerName,
        customerMobile: customer.customerMobile,
        storeLocation: storeDetails.storeName,
        createdAt: Timestamp.fromDate(new Date()),
        demoStore: storeDetails.demoStore || false,
    });
};
