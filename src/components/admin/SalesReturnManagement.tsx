import { format } from 'date-fns';
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
  where,
} from 'firebase/firestore';
import {
  ArrowDownRight,
  Coins,
  DollarSign,
  Heart,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  Store,
  TrendingDown,
  Truck,
  UserCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/auth-context';
import { useActiveStores, useInvalidateQueries, useStores, useTransactions } from '@/hooks/useFirebaseQueries';
import { db } from '@/lib/firebase';
import { getUserName } from '@/lib/userUtils';
import { CustomerTxType, CustomerType } from '@/types/types';

// Helper rounding function
const round2 = (num: number): number => Math.round((Number(num) || 0) * 100) / 100;

interface SalesReturnManagementProps {
  storeLocation?: string;
  demoStore?: boolean;
}

export const SalesReturnManagement = ({ storeLocation, demoStore }: SalesReturnManagementProps = {}) => {
  const { user } = useAuth();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: allStores = [] } = useStores();
  const { data: activeStores = [] } = useActiveStores();
  const stores = allStores.length > 0 ? allStores : activeStores;
  const { invalidateAll } = useInvalidateQueries();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerType | null>(null);
  const [foundReferrer, setFoundReferrer] = useState<CustomerType | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Store Location State (for rate calculations from admin dashboard)
  const [selectedStoreLocation, setSelectedStoreLocation] = useState<string>(storeLocation || '');

  // Keep store location synced if prop changes
  useEffect(() => {
    if (storeLocation) {
      setSelectedStoreLocation(storeLocation);
    }
  }, [storeLocation]);

  // Form State
  const [returnAmount, setReturnAmount] = useState<string>('');
  const [returnSpv, setReturnSpv] = useState<string>('');
  const [customSpvMode, setCustomSpvMode] = useState(false);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'wallet' | 'bank_transfer' | 'store_credit'>('cash');
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  // Search customer & transactions
  const handleSearch = async () => {
    const term = searchQuery.trim();
    if (!term) {
      toast.error('Please enter a Customer Mobile Number or Invoice ID');
      return;
    }

    setSearching(true);
    setFoundCustomer(null);
    setFoundReferrer(null);
    setSelectedTx(null);
    setReturnAmount('');
    setReturnSpv('');

    try {
      // 1. Try finding customer by mobile
      let cust: CustomerType | null = null;
      const custQuery = query(collection(db, 'Customers'), where('customerMobile', '==', term));
      const custSnap = await getDocs(custQuery);

      if (!custSnap.empty) {
        const d = custSnap.docs[0];
        cust = { id: d.id, ...d.data() } as CustomerType;
        setFoundCustomer(cust);
      }

      // 2. Search transaction in transactions list
      const matchedTx = transactions.find(
        tx =>
          tx.type === 'sale' &&
          (tx.invoiceId?.toLowerCase() === term.toLowerCase() ||
            tx.customerMobile === term)
      );

      if (matchedTx) {
        setSelectedTx(matchedTx);
        setReturnAmount(String(matchedTx.amount || 0));

        // Calculate proportional SPV
        const origSpv = matchedTx.totalSpv || matchedTx.spvEntered || matchedTx.amount || 0;
        setReturnSpv(String(origSpv));

        const txStore = matchedTx.storeLocation || matchedTx.storeName;
        if (txStore) {
          setSelectedStoreLocation(txStore);
        }

        if (!cust && matchedTx.customerMobile) {
          // Fetch customer from matchedTx mobile if not found earlier
          const cQ = query(
            collection(db, 'Customers'),
            where('customerMobile', '==', matchedTx.customerMobile)
          );
          const cSnap = await getDocs(cQ);
          if (!cSnap.empty) {
            const doc0 = cSnap.docs[0];
            cust = { id: doc0.id, ...doc0.data() } as CustomerType;
            setFoundCustomer(cust);
          }
        }
      } else if (cust && cust.storeLocation) {
        setSelectedStoreLocation(cust.storeLocation);
      }

      // 3. Fetch Referrer if customer has referredBy
      if (cust && cust.referredBy) {
        const refQuery = query(
          collection(db, 'Customers'),
          where('customerMobile', '==', cust.referredBy)
        );
        const refSnap = await getDocs(refQuery);
        if (!refSnap.empty) {
          const refDoc = refSnap.docs[0];
          setFoundReferrer({ id: refDoc.id, ...refDoc.data() } as CustomerType);
        }
      }

      if (!cust && !matchedTx) {
        toast.error('No customer or transaction found matching your search term');
      } else {
        toast.success('Search result loaded successfully');
      }
    } catch (err) {
      console.error('Error searching:', err);
      toast.error('Failed to search records');
    } finally {
      setSearching(false);
    }
  };

  // Select a specific transaction for the customer and auto-load customer & referrer details
  const handleSelectTransaction = async (tx: any) => {
    setSelectedTx(tx);
    setReturnAmount(String(tx.amount || 0));
    const origSpv = tx.totalSpv || tx.spvEntered || tx.amount || 0;
    setReturnSpv(String(origSpv));

    const txStore = tx.storeLocation || tx.storeName;
    if (txStore) {
      setSelectedStoreLocation(txStore);
    }

    if (!foundCustomer || foundCustomer.customerMobile !== tx.customerMobile) {
      if (tx.customerMobile) {
        try {
          const cQ = query(collection(db, 'Customers'), where('customerMobile', '==', tx.customerMobile));
          const cSnap = await getDocs(cQ);
          if (!cSnap.empty) {
            const custDoc = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as CustomerType;
            setFoundCustomer(custDoc);

            if (custDoc.referredBy) {
              const refQ = query(collection(db, 'Customers'), where('customerMobile', '==', custDoc.referredBy));
              const refSnap = await getDocs(refQ);
              if (!refSnap.empty) {
                setFoundReferrer({ id: refSnap.docs[0].id, ...refSnap.docs[0].data() } as CustomerType);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching customer for selected transaction:', err);
        }
      }
    }
  };

  // Find matching store configured in Admin Dashboard
  const selectedStoreObj = useMemo(() => {
    if (!stores.length) return null;
    const target = (
      selectedStoreLocation ||
      selectedTx?.storeLocation ||
      selectedTx?.storeName ||
      foundCustomer?.storeLocation ||
      storeLocation ||
      ''
    )
      .trim()
      .toLowerCase();

    if (!target) return stores[0] || null;

    return (
      stores.find(
        s =>
          s.storeName?.trim().toLowerCase() === target ||
          s.storeLocation?.trim().toLowerCase() === target ||
          s.id === target
      ) ||
      stores[0] ||
      null
    );
  }, [stores, selectedStoreLocation, selectedTx, foundCustomer, storeLocation]);

  // Dynamic commission percentages based on Store Location from Admin Dashboard
  const storeRates = useMemo(() => {
    const isCash = refundMethod === 'cash' || selectedTx?.paymentMethod === 'cash';
    const surabhiRate = typeof selectedStoreObj?.surabhiCommission === 'number'
      ? selectedStoreObj.surabhiCommission
      : 10;
    const cashOnlyRate = typeof selectedStoreObj?.cashOnlyCommission === 'number'
      ? selectedStoreObj.cashOnlyCommission
      : surabhiRate;
    const customerCoinPct = isCash ? cashOnlyRate : surabhiRate;

    const referrerPct = typeof selectedStoreObj?.referralCommission === 'number'
      ? selectedStoreObj.referralCommission
      : 6;

    const sevaPct = typeof selectedStoreObj?.sevaCommission === 'number'
      ? selectedStoreObj.sevaCommission
      : 2;

    const shippingPct = typeof selectedStoreObj?.shippingCommission === 'number'
      ? selectedStoreObj.shippingCommission
      : 5;

    return {
      surabhiRate,
      cashOnlyRate,
      customerCoinPct,
      referrerPct,
      sevaPct,
      shippingPct,
      isCash,
      storeName: selectedStoreObj?.storeName || selectedStoreLocation || 'Main Store',
    };
  }, [selectedStoreObj, refundMethod, selectedTx, selectedStoreLocation]);

  // Return calculations (based on Store Location values configured in Admin Dashboard)
  const calc = useMemo(() => {
    const amt = Number(returnAmount) || 0;
    const origAmt = selectedTx?.amount || amt || 1;
    const origSpv = selectedTx?.totalSpv || selectedTx?.spvEntered || (origAmt * 0.5);

    // Auto compute proportional return SPV if not custom
    let calculatedSpv = 0;
    if (customSpvMode) {
      calculatedSpv = Number(returnSpv) || 0;
    } else {
      calculatedSpv = round2((amt / origAmt) * origSpv);
    }

    // Formula percentages dynamically taken from Admin Dashboard Store Configuration:
    // Customer Surabhi Coins: configured Surabhi % (or Cash Only % if cash) of Return SPV
    // Referrer Surabhi Coins: configured Referral % of Return SPV
    // Seva Pool Coins: configured Seva % of Return SPV
    // Customer Shipping Credits: configured Shipping % of Return SPV
    const customerCoinsDeducted = round2(calculatedSpv * (storeRates.customerCoinPct / 100));
    const referrerCoinsDeducted = foundCustomer?.referredBy ? round2(calculatedSpv * (storeRates.referrerPct / 100)) : 0;
    const sevaCoinsDeducted = round2(calculatedSpv * (storeRates.sevaPct / 100));
    const shippingCreditsDeducted = round2(calculatedSpv * (storeRates.shippingPct / 100));

    // Balances calculation
    const custCurrentSurabhi = foundCustomer?.surabhiBalance || 0;
    const custNewSurabhi = Math.max(0, round2(custCurrentSurabhi - customerCoinsDeducted));

    const custCurrentShipping = foundCustomer?.shippingBalance || 0;
    const custNewShipping = Math.max(0, round2(custCurrentShipping - shippingCreditsDeducted));

    const custCurrentCumTotal = foundCustomer?.cumTotal || 0;
    const custNewCumTotal = Math.max(0, round2(custCurrentCumTotal - amt));

    const refCurrentSurabhi = foundReferrer?.surabhiBalance || 0;
    const refNewSurabhi = Math.max(0, round2(refCurrentSurabhi - referrerCoinsDeducted));

    return {
      returnAmount: amt,
      returnSpv: calculatedSpv,
      customerCoinsDeducted,
      referrerCoinsDeducted,
      sevaCoinsDeducted,
      shippingCreditsDeducted,
      custCurrentSurabhi,
      custNewSurabhi,
      custCurrentShipping,
      custNewShipping,
      custCurrentCumTotal,
      custNewCumTotal,
      refCurrentSurabhi,
      refNewSurabhi,
      storeName: storeRates.storeName,
      storeRates,
    };
  }, [
    returnAmount,
    returnSpv,
    customSpvMode,
    selectedTx,
    foundCustomer,
    foundReferrer,
    storeRates,
  ]);

  // Handle Sales Return submission
  const handleSubmitReturn = async () => {
    if (!foundCustomer) {
      toast.error('Please select or search for a customer first');
      return;
    }
    if (calc.returnAmount <= 0) {
      toast.error('Please enter a valid return amount greater than 0');
      return;
    }

    setProcessing(true);
    try {
      const returnInvoiceId = `RET-${selectedTx?.invoiceId || Date.now().toString().slice(-6)}`;
      const storeName = selectedStoreLocation || selectedStoreObj?.storeName || selectedTx?.storeLocation || selectedTx?.storeName || foundCustomer.storeLocation || storeLocation || stores[0]?.storeName || 'Main Store';
      const isDemo = selectedStoreObj?.demoStore || selectedTx?.demoStore || foundCustomer.demoStore || false;

      // 1. Update Customer doc
      const customerRef = doc(db, 'Customers', foundCustomer.id!);
      await updateDoc(customerRef, {
        surabhiBalance: increment(-calc.customerCoinsDeducted),
        surbhiTotal: increment(-calc.customerCoinsDeducted),
        shippingBalance: increment(-calc.shippingCreditsDeducted),
        cumTotal: increment(-calc.returnAmount),
        sevaBalance: increment(-calc.sevaCoinsDeducted),
        sevaTotal: increment(-calc.sevaCoinsDeducted),
        lastTransactionDate: serverTimestamp(),
      });

      // 2. Update Referrer doc (if exists and has coins to deduct)
      if (foundReferrer && calc.referrerCoinsDeducted > 0) {
        const refDocRef = doc(db, 'Customers', foundReferrer.id!);
        await updateDoc(refDocRef, {
          surabhiBalance: increment(-calc.referrerCoinsDeducted),
          surabhiReferral: increment(-calc.referrerCoinsDeducted),
          surbhiTotal: increment(-calc.referrerCoinsDeducted),
          updatedAt: serverTimestamp(),
        });

        // Add Referrer CustomerTx for Return
        await addDoc(collection(db, 'CustomerTx'), {
          type: 'referral_return',
          customerMobile: foundReferrer.customerMobile,
          customerName: foundReferrer.customerName,
          demoStore: isDemo,
          storeLocation: foundReferrer.storeLocation || storeName,
          storeName: storeName,
          createdAt: Timestamp.fromDate(new Date()),
          paymentMethod: 'admin',
          processedBy: getUserName(user) || 'Admin',
          invoiceId: returnInvoiceId,
          remarks: `Referral coins reversal for sales return of ${foundCustomer.customerName}`,
          amount: 0,
          surabhiEarned: 0,
          surabhiDebit: calc.referrerCoinsDeducted,
          surabhiCredit: 0,
          surabhiBalance: calc.refNewSurabhi,
          sevaEarned: 0,
          referralEarned: -calc.referrerCoinsDeducted,
          spvEntered: 0,
          adjustedSpv: 0,
          previousBalance: {
            walletBalance: foundReferrer.walletBalance || 0,
            surabhiBalance: calc.refCurrentSurabhi,
          },
          newBalance: {
            walletBalance: foundReferrer.walletBalance || 0,
            surabhiBalance: calc.refNewSurabhi,
          },
        });
      }

      // 3. Update Seva Pool
      if (!isDemo && calc.sevaCoinsDeducted > 0) {
        const poolRef = doc(db, 'SevaPool', 'main');
        await updateDoc(poolRef, {
          currentSevaBalance: increment(-calc.sevaCoinsDeducted),
        });
      }

      // 4. Create CustomerTx record for Customer
      const customerTxData: Omit<CustomerTxType, 'id'> = {
        type: 'return',
        customerMobile: foundCustomer.customerMobile,
        customerName: foundCustomer.customerName,
        demoStore: isDemo,
        storeLocation: foundCustomer.storeLocation || storeName,
        storeName: storeName,
        createdAt: Timestamp.fromDate(new Date()),
        paymentMethod: refundMethod,
        processedBy: getUserName(user) || 'Admin',
        invoiceId: returnInvoiceId,
        remarks: remarks || `Sales return processed for ${foundCustomer.customerName}`,
        amount: calc.returnAmount,
        surabhiEarned: 0,
        sevaEarned: 0,
        referralEarned: 0,
        referredBy: foundCustomer.referredBy || '',
        adminProft: 0,
        adminCut: 0,
        totalSpv: calc.returnSpv,
        spvEntered: calc.returnSpv,
        adjustedSpv: calc.returnSpv,
        surabhiEarnedAdj: 0,
        sevaEarnedAdj: 0,
        surabhiUsed: 0,
        walletDeduction: refundMethod === 'wallet' ? calc.returnAmount : 0,
        cashPayment: refundMethod === 'cash' ? calc.returnAmount : 0,

        // Balances
        previousBalance: {
          walletBalance: foundCustomer.walletBalance || 0,
          surabhiBalance: calc.custCurrentSurabhi,
          shippingBalance: calc.custCurrentShipping,
        },
        newBalance: {
          walletBalance: foundCustomer.walletBalance || 0,
          surabhiBalance: calc.custNewSurabhi,
          shippingBalance: calc.custNewShipping,
        },
        walletCredit: refundMethod === 'wallet' ? calc.returnAmount : 0,
        walletDebit: 0,
        walletBalance: foundCustomer.walletBalance || 0,
        surabhiDebit: calc.customerCoinsDeducted,
        surabhiCredit: 0,
        surabhiBalance: calc.custNewSurabhi,
        sevaCredit: 0,
        sevaDebit: calc.sevaCoinsDeducted,
        sevaBalance: Math.max(0, (foundCustomer.sevaBalance || 0) - calc.sevaCoinsDeducted),
        sevaTotal: Math.max(0, (foundCustomer.sevaTotal || 0) - calc.sevaCoinsDeducted),
        shippingCredit: 0,
        shippingDebit: calc.shippingCreditsDeducted,
        shippingBalance: calc.custNewShipping,
        shippingTotal: Math.max(0, (foundCustomer.shippingTotal || 0) - calc.shippingCreditsDeducted),
        storeSevaBalance: 0,
      };

      await addDoc(collection(db, 'CustomerTx'), customerTxData);

      // 5. Add AccountTx for Store Ledger
      await addDoc(collection(db, 'AccountTx'), {
        createdAt: Timestamp.fromDate(new Date()),
        storeName: storeName,
        type: 'return',
        amount: calc.returnAmount,
        invoiceId: returnInvoiceId,
        demoStore: isDemo,
        customerName: foundCustomer.customerName,
        customerMobile: foundCustomer.customerMobile,
        debit: calc.returnAmount,
        credit: 0,
        adminCut: 0,
        adminProfit: 0,
        remarks: `Sales Return refund (${refundMethod}) for ${foundCustomer.customerName}`,
        spvEntered: calc.returnSpv,
        adjustedSpv: calc.returnSpv,
        totalSpv: calc.returnSpv,
      });

      // 6. Log Activity
      await addDoc(collection(db, 'Activity'), {
        type: 'return',
        remarks: `Sales return of ₹${calc.returnAmount} for ${foundCustomer.customerName}`,
        amount: calc.returnAmount,
        customerName: foundCustomer.customerName,
        customerMobile: foundCustomer.customerMobile,
        storeLocation: storeName,
        createdAt: Timestamp.fromDate(new Date()),
        demoStore: isDemo,
      });

      toast.success(`Sales Return of ₹${calc.returnAmount} processed successfully!`);
      await invalidateAll();

      // Reset form
      setReturnAmount('');
      setReturnSpv('');
      setRemarks('');
      setSelectedTx(null);
    } catch (err) {
      console.error('Error processing sales return:', err);
      toast.error('Failed to process sales return. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Filter return transactions for history table
  const returnTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const isReturn = tx.type === 'return' || tx.type === 'sale_return';
      if (!isReturn) return false;
      if (storeLocation) {
        return tx.storeLocation === storeLocation || tx.storeName === storeLocation;
      }
      return true;
    });
  }, [transactions, storeLocation]);

  // Customer recent sales list
  const customerSales = useMemo(() => {
    if (!foundCustomer) return [];
    return transactions.filter(
      tx => tx.type === 'sale' && tx.customerMobile === foundCustomer.customerMobile
    );
  }, [transactions, foundCustomer]);

  // All recent completed sales (available to pick for return)
  const allRecentSales = useMemo(() => {
    return transactions.filter(tx => {
      const isSale = tx.type === 'sale';
      if (!isSale) return false;
      if (storeLocation) {
        return tx.storeLocation === storeLocation || tx.storeName === storeLocation;
      }
      return true;
    });
  }, [transactions, storeLocation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-purple-600" />
            Sales Return Management
          </h2>
          <p className="text-gray-600 text-sm">
            Process product returns and automatically deduct coins, shipping credits, and lifetime spent.
          </p>
        </div>
      </div>

      {/* 1. Customer & Invoice Lookup */}
      <Card className="shadow-sm border-purple-100 bg-gradient-to-r from-purple-50/40 via-white to-amber-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" /> Search Customer or Invoice
          </CardTitle>
          <CardDescription>
            Enter Customer Mobile Number or Invoice ID to load original sale details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Enter Mobile Number or Invoice ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pr-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
            >
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" /> Search
                </>
              )}
            </Button>
          </div>

          {/* Customer Summary Card */}
          {foundCustomer && (
            <div className="mt-4 p-4 rounded-lg bg-white border border-purple-200 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-gray-500 font-medium">Customer Name</span>
                <p className="text-base font-semibold text-gray-900">{foundCustomer.customerName}</p>
                <p className="text-xs text-gray-500">{foundCustomer.customerMobile}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">Surabhi Coins Balance</span>
                <p className="text-base font-bold text-amber-600 flex items-center gap-1">
                  <Coins className="h-4 w-4" /> {foundCustomer.surabhiBalance || 0}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">Shipping Credit Balance</span>
                <p className="text-base font-bold text-purple-600 flex items-center gap-1">
                  <Truck className="h-4 w-4" /> ₹{foundCustomer.shippingBalance || 0}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">Lifetime Spent (`cumTotal`)</span>
                <p className="text-base font-bold text-green-600 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> ₹{foundCustomer.cumTotal || 0}
                </p>
              </div>
            </div>
          )}

          {/* Recent Sales Selection for Customer */}
          {customerSales.length > 0 && (
            <div className="mt-4">
              <Label className="text-xs text-gray-600 font-semibold mb-2 block">
                Select Customer Sale Transaction to Return:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {customerSales.slice(0, 6).map(tx => (
                  <div
                    key={tx.id || tx.invoiceId}
                    onClick={() => handleSelectTransaction(tx)}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      selectedTx?.invoiceId === tx.invoiceId
                        ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-xs text-purple-700">
                        #{tx.invoiceId || 'N/A'}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        ₹{tx.amount}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Customer: {tx.customerName || 'N/A'} ({tx.customerMobile || ''})
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      SPV: {tx.totalSpv || tx.spvEntered || (tx.amount * 0.5)} | {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'dd MMM yyyy') : 'Recent'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Recent Completed Sales (if no customer searched yet) */}
          {!foundCustomer && allRecentSales.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <Label className="text-xs text-gray-600 font-semibold mb-2 block">
                Recent Completed Sales (Click any sale to process return):
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {allRecentSales.slice(0, 9).map(tx => (
                  <div
                    key={tx.id || tx.invoiceId}
                    onClick={() => handleSelectTransaction(tx)}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      selectedTx?.invoiceId === tx.invoiceId
                        ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-xs text-purple-700">
                        #{tx.invoiceId || 'N/A'}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        ₹{tx.amount}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-700 font-medium mt-1 truncate">
                      {tx.customerName || tx.customerMobile || 'Customer'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Store: {tx.storeLocation || tx.storeName || 'Main'} | {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'dd MMM yyyy') : 'Recent'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Form & Calculation Breakdown */}
      {foundCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <Card className="lg:col-span-1 shadow-md border-0 bg-white">
            <CardHeader className="bg-purple-900 text-white rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <RotateCcw className="h-5 w-5" /> Sales Return Form
              </CardTitle>
              <CardDescription className="text-purple-200 text-xs">
                Enter return details to calculate coin reversals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <Label htmlFor="storeLocationSelect" className="text-xs font-semibold text-gray-700">
                  Store Location (Rates Config)
                </Label>
                <Select
                  value={selectedStoreLocation || selectedStoreObj?.storeName || ''}
                  onValueChange={val => setSelectedStoreLocation(val)}
                >
                  <SelectTrigger id="storeLocationSelect" className="mt-1">
                    <SelectValue placeholder="Select Store Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.id || s.storeName} value={s.storeName || s.storeLocation}>
                        {s.storeName} {s.storeLocation && s.storeLocation !== s.storeName ? `(${s.storeLocation})` : ''} {s.demoStore ? '[Demo]' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                  <span>Dashboard Rates:</span>
                  <span className="font-semibold text-purple-700">
                    {calc.storeRates.customerCoinPct}% Cust | {calc.storeRates.referrerPct}% Ref | {calc.storeRates.sevaPct}% Seva | {calc.storeRates.shippingPct}% Ship
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="returnAmount" className="text-xs font-semibold text-gray-700">
                  Return Value (Amount in ₹) *
                </Label>
                <Input
                  id="returnAmount"
                  type="number"
                  placeholder="e.g. 500"
                  value={returnAmount}
                  onChange={e => {
                    setReturnAmount(e.target.value);
                    if (!customSpvMode && selectedTx) {
                      const ratio = (Number(e.target.value) || 0) / (selectedTx.amount || 1);
                      const origSpv = selectedTx.totalSpv || selectedTx.spvEntered || (selectedTx.amount * 0.5);
                      setReturnSpv(String(round2(ratio * origSpv)));
                    }
                  }}
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="returnSpv" className="text-xs font-semibold text-gray-700">
                    Return SPV *
                  </Label>
                  <button
                    type="button"
                    onClick={() => setCustomSpvMode(!customSpvMode)}
                    className="text-[10px] text-purple-600 hover:underline"
                  >
                    {customSpvMode ? 'Auto-calculate' : 'Edit Custom SPV'}
                  </button>
                </div>
                <Input
                  id="returnSpv"
                  type="number"
                  disabled={!customSpvMode}
                  placeholder="e.g. 250"
                  value={returnSpv}
                  onChange={e => setReturnSpv(e.target.value)}
                  className={`mt-1 ${!customSpvMode ? 'bg-gray-50 text-gray-600' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="refundMethod" className="text-xs font-semibold text-gray-700">
                  Refund Payment Method
                </Label>
                <Select value={refundMethod} onValueChange={(val: any) => setRefundMethod(val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select refund method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Refund</SelectItem>
                    <SelectItem value="wallet">Customer Wallet Credit</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="remarks" className="text-xs font-semibold text-gray-700">
                  Remarks / Return Reason
                </Label>
                <Input
                  id="remarks"
                  type="text"
                  placeholder="e.g. Damaged item / Size issue"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleSubmitReturn}
                disabled={processing || calc.returnAmount <= 0}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 mt-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing Return...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" /> Process Sales Return (₹{calc.returnAmount})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Live Calculation Preview (Matching Store Configuration from Admin Dashboard) */}
          <Card className="lg:col-span-2 shadow-md border-0 bg-white">
            <CardHeader className="bg-amber-500 text-white rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5" /> Proportional Deductions Live Preview
              </CardTitle>
              <CardDescription className="text-amber-100 text-xs">
                Real-time breakdown of coins and credits that will be deducted based on {calc.storeName} configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Formula Metrics Header */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap gap-4 justify-between items-center">
                <div>
                  <span className="text-xs text-amber-800 font-semibold block">Return Amount</span>
                  <span className="text-xl font-bold text-amber-900">₹{calc.returnAmount}</span>
                </div>
                <div>
                  <span className="text-xs text-amber-800 font-semibold block">Return SPV</span>
                  <span className="text-xl font-bold text-amber-900">{calc.returnSpv}</span>
                </div>
                <div>
                  <span className="text-xs text-amber-800 font-semibold block">Store Location Basis</span>
                  <span className="text-xs text-amber-900 font-bold block">{calc.storeName}</span>
                  <span className="text-xs text-amber-700 font-medium">
                    {calc.storeRates.customerCoinPct}% Cust | {calc.storeRates.referrerPct}% Ref | {calc.storeRates.sevaPct}% Seva | {calc.storeRates.shippingPct}% Ship
                  </span>
                </div>
              </div>

              {/* Deduction Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Customer Surabhi Coins */}
                <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-600" /> Customer Surabhi Coins ({calc.storeRates.customerCoinPct}%)
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      - {calc.customerCoinsDeducted} Coins
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-600">
                    <span>Current: <strong>{calc.custCurrentSurabhi}</strong></span>
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    <span>New Balance: <strong className="text-red-700">{calc.custNewSurabhi}</strong></span>
                  </div>
                </div>

                {/* 2. Referrer Surabhi Coins */}
                <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-blue-600" /> Referrer Surabhi Coins ({calc.storeRates.referrerPct}%)
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      - {calc.referrerCoinsDeducted} Coins
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-600">
                    <span>
                      {foundReferrer ? `Referrer: ${foundReferrer.customerName}` : 'No Referrer'}
                    </span>
                    {foundReferrer && (
                      <span className="text-red-700 font-medium">
                        {calc.refCurrentSurabhi} → {calc.refNewSurabhi}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Seva Pool Contribution */}
                <div className="p-4 rounded-lg bg-pink-50/50 border border-pink-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-pink-900 flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-pink-600" /> Seva Pool Reversal ({calc.storeRates.sevaPct}%)
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      - {calc.sevaCoinsDeducted} Coins
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Deducted directly from current month Seva Pool balance.
                  </p>
                </div>

                {/* 4. Shipping Credit Balance */}
                <div className="p-4 rounded-lg bg-purple-50/50 border border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-purple-600" /> Shipping Credits ({calc.storeRates.shippingPct}%)
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      - ₹{calc.shippingCreditsDeducted}
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-600">
                    <span>Current: <strong>₹{calc.custCurrentShipping}</strong></span>
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    <span>New Balance: <strong className="text-red-700">₹{calc.custNewShipping}</strong></span>
                  </div>
                </div>
              </div>

              {/* 5. Lifetime Spent Reduction */}
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-emerald-900 block">
                    Customer Lifetime Spent (`cumTotal`) Reduction
                  </span>
                  <span className="text-xs text-emerald-700">
                    Original Lifetime: ₹{calc.custCurrentCumTotal} → New Lifetime: ₹{calc.custNewCumTotal}
                  </span>
                </div>
                <Badge className="bg-emerald-700 text-white text-xs">
                  - ₹{calc.returnAmount}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Sales Return Transactions History Table */}
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-purple-600" /> Sales Return Transactions History
          </CardTitle>
          <CardDescription>
            Records of all sales returns executed by admins
          </CardDescription>
        </CardHeader>
        <CardContent>
          {returnTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No sales return transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold">Invoice ID</TableHead>
                    <TableHead className="text-xs font-semibold">Customer</TableHead>
                    <TableHead className="text-xs font-semibold">Mobile</TableHead>
                    <TableHead className="text-xs font-semibold">Store</TableHead>
                    <TableHead className="text-xs font-semibold">Return Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Return SPV</TableHead>
                    <TableHead className="text-xs font-semibold">Coins Deducted</TableHead>
                    <TableHead className="text-xs font-semibold">Processed By</TableHead>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnTransactions.map(tx => (
                    <TableRow key={tx.id || tx.invoiceId}>
                      <TableCell className="font-semibold text-xs text-purple-700">
                        #{tx.invoiceId || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{tx.customerName}</TableCell>
                      <TableCell className="text-xs">{tx.customerMobile}</TableCell>
                      <TableCell className="text-xs">{tx.storeLocation || tx.storeName}</TableCell>
                      <TableCell className="text-xs font-bold text-red-600">
                        ₹{tx.amount?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs">{tx.totalSpv || tx.spvEntered || 0}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">
                          -{tx.surabhiDebit || 0} coins
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{tx.processedBy || 'Admin'}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {tx.createdAt?.toDate
                          ? format(tx.createdAt.toDate(), 'dd MMM yyyy, hh:mm a')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
