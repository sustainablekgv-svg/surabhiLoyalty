
import { db } from '@/lib/firebase';
import { AccountTxType, CustomerTxType, CustomerType, StoreType } from '@/types/types';
import { updateCustomerQuarterlyTarget } from '@/utils/quarterlyTargets';
import {
  computeSaleAdminCut,
  computeSaleAdminProfit,
  grossSpvPoolsFromGrossWeight,
} from '@/utils/saleAdminSpv';
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
import { getUserName } from '@/lib/userUtils';

// --- Types ---

export interface SaleCalculation { 
  totalAmount: number; 
  surabhiCoinsUsed: number; 
  walletDeduction: number; 
  cashPayment: number;
  surabhiCoinsEarned: number; 
  goSevaContribution: number; 
  referrerSurabhiCoinsEarned: number;
  shippingCreditsEarned: number; 
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

// --- Sales Logic ---

export const calculateSale = (
  amount: number,
  customer: CustomerType,
  storeDetails: StoreType,
  paymentMethod: 'wallet' | 'cash' | 'mixed',
  totalSpv?: number,
  coinsUsedForCalc?: number, // NEW: Amount paid via coins
  shippingCreditsEarned?: number, // NEW: Shipping credits earned
  shippingCreditsUsed?: number // NEW: Shipping credits used
): SaleCalculation => {
  const totalAmount = Number(amount);
  let walletDeduction = 0;
  let surabhiCoinsUsed = coinsUsedForCalc || 0;
  let cashPayment = totalAmount; // Default for Online/COD is full payment

  // SPV Calculation (Surabhi Point Value)
  // Use passed totalSpv or fallback to amount
  const spv = totalSpv !== undefined ? totalSpv : amount; 

  // Commissions
  const selectedCommission = storeDetails.cashOnlyCommission || 0; 
  const sevaCommission = storeDetails.sevaCommission || 0;
  const referralCommission = storeDetails.referralCommission || 0;

  // Calculate earnings
  // NEW LOGIC: If totalSpv is provided, it's already adjusted for coins (from shop.ts or staff UI). 
  // If not provided, we subtract coins here.
  const baseSpv = totalSpv !== undefined ? Number(totalSpv) : (Number(spv) - surabhiCoinsUsed);
  const netSpv = Math.max(0, baseSpv);

  const surabhiCoinsEarned = customRound((netSpv * selectedCommission) / 100);
  const goSevaContribution = customRound((netSpv * sevaCommission) / 100);
  const referrerSurabhiCoinsEarned = customRound((netSpv * referralCommission) / 100);

  return {
    totalAmount,
    surabhiCoinsUsed, 
    walletDeduction, 
    cashPayment,
    surabhiCoinsEarned,
    goSevaContribution,
    referrerSurabhiCoinsEarned,
    shippingCreditsEarned: shippingCreditsEarned || 0,
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
    paymentDetails?: any,
    totalSpv?: number,
    /** Σ(line SPV × qty) from order items — required for correct admin cut/profit (same as staff g×m / I×m). */
    grossSpvWeight?: number,
    surabhiCoinsUsed?: number, 
    shippingCreditsEarned?: number, 
    shippingCreditsUsed?: number, 
    cumTotalAmount?: number,
    // NEW: Optional overrides for rewards
    rewardOverrides?: {
        surabhiCoinsEarned?: number;
        sevaCoinsEarned?: number;
        referralBonusEarned?: number;
    }
}) => {
    const { orderId, invoiceId, amount, customer, storeDetails, user, paymentMethod, paymentDetails, totalSpv, grossSpvWeight, surabhiCoinsUsed, shippingCreditsEarned, shippingCreditsUsed, cumTotalAmount, rewardOverrides } = params;
    
    // Process both online and COD. 
    // COD in shop is treated as "placed" with pending collection, 
    // but the user requested same kind of coins transfer as SalesManagement.
    
    // Treat 'online' and 'cod' as 'cash' for calculation logic (External Money)
    const methodForCalc = 'cash'; 
    
    const I = Math.max(0, Number(cumTotalAmount !== undefined ? cumTotalAmount : amount) || 0);
    const coins = Math.max(0, Number(surabhiCoinsUsed) || 0);
    const g = I + coins;

    const rawGross = grossSpvWeight !== undefined ? Number(grossSpvWeight) : NaN;
    const catalogM =
      Number.isFinite(rawGross) && rawGross > 0
        ? rawGross
        : I > 0 && totalSpv !== undefined
          ? (Number(totalSpv) * g) / I
          : 0;

    const { totalSpvGross, adjustedSpvGross } = grossSpvPoolsFromGrossWeight(catalogM, I, coins);

    /** Same basis as shop `adjustedSpv` and commission base: (I×m)/g — never use order ₹ as SPV. */
    const rewardBaseSpv: number =
      catalogM > 0 && g > 0
        ? Number((adjustedSpvGross / g).toFixed(6))
        : totalSpv !== undefined
          ? Number(totalSpv)
          : 0;

    // 1. Calculate Sale details (commission % × this SPV base)
    let saleCalculation = calculateSale(
      amount,
      customer,
      storeDetails,
      methodForCalc,
      rewardBaseSpv,
      surabhiCoinsUsed,
      shippingCreditsEarned,
      shippingCreditsUsed
    );

    // Apply overrides if provided (for E-commerce consistency)
    if (rewardOverrides) {
        if (rewardOverrides.surabhiCoinsEarned !== undefined) saleCalculation.surabhiCoinsEarned = rewardOverrides.surabhiCoinsEarned;
        if (rewardOverrides.sevaCoinsEarned !== undefined) saleCalculation.goSevaContribution = rewardOverrides.sevaCoinsEarned;
        if (rewardOverrides.referralBonusEarned !== undefined) saleCalculation.referrerSurabhiCoinsEarned = rewardOverrides.referralBonusEarned;
    }

    const spvEntered = Number(catalogM.toFixed(4));
    const adjustedSpv = Number(rewardBaseSpv.toFixed(6));
    const surabhiEarnedAdj = saleCalculation.surabhiCoinsEarned;
    const sevaEarnedAdj = saleCalculation.goSevaContribution;
    const sevaContribution = saleCalculation.goSevaContribution;

    const adminCutTx = computeSaleAdminCut(totalSpvGross, storeDetails, methodForCalc);
    const adminProfitTaken = computeSaleAdminProfit(
      totalSpvGross,
      adjustedSpvGross,
      storeDetails,
      methodForCalc,
      surabhiCoinsUsed || 0
    );

    const itemAfterCoins = Math.max(0, Number(cumTotalAmount !== undefined ? cumTotalAmount : amount) || 0);
    const orderTotal = Number(amount.toFixed(2));
    const netShippingRemainder = Number(Math.max(0, orderTotal - itemAfterCoins).toFixed(2));
    const accountTxDebitOnline = Number(
      (itemAfterCoins - adminCutTx + netShippingRemainder).toFixed(2)
    );

    // 3. Create AccountTx (Store Ledger) — same fields as staff sales where applicable
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
        debit: accountTxDebitOnline,
        sevaBalance: Number(((Number(storeDetails?.storeSevaBalance) || 0) + (Number(sevaContribution) || 0)).toFixed(2)),
        currentBalance: Number(((Number(storeDetails?.storeCurrentBalance) || 0) + amount - amount + adminCutTx).toFixed(2)), // Store gets adminCut/profit added?
        adminCurrentBalance: Number((-storeDetails.storeCurrentBalance + adminCutTx).toFixed(2)), 
        remarks: `Online sale for ${customer.customerName} via Order #${orderId} (Processed by ${getUserName(user) || 'System'})`,
        spvEntered: Number(spvEntered.toFixed(2)),
        adjustedSpv: Number(adjustedSpv.toFixed(2)),
        totalSpv: totalSpvGross,
        shippingCredit: shippingCreditsEarned || 0,
        shippingDebit: shippingCreditsUsed || 0,
        shippingBalance:
          (customer.shippingBalance || 0) +
          (shippingCreditsEarned || 0) -
          (shippingCreditsUsed || 0),
        shippingAmount: 0,
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
        paymentMethod: paymentMethod, // Mapped
        processedBy: user?.staffName || user?.customerName || 'Online System',
        invoiceId: invoiceId,
        remarks: `Online Order #${orderId} (Processed by ${getUserName(user) || 'System'})`,
        amount: amount,
        surabhiEarned: Number(surabhiEarnedAdj.toFixed(2)),
        sevaEarned: Number(sevaContribution.toFixed(2)),
        referralEarned: 0,
        referredBy: customer.referredBy || '',
        adminProft: Number(adminProfitTaken.toFixed(2)),
        adminCut: Number(adminCutTx.toFixed(2)),
        totalSpv: totalSpvGross,
        spvEntered: Number(spvEntered.toFixed(2)),
        adjustedSpv: Number(adjustedSpv.toFixed(2)),
        surabhiEarnedAdj: Number(surabhiEarnedAdj.toFixed(2)),
        sevaEarnedAdj: Number(sevaEarnedAdj.toFixed(2)),
        surabhiUsed: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
        walletDeduction: Number(saleCalculation.walletDeduction.toFixed(2)),
        cashPayment: Number(saleCalculation.cashPayment.toFixed(2)),
        
        // Balances 
        previousBalance: {
            walletBalance: Number(customer.walletBalance.toFixed(2)),
            surabhiBalance: Number(customer.surabhiBalance.toFixed(2)),
        },
        newBalance: {
            walletBalance: Number(customer.walletBalance.toFixed(2)),
            surabhiBalance: Number((customer.surabhiBalance + saleCalculation.surabhiCoinsEarned).toFixed(2)),
            shippingBalance: Number(((customer.shippingBalance || 0) + (shippingCreditsEarned || 0) - (shippingCreditsUsed || 0)).toFixed(2)),
        },
        walletCredit: 0,
        walletDebit: 0,
        walletBalance: Number(customer.walletBalance.toFixed(2)),
        surabhiDebit: Number(saleCalculation.surabhiCoinsUsed.toFixed(2)),
        surabhiCredit: Number(saleCalculation.surabhiCoinsEarned.toFixed(2)),
        surabhiBalance: Number((customer.surabhiBalance - saleCalculation.surabhiCoinsUsed + saleCalculation.surabhiCoinsEarned).toFixed(2)),
        sevaCredit: Number(sevaContribution.toFixed(2)),
        sevaDebit: 0,
        sevaBalance: Number(((customer.sevaBalanceCurrentMonth || 0) + sevaContribution).toFixed(2)),
        sevaTotal: Number(((customer.sevaTotal || 0) + sevaContribution).toFixed(2)),
        shippingCredit: Number((shippingCreditsEarned || 0).toFixed(2)),
        shippingDebit: Number((shippingCreditsUsed || 0).toFixed(2)),
        shippingBalance: Number(((customer.shippingBalance || 0) + (shippingCreditsEarned || 0) - (shippingCreditsUsed || 0)).toFixed(2)),
        shippingTotal: Number(((customer.shippingTotal || 0) + (shippingCreditsEarned || 0)).toFixed(2)),
        storeSevaBalance: Number((storeDetails.storeSevaBalance + sevaContribution).toFixed(2)),
    };
    
    await addDoc(collection(db, 'CustomerTx'), customerTxData);

    // 6. Update Customer Document
    const customerRef = doc(db, 'Customers', customer.id);
    // Use cumTotalAmount if provided (for online orders to exclude shipping), otherwise use amount
    const additionToCumTotal = cumTotalAmount !== undefined ? cumTotalAmount : amount;
    const newCumTotal = customRound((customer.cumTotal || 0) + additionToCumTotal);
    const isEligible = customer.isStudent ? newCumTotal >= 499 : newCumTotal >= 999;
    const shouldUpdateEligibility = isEligible && customer.saleElgibility !== true;

    const updateData: any = {
        surabhiBalance: increment(saleCalculation.surabhiCoinsEarned),
        sevaBalance: increment(sevaContribution),
        sevaTotal: increment(sevaContribution),
        cumTotal: newCumTotal,
        shippingBalance: increment((shippingCreditsEarned || 0) - (shippingCreditsUsed || 0)),
        shippingTotal: increment(shippingCreditsEarned || 0),
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
                  processedBy: getUserName(user) || 'Online System',
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
