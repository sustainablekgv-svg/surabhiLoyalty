import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { addAddress, getAddresses } from '@/lib/addressService';
import { db } from '@/lib/firebase';
import { getUserName } from '@/lib/userUtils';
import { notifyCoinsRedeemedSms, notifyOrderPlacedSms } from '@/services/ojivaSmsNotification';
import { calculateShippingCost, getWeightBracketLabel, INDIAN_STATES, parseWeightToKg } from '@/services/shipping';
import { Address, CartItem } from '@/types/shop';
import { addDoc, collection, getDocs, Timestamp } from 'firebase/firestore';
import { Check, Copy, MessageSquare, Phone, ShoppingCart } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const CheckoutPage = () => {
  const { cart, clearCart, createOrder, updateQuantity, removeFromCart } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };
  
  // Address Management
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(false);

  

  const [formData, setFormData] = useState<Address>({
    fullName: getUserName(user),
    mobile: user ? ('customerMobile' in user ? (user as any).customerMobile : (user as any).staffMobile) : '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    landmark: ''
  });

  const [brands, setBrands] = useState<any[]>([]);
  const [shippingConfig, setShippingConfig] = useState<any>(null);
  const [originsList, setOriginsList] = useState<any[]>([]);
  const [surabhiCoinsToUse, setSurabhiCoinsToUse] = useState<number>(0);
  const [isCointEligible, setIsCoinEligible] = useState(true);
  const [customerData, setCustomerData] = useState<any>(null);



  useEffect(() => {
    const fetchConfigAndOrigins = async () => {
      const { getShippingConfig } = await import('@/services/shipping');
      const [config, originsSnap, brandsSnap] = await Promise.all([
        getShippingConfig(),
        getDocs(collection(db, 'origins')),
        getDocs(collection(db, 'brands'))
      ]);
      setShippingConfig(config);
      setOriginsList(originsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchConfigAndOrigins();
    
    // Set max available shipping credits
    if (user && 'shippingBalance' in user) {
        // setMaxShippingCreditsAvailable removed
    }
  }, [user]);

  useEffect(() => {
  if (!customerData) return;

  const eligible =
    (customerData.cumTotal || 0) >=
    (customerData.cummulativeTarget || 0);

  setIsCoinEligible(eligible);
}, [customerData]);

  useEffect(() => {
  if (!user?.id) return;

  const fetchCustomer = async () => {
    const { doc, getDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'Customers', user.id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        console.log("🔥 FIRESTORE DATA:", snap.data());
      setCustomerData(snap.data());
    }
  };

  fetchCustomer();
}, [user]);


  // Calculate totals by brand + origin for breakdown
  // FIXED: Case insensitive matching for origins
    // Rewards projections
  // Hardcoded to Sustainable KGV Online to ensure proper shipping credit % (5%) is applied 
  // rather than the potentially 0% physical store location of the user.
  const storeLocation = 'Sustainable KGV Online';
  const [currentStore, setCurrentStore] = useState<any>(null);

  useEffect(() => {
    const fetchStore = async () => {
        const { getStoreByLocation } = await import('@/services/shop');
        const store = await getStoreByLocation(storeLocation);
        setCurrentStore(store);
    };
    if (storeLocation) fetchStore();
  }, [storeLocation]);

  interface ShippingGroup {
    brandName: string;
    originName: string;
    items: CartItem[];
    weight: number; // Billable weight
    displayWeight: number; // Total physical weight
    originZone: string;
    bracketLabel?: string;
    groupSpv: number;
    creditPercentage: number;
    shipping: number;
    shippingCreditsEarned: number;
  }

  const productsByGroup = useMemo(() => {
    const groups = cart.reduce<Record<string, ShippingGroup>>((acc, item: CartItem) => {
        const brandName = item.brandName || 'Other';
        const originName = (item.placeOfOrigin && item.placeOfOrigin.length > 0) ? item.placeOfOrigin[0] : 'Unknown';
        const groupKey = brandName;
    
        if (!acc[groupKey]) {
          const originObj = originsList.find(o => o.name && o.name.toLowerCase() === originName.toLowerCase());
          const brandObj = brands.find(b => b.name && b.name.toLowerCase() === brandName.toLowerCase());
          
          acc[groupKey] = {
            brandName,
            originName,
            items: [],
            weight: 0,
            displayWeight: 0,
            shipping: 0,
            shippingCreditsEarned: 0,
            originZone: originObj?.zone || 'A',
            groupSpv: 0,
            creditPercentage: brandObj?.shippingPercentage ?? (currentStore?.shippingCommission || 0)
          };
        }
        acc[groupKey].items.push(item);
        
        const weight = item.weightInKg || parseWeightToKg(item.weight || '0.5kg');
        acc[groupKey].displayWeight += (weight * item.quantity);
        acc[groupKey].groupSpv += (item.spv || 0) * item.quantity;
        
        if (!item.freeShipping) {
          acc[groupKey].weight += (weight * item.quantity);
        }
        
        return acc;
    }, {});
    
    if (formData.state) {
        Object.values(groups).forEach(group => {
             const effectiveWeight = group.weight > 0 ? group.weight : group.displayWeight;

             if (effectiveWeight > 0) {
                const cost = calculateShippingCost(
                    effectiveWeight, 
                    group.originZone, 
                    formData.state, 
                    shippingConfig || undefined
                );
                
                group.shipping = cost;
                group.bracketLabel = getWeightBracketLabel(effectiveWeight);
                
                if (group.weight === 0) group.weight = effectiveWeight; 
             }
        });
    }

    return groups;
  }, [cart, originsList, brands, currentStore, formData.state, shippingConfig]);

  const totalWeight = Object.values(productsByGroup).reduce((sum, b) => sum + b.displayWeight, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = Object.values(productsByGroup).reduce((sum, group) => sum + group.shipping, 0);

  // SHIPPING CREDIT/DUE LOGIC:
  // 1. Positive balance (Credit): used to offset delivery fee, but CANNOT exceed the delivery fee itself.
  // 2. Negative balance (Due): must be paid back in full, added to the total delivery charges.
  const maxShippingCreditsAvailable = useMemo(() => {
    const balance = (user as any)?.shippingBalance || 0;
    return balance > 0 ? balance : 0;
  }, [user]);

  const shippingCreditsUsed = useMemo(() => {
    const balance = (user as any)?.shippingBalance || 0;
    if (balance > 0) {
        // AUTOMATIC CREDIT: Use min(balance, shippingCost)
        return Math.min(balance, shippingCost);
    } else if (balance < 0) {
        // DUE CASE: Full debt is added to the delivery charges
        return balance; 
    }
    return 0;
  }, [user, shippingCost]);

  
  // Calculate total GST
  const totalGst = useMemo(() => {
    return cart.reduce((sum, item) => {
        if (!item.gst?.percentage) return sum;
        const tax = (item.price * item.gst.percentage) / 100;
        return sum + (tax * item.quantity);
    }, 0);
  }, [cart]);

  // Calculate total SPV
  const totalSpv = cart.reduce((sum, item) => sum + ((item.spv || 0) * item.quantity), 0);



  // Automatic Coins Redemption Effect
  useEffect(() => {
  if (customerData && isCointEligible) {
    const balance = customerData.surabhiBalance || 0;
    const itemsTotalInclTax = subtotal + totalGst;

    const maxRedeemable = Math.min(balance, itemsTotalInclTax);

    setSurabhiCoinsToUse(maxRedeemable);
  } else {
    setSurabhiCoinsToUse(0);
  }
}, [customerData, subtotal, totalGst, isCointEligible]);

  // HYPER-TRANSPARENT DRILL DOWN LOGIC
  const { adjustedCart, redeemedCoinsTotal, totalAdjustedTax, totalOriginalBase, totalAdjustedBase } = useMemo(() => {
    // Total available for coins is now Items + GST
    const itemsTotalInclTax = subtotal + totalGst;
    
    // Cap totalCoins to the itemsTotalInclTax
    const totalCoins = Math.min(
  surabhiCoinsToUse,
  itemsTotalInclTax,
  Number(customerData?.surabhiBalance || 0)
);
    
    // First, map items with their shipping contribution
    let initialMapped = cart.map(item => {
        // Find which group this item belongs to to get its shipping share
        const brandName = item.brandName || 'Other';
        const group = productsByGroup[brandName];
        
        let shippingShare = 0;
        if (group && group.shipping > 0) {
            const weight = item.weightInKg || parseWeightToKg(item.weight || '0.5kg');
            const itemTotalWeight = weight * item.quantity;
            // Distribute shipping based on weight share in the group
            shippingShare = (itemTotalWeight / group.weight) * group.shipping;
        }

        const originalLineTotal = item.price * item.quantity;
        const originalTax = (originalLineTotal * (item.gst?.percentage || 0)) / 100;
        // Back-calculate base price: item.price treated as tax-inclusive MRP
        // base_unit_price = item.price / (1 + gst%/100)
        const gstRateOrig = (item.gst?.percentage || 0) / 100;
        const baseUnitPrice = gstRateOrig > 0 ? item.price / (1 + gstRateOrig) : item.price;
        const baseLineTotal = baseUnitPrice * item.quantity;
        const taxFromInclusive = originalLineTotal - baseLineTotal;
        const originalTotalInclTax = originalLineTotal; // price is already inclusive

        return {
            ...item,
            originalPrice: baseUnitPrice,
            originalLineTotal: baseLineTotal,
            originalTax: taxFromInclusive,
            originalTotalInclTax,
            shippingShare,
            gstPercentage: item.gst?.percentage || 0
        };
    });

    if (totalCoins <= 0 || itemsTotalInclTax <= 0) {
        const adjustedCart = initialMapped.map(item => ({
            ...item,
            adjustedPrice: item.originalPrice,
            adjustedLineTotal: item.originalTotalInclTax,
            adjustedTax: item.originalTax,
            itemSpv: (item.spv || 0) * item.quantity
        }));
        
        const totalOriginalBase = initialMapped.reduce((sum, item) => sum + item.originalLineTotal, 0);
        const totalAdjustedBase = totalOriginalBase; // No discount, so adjusted base equals original base

        return {
            adjustedCart,
            redeemedCoinsTotal: 0,
            totalAdjustedTax: totalGst,
            totalOriginalBase,
            totalAdjustedBase
        };
    }

    // Calculate generic discount percentage across the TOTAL (Subtotal + GST)
    const discountPercentage = Math.min(totalCoins / itemsTotalInclTax, 1);

    const adjusted = initialMapped.map(item => {
        // Apply discount proportionally to the post-tax item total
        const itemDiscount = item.originalTotalInclTax * discountPercentage;
        const adjustedLineTotal = item.originalTotalInclTax - itemDiscount;
        
        // Back-calculate tax and base from the adjusted total
        // Formula: AdjustedLineTotal = AdjustedBase + (AdjustedBase * GSTRate)
        // AdjustedBase = AdjustedLineTotal / (1 + GSTRate)
        const gstRate = item.gstPercentage / 100;
        const adjustedBaseLineTotal = adjustedLineTotal / (1 + gstRate);
        const adjustedTax = adjustedLineTotal - adjustedBaseLineTotal;
        const adjustedUnitPrice = adjustedBaseLineTotal / item.quantity;
        
        return {
            ...item,
            adjustedPrice: adjustedUnitPrice,
            adjustedLineTotal: adjustedLineTotal, // This is the total price for this line item (inclusive of tax)
            adjustedTax: adjustedTax,
            itemSpv: (item.spv || 0) * item.quantity
        };
    });

    const totalTax = adjusted.reduce((sum, item) => sum + item.adjustedTax, 0);
    const totalOriginalBase = initialMapped.reduce((sum, item) => sum + item.originalLineTotal, 0);
    const totalAdjustedBase = Math.max(0, totalOriginalBase - totalCoins);

    return {
        adjustedCart: adjusted,
        redeemedCoinsTotal: totalCoins,
        totalAdjustedTax: totalTax,
        totalOriginalBase,
        totalAdjustedBase
    };
  }, [cart, surabhiCoinsToUse, subtotal, user, totalGst, productsByGroup]);
  
  const itemsTotalInclTax = useMemo(() => {
    return subtotal + totalGst;
  }, [subtotal, totalGst]);

  const itemsTotalAfterCoins = useMemo(() => {
    return adjustedCart.reduce((sum, item) => sum + item.adjustedLineTotal, 0);
  }, [adjustedCart]);

  const netShippingCharges = useMemo(() => {
    return shippingCost - shippingCreditsUsed;
  }, [shippingCost, shippingCreditsUsed]);

  const totalPayableAmount = useMemo(() => {
    return itemsTotalAfterCoins + netShippingCharges;
  }, [itemsTotalAfterCoins, netShippingCharges]);

  // AGGREGATE ADJUSTED SPV (ASPV) LOGIC
  const aggregateAdjustedSpv = useMemo(() => {
    if (totalOriginalBase <= 0) return 0;
    // Formula: ASPV = (Total Adjusted Base × Total SPV) / Total Original Base
    return Math.max(0, (totalAdjustedBase * totalSpv) / totalOriginalBase);
  }, [totalAdjustedBase, totalOriginalBase, totalSpv]);

  // Update Net SPV for earnings (Removed subtraction of shipping credits used as it's separate from product rewards)
  const netSpvForEarning = useMemo(() => {
    return Math.max(0, aggregateAdjustedSpv);
  }, [aggregateAdjustedSpv]);

  const totalShippingCreditsEarned = useMemo(() => {
    if (totalSpv <= 0) return 0;
    
    return Object.values(productsByGroup).reduce((sum, group) => {
        // Brand's share of Net SPV
        const groupShareOfNetSPV = (group.groupSpv / totalSpv) * netSpvForEarning;
        // Credit earned for this brand
        const earned = (groupShareOfNetSPV * group.creditPercentage) / 100;
        return sum + earned;
    }, 0);
  }, [productsByGroup, totalSpv, netSpvForEarning]);

  const surabhiCoinsEarned = useMemo(() => {
    if (!currentStore) return 0;
    const commission = currentStore.cashOnlyCommission || 0;
    return Number(((netSpvForEarning * commission) / 100).toFixed(2));
  }, [netSpvForEarning, currentStore]);

  const sevaPoolEarned = useMemo(() => {
    if (!currentStore) return 0;
    const commission = currentStore.sevaCommission || 0;
    return Number(((netSpvForEarning * commission) / 100).toFixed(2));
  }, [netSpvForEarning, currentStore]);
  
  const referralBonusEarned = useMemo(() => {
    if (!currentStore) return 0;
    const commission = currentStore.referralCommission || 0;
    return Number(((netSpvForEarning * commission) / 100).toFixed(2));
  }, [netSpvForEarning, currentStore]);

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      // If already loaded in window
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }

      // Check for existing script tag
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        // Fallback: if already loaded but event missed
        setTimeout(() => resolve(!!(window as any).Razorpay), 500);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Pre-load Razorpay script when Online tab is clicked
  useEffect(() => {
    if (paymentMethod === 'online') {
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (!existingScript) {
            loadRazorpay().then(success => {
                if (success) {
                    // console.log("Razorpay script pre-loaded successfully");
                }
            });
        }
    }
  }, [paymentMethod]);

  const processAddressSave = async (currentAddress: Address) => {
    if (!saveNewAddress || !user || !user.id) return;

    try {
      // Check if address already exists in saved addresses
      const isDuplicate = savedAddresses.some(addr => 
        addr.street.toLowerCase() === currentAddress.street.toLowerCase() &&
        addr.city.toLowerCase() === currentAddress.city.toLowerCase() &&
        addr.zipCode === currentAddress.zipCode &&
        addr.fullName.toLowerCase() === currentAddress.fullName.toLowerCase() &&
        addr.mobile === currentAddress.mobile
      );

      if (!isDuplicate) {
        await addAddress(user.id, currentAddress);
        // Refresh local saved addresses
        const updated = await getAddresses(user.id);
        setSavedAddresses(updated);
      }
    } catch (error) {
      console.error("Failed to save address:", error);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!formData.state || !formData.street || !formData.zipCode || !formData.mobile) {
      toast.error("Please fill in all required address fields");
      return;
    }

    setLoading(true);
    try {
      if (paymentMethod === 'online') {
        if (totalPayableAmount < 1) {
          toast.error("Online payment requires a minimum amount of ₹1. Please use Manual / QR Pay for zero amount orders.");
          setLoading(false);
          return;
        }

        const scriptLoaded = await loadRazorpay();
        if (!scriptLoaded) {
          toast.error("Failed to load payment gateway. Please check your internet connection and try again.");
          setLoading(false);
          return;
        }

        if (!(window as any).Razorpay) {
            toast.error("Razorpay SDK not found. Please refresh the page.");
            setLoading(false);
            return;
        }
      }

      if (paymentMethod === 'cod') {
        // COD Flow
        const orderData = {
          items: adjustedCart,
          totalAmount: totalPayableAmount,
          totalTax: totalAdjustedTax,
          shippingAddress: formData,
          paymentMethod: 'cod',
          paymentStatus: 'pending',
          shippingPointsEarned: totalShippingCreditsEarned,
          shippingPointsUsed: shippingCreditsUsed,
          shippingCreditsDebited: shippingCreditsUsed > 0 ? shippingCreditsUsed : 0,
          netShippingCharges: netShippingCharges,
          surabhiCoinsUsed: redeemedCoinsTotal,
          surabhiCoinsEarned: surabhiCoinsEarned,
          sevaCoinsEarned: sevaPoolEarned,
          referralBonusEarned: referralBonusEarned
        };

        const codOrderId = await createOrder(orderData as any);

        await addDoc(collection(db, 'Activity'), {
          type: 'order_placed',
          remarks: `New COD Order of ₹${orderData.totalAmount.toFixed(2)} placed`,
          amount: orderData.totalAmount,
          customerName: formData.fullName,
          customerMobile: formData.mobile,
          storeLocation: currentStore?.storeName || 'Online',
          paymentMethod: 'cod',
          createdAt: Timestamp.now(),
          demoStore: (user as any)?.demoStore || false
        });

        await processAddressSave(formData);

        if (!(user as any)?.demoStore && codOrderId) {
          // Fire-and-forget — SMS failures must not block checkout.
          void notifyOrderPlacedSms({
            phone: formData.mobile,
            customerName: formData.fullName,
            orderId: codOrderId,
            amount: orderData.totalAmount,
            storeName: currentStore?.storeName || 'Online',
          });

          if (redeemedCoinsTotal > 0 || shippingCreditsUsed > 0) {
            const customerSurabhiBalance = Number((user as any)?.surabhiBalance || 0);
            void notifyCoinsRedeemedSms({
              phone: formData.mobile,
              customerName: formData.fullName,
              orderOrInvoiceId: codOrderId,
              amount: orderData.totalAmount,
              surabhiCoinsUsed: redeemedCoinsTotal,
              shippingCreditsUsed: shippingCreditsUsed,
              balance: customerSurabhiBalance,
            });
          }
        }

        clearCart();
        toast.success("Order placed successfully!");
        navigate('/shop');
      } else {
        toast.loading("Initiating secure payment...", { id: 'razorpay-loading' });
        
        // Ensure Firebase Auth is active for callable functions
        try {
            const { getFirebaseUserForFunctions } = await import('@/lib/authService');
            await getFirebaseUserForFunctions();
        } catch (authErr: any) {
            console.error("Firebase Re-auth Error:", authErr);
            toast.error(authErr.message || "Session expired. Please log out and back in.", { id: 'razorpay-loading' });
            setLoading(false);
            return;
        }

        const { functions } = await import('@/lib/firebase');
        const { httpsCallable } = await import('firebase/functions');
        const createRazorpayOrderFn = httpsCallable(functions, 'createRazorpayOrder');
        const verifyRazorpayPaymentFn = httpsCallable(functions, 'verifyRazorpayPayment');

        let orderDetails: any;
        try {
            const razorpayOrderRes = await createRazorpayOrderFn({
                amount: totalPayableAmount,
                currency: 'INR',
                userId: user?.id
            });
            orderDetails = razorpayOrderRes.data as any;
        } catch (err: any) {
            console.error("Razorpay Order Creation Error:", err);
            toast.error("Failed to create secure payment order. Please try again.", { id: 'razorpay-loading' });
            setLoading(false);
            return;
        }

        toast.loading("Opening payment gateway...", { id: 'razorpay-loading' });
        
        let firebaseOrderId: string | null = null;
        try {
            firebaseOrderId = await createOrder({
                items: adjustedCart,
                totalAmount: totalPayableAmount,
                totalTax: totalAdjustedTax,
                shippingAddress: formData,
                paymentMethod: 'online',
                paymentStatus: 'pending',
                status: 'pending',
                shippingPointsEarned: totalShippingCreditsEarned,
                shippingPointsUsed: shippingCreditsUsed,
                shippingCreditsDebited: shippingCreditsUsed > 0 ? shippingCreditsUsed : 0,
                netShippingCharges: netShippingCharges,
                surabhiCoinsUsed: redeemedCoinsTotal,
                surabhiCoinsEarned: surabhiCoinsEarned,
                sevaCoinsEarned: sevaPoolEarned,
                referralBonusEarned: referralBonusEarned,
                demoStore: (user as any)?.demoStore || false,
                paymentDetails: {
                    razorpay_order_id: orderDetails.id,
                    status: 'created'
                }
            } as any);
        } catch (err: any) {
            console.error("Firestore Order Creation Error:", err);
            toast.error("Failed to record order details. Please try again.", { id: 'razorpay-loading' });
            setLoading(false);
            return;
        }
        
        toast.dismiss('razorpay-loading');

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID',
          amount: orderDetails.amount,
          currency: orderDetails.currency,
          name: 'Surabhi Loyalty',
          description: 'Order Payment',
          order_id: orderDetails.id,
          handler: async function (response: any) {
            try {
              setLoading(true);
              const verifyRes = await verifyRazorpayPaymentFn({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });

              if ((verifyRes.data as any).success) {
                const { updateDoc, doc } = await import('firebase/firestore');
                const orderRef = doc(db, 'orders', firebaseOrderId!);
                await updateDoc(orderRef, {
                  paymentStatus: 'paid',
                  status: 'received',
                  'paymentDetails.razorpay_payment_id': response.razorpay_payment_id,
                  'paymentDetails.razorpay_signature': response.razorpay_signature,
                  updatedAt: Timestamp.now()
                });

                await addDoc(collection(db, 'Activity'), {
                  type: 'order_placed',
                  remarks: `Online Payment Success for Order ₹${totalPayableAmount.toFixed(2)}`,
                  amount: totalPayableAmount,
                  customerName: formData.fullName,
                  customerMobile: formData.mobile,
                  storeLocation: currentStore?.storeName || 'Online',
                  paymentMethod: 'online',
                  createdAt: Timestamp.now(),
                  demoStore: (user as any)?.demoStore || false
                });

                await processAddressSave(formData);

                if (!(user as any)?.demoStore && firebaseOrderId) {
                  void notifyOrderPlacedSms({
                    phone: formData.mobile,
                    customerName: formData.fullName,
                    orderId: firebaseOrderId,
                    amount: totalPayableAmount,
                    storeName: currentStore?.storeName || 'Online',
                  });

                  if (redeemedCoinsTotal > 0 || shippingCreditsUsed > 0) {
                    const customerSurabhiBalance = Number((user as any)?.surabhiBalance || 0);
                    void notifyCoinsRedeemedSms({
                      phone: formData.mobile,
                      customerName: formData.fullName,
                      orderOrInvoiceId: firebaseOrderId,
                      amount: totalPayableAmount,
                      surabhiCoinsUsed: redeemedCoinsTotal,
                      shippingCreditsUsed: shippingCreditsUsed,
                      balance: customerSurabhiBalance,
                    });
                  }
                }

                clearCart();
                toast.success("Payment Successful! Order placed.");
                navigate('/shop');
              } else {
                toast.error("Payment Verification Failed");
              }
            } catch (err) {
              console.error(err);
              toast.error("Payment Verification Error");
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: formData.fullName,
            contact: formData.mobile
          },
          theme: {
            color: '#3399cc'
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            }
          }
        };

        const paymentObject = new (window as any).Razorpay(options);
        paymentObject.open();
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to initiate order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
      return (
          <ShopLayout title="Checkout">
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="bg-white p-8 rounded-full shadow-sm mb-6">
                      <ShoppingCart className="h-16 w-16 text-gray-300" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
                  <p className="text-gray-500 mb-8 max-w-md">
                      Looks like you haven't added anything to your cart yet. 
                      Go back to the shop to discover our amazing products.
                  </p>
                  <Button size="lg" onClick={() => navigate('/shop')} className="rounded-full px-8">
                      Back to Shop
                  </Button>
              </div>
          </ShopLayout>
      );
  }

  return (
    <ShopLayout title="Checkout" onBack={() => navigate('/shop/cart')}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-8 items-start">
          {/* Left Column: Address & Payment (40%) */}
          <div className="w-full lg:col-span-2 space-y-8">
            <Card className="border shadow-sm bg-white rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-lg font-bold text-slate-900">
                  Shipping Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* Saved Addresses Selection */}
                <div className="mb-6 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Shipping Address</Label>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                                setIsAddingNewAddress(true);
                                setSelectedAddressIndex(null);
                                setFormData({
                                    fullName: user ? ('customerName' in user ? (user as any).customerName : (user as any).staffName) : '',
                                    mobile: user ? ('customerMobile' in user ? (user as any).customerMobile : (user as any).staffMobile) : '',
                                    street: '',
                                    city: '',
                                    state: '',
                                    zipCode: '',
                                    landmark: ''
                                } as Address);
                            }}
                            className="text-slate-900 font-bold text-[10px] uppercase h-auto p-0 hover:bg-transparent underline decoration-slate-200"
                        >
                            + Add New Address
                        </Button>
                    </div>
                    
                    {savedAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {savedAddresses.map((addr, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => {
                                        setIsAddingNewAddress(false);
                                        setSelectedAddressIndex(idx);
                                        setFormData(addr);
                                    }}
                                    className={`relative p-3 rounded-xl border transition-all cursor-pointer ${
                                        !isAddingNewAddress && selectedAddressIndex === idx 
                                        ? 'border-slate-900 bg-slate-50' 
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                         <p className="font-bold text-slate-900 text-xs">{addr.fullName}</p>
                                         {!isAddingNewAddress && selectedAddressIndex === idx && (
                                            <div className="h-2 w-2 rounded-full bg-slate-900" />
                                         )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                                        {addr.street}, {addr.city}, {addr.state} - {addr.zipCode}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-1">Mobile: {addr.mobile}</p>
                                </div>
                            ))}
                            
                            {/* New Address Placeholder Card */}
                            <div 
                                onClick={() => {
                                    setIsAddingNewAddress(true);
                                    setSelectedAddressIndex(null);
                                    setFormData({
                                        fullName: getUserName(user),
                                        mobile: user ? ('customerMobile' in user ? (user as any).customerMobile : (user as any).staffMobile) : '',
                                        street: '',
                                        city: '',
                                        state: '',
                                        zipCode: '',
                                        landmark: ''
                                    } as Address);
                                }}
                                className={`p-3 rounded-xl border border-dashed transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                    isAddingNewAddress 
                                    ? 'border-slate-900 bg-slate-50' 
                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                }`}
                            >
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Add New Address</span>
                            </div>
                        </div>
                    ) : (
                         <div className="text-[11px] text-slate-400 font-medium bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                             No saved addresses. Enter details below.
                         </div>
                    )}
                </div>
                
                {/* Manual Address Form */}
                <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</Label>
                            <Input 
                                required 
                                value={formData.fullName} 
                                onChange={e => setFormData({...formData, fullName: e.target.value})} 
                                className="h-10 rounded-lg border-slate-200 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number</Label>
                            <Input 
                                required 
                                type="tel"
                                value={formData.mobile} 
                                onChange={e => setFormData({...formData, mobile: e.target.value})} 
                                className="h-10 rounded-lg border-slate-200 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Street Address</Label>
                        <Input 
                            required 
                            value={formData.street} 
                            onChange={e => setFormData({...formData, street: e.target.value})} 
                            placeholder="House No, Street Name, Colony"
                            className="h-10 rounded-lg border-slate-200 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">City</Label>
                            <Input 
                                required 
                                value={formData.city} 
                                onChange={e => setFormData({...formData, city: e.target.value})} 
                                className="h-10 rounded-lg border-slate-200 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">State</Label>
                            <Select 
                                value={formData.state} 
                                onValueChange={val => setFormData({...formData, state: val})}
                            >
                                <SelectTrigger className="h-10 rounded-lg border-slate-200 text-sm">
                                    <SelectValue placeholder="Select State" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg shadow-xl">
                                    {INDIAN_STATES.map(state => (
                                        <SelectItem key={state} value={state} className="rounded-md">{state}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Pincode</Label>
                            <Input 
                                required 
                                value={formData.zipCode} 
                                onChange={e => setFormData({...formData, zipCode: e.target.value})} 
                                className="h-10 rounded-lg border-slate-200 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Landmark</Label>
                            <Input 
                                value={formData.landmark} 
                                onChange={e => setFormData({...formData, landmark: e.target.value})} 
                                className="h-10 rounded-lg border-slate-200 text-sm"
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                        <Checkbox 
                            id="save-address"
                            checked={saveNewAddress}
                            onCheckedChange={(checked) => setSaveNewAddress(!!checked)}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        <Label htmlFor="save-address" className="text-[11px] font-medium text-slate-600 cursor-pointer">
                            Save address for future orders
                        </Label>
                    </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-white rounded-xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
                    <CardTitle className="text-lg font-bold text-slate-900">
                        Payment Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <Tabs value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="cod" className="text-xs font-bold">Manual / QR Pay</TabsTrigger>
                            <TabsTrigger value="online" className="text-xs font-bold">Online (Razorpay)</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="cod" className="mt-0">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 md:p-8">
                                <div className="flex flex-col items-center gap-8">
                                    <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 shrink-0 transform transition-transform hover:scale-105">
                                        <img 
                                            src="/qr.jpeg" 
                                            alt="Payment QR Code" 
                                            className="h-64 w-64 md:h-80 md:w-80 object-contain" 
                                            onError={(e) => {
                                                e.currentTarget.src = 'https://placehold.co/400x400?text=Scan+to+Pay';
                                            }}
                                        />
                                    </div>
                                    
                                    <div className="w-full text-center space-y-6 max-w-xl">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Scan & Pay Instantly</h3>
                                            <p className="text-sm text-slate-500 font-medium mt-2">Safe, secure and direct bank transfer via any UPI app.</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="bg-slate-900 rounded-2xl p-6 md:p-8 shadow-xl border border-slate-800 flex flex-col items-center gap-6 group transition-all hover:scale-[1.01]">
                                                 <div className="flex flex-col items-center gap-2">
                                                     <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em]">Official UPI ID</span>
                                                     <span className="text-2xl md:text-3xl font-mono font-black text-white selection:bg-white/20 break-all text-center">
                                                         sustainablekgv@cnrb
                                                     </span>
                                                 </div>
                                                 
                                                 <Button 
                                                    variant="secondary" 
                                                    size="lg" 
                                                    onClick={() => handleCopy('sustainablekgv@okicici', 'UPI ID')}
                                                    className={`h-14 px-8 w-full sm:w-auto font-black text-lg rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all ${copiedField === 'UPI ID' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
                                                 >
                                                    {copiedField === 'UPI ID' ? (
                                                        <><Check className="h-6 w-6" /> Copied!</>
                                                    ) : (
                                                        <><Copy className="h-6 w-6" /> Copy UPI ID</>
                                                    )}
                                                 </Button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col items-center gap-2 group hover:border-green-500 transition-colors">
                                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Support</span>
                                                     <span className="text-sm font-mono font-black text-slate-800">9606979530</span>
                                                     <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => window.open('https://wa.me/919606979530', '_blank')}
                                                        className="h-7 px-2 text-green-600 hover:bg-green-50"
                                                     >
                                                        <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                                                     </Button>
                                                </div>

                                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col items-center gap-2 group hover:border-slate-900 transition-colors">
                                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Call</span>
                                                     <span className="text-sm font-mono font-black text-slate-800">9606979530</span>
                                                     <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => window.location.href = 'tel:9606979530'}
                                                        className="h-7 px-2 text-slate-900 hover:bg-slate-100"
                                                     >
                                                        <Phone className="h-3 w-3 mr-1" /> Call Now
                                                     </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4 text-left">
                                            <p className="font-black text-[11px] text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                                <span className="h-1 w-4 bg-slate-900 rounded-full"></span>
                                                Payment Steps
                                            </p>
                                            {[
                                                "Scan the QR code above or pay to the UPI ID.",
                                                "Important: Take a screenshot of the payment confirmation.",
                                                "Share the screenshot on WhatsApp with your name/order details."
                                            ].map((step, i) => (
                                                <div key={i} className="flex gap-4 items-start">
                                                    <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[11px] font-black shadow-sm">{i+1}</span>
                                                    <span className="text-sm text-slate-600 font-medium leading-normal">{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="online" className="mt-0">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center space-y-6">
                                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 inline-block">
                                    <img 
                                        src="https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg" 
                                        alt="Razorpay" 
                                        className="h-12 w-auto mx-auto"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-slate-900">Secure Online Payment</h3>
                                    <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">
                                        Pay securely via Credit/Debit Cards, NetBanking, UPI or Wallets.
                                    </p>
                                </div>
                                <div className="flex justify-center gap-3">
                                    <div className="h-8 w-12 bg-white rounded border border-slate-100 flex items-center justify-center grayscale opacity-50">
                                        <span className="text-[8px] font-bold">VISA</span>
                                    </div>
                                    <div className="h-8 w-12 bg-white rounded border border-slate-100 flex items-center justify-center grayscale opacity-50">
                                        <span className="text-[8px] font-bold">UPI</span>
                                    </div>
                                    <div className="h-8 w-12 bg-white rounded border border-slate-100 flex items-center justify-center grayscale opacity-50">
                                        <span className="text-[8px] font-bold">GPay</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    Trusted by millions of businesses
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary (60%) */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="border shadow-sm bg-white rounded-xl overflow-hidden sticky top-8">
              <CardHeader className="bg-white border-b border-slate-100 p-6">
                 <CardTitle className="text-2xl font-black text-slate-900">Order Summary</CardTitle>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                   {cart.length} Products
                 </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-hidden">
                    <table className="w-full text-left border-collapse table-auto">
                        <thead className="sticky top-0 bg-slate-50 z-20">
                            <tr className="border-b border-slate-200">
                                <th className="pl-4 pr-2 py-3 text-[11px] font-black uppercase text-slate-500 tracking-wider">Product</th>
                                <th className="px-1.5 py-3 text-[11px] font-black uppercase text-slate-500 text-center tracking-wider">Qty</th>
                                <th className="px-1.5 py-3 text-[11px] font-black uppercase text-slate-500 text-right tracking-wider">Base</th>
                                <th className="px-1.5 py-3 text-[11px] font-black uppercase text-slate-500 text-right tracking-wider">Tax</th>
                                <th className="pl-2 pr-4 py-3 text-[11px] font-black uppercase text-slate-500 text-right tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {adjustedCart.map(item => (
                                <React.Fragment key={item.productId}>
                                    {/* Original Row */}
                                    <tr className="bg-white">
                                        <td className="pl-4 pr-2 py-3">
                                            <p className="font-bold text-slate-900 text-sm leading-tight mb-0.5">{item.name}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[11px] text-amber-600 font-bold uppercase tracking-tighter">
                                                    SPV: {item.itemSpv.toFixed(2)}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-1.5 py-3 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-bold text-slate-600">{item.quantity}</span>
                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                    {item.quantity} x {item.productQuantity || item.weight || '1'} {item.unitsOfMeasure === 'pcs' ? 'pc' : (item.unitsOfMeasure || '')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-1.5 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">
                                            ₹{item.originalLineTotal.toFixed(2)}
                                        </td>
                                        <td className="px-1.5 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">
                                            ₹{item.originalTax.toFixed(2)}
                                            <span className="block text-[9px] text-slate-400 font-black">({item.gstPercentage}%)</span>
                                        </td>
                                        <td className="pl-2 pr-4 py-3 text-right text-sm font-black text-slate-900 whitespace-nowrap">
                                            ₹{item.originalTotalInclTax.toFixed(2)}
                                        </td>
                                    </tr>
                                    
                                    {/* Adjusted Row (Only if coins used) */}
                                    {redeemedCoinsTotal > 0 && (
                                        <tr className="bg-slate-50/50">
                                            <td className="pl-4 pr-2 py-2">
                                                <span className="inline-flex items-center px-1 py-0.5 rounded bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest leading-none">
                                                    ADJUSTED
                                                </span>
                                            </td>
                                            <td className="px-1.5 py-2 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-sm font-bold text-slate-400">-</span>
                                                </div>
                                            </td>
                                            <td className="px-1.5 py-2 text-right text-sm font-black text-slate-900 whitespace-nowrap">
                                                ₹{(item.adjustedPrice * item.quantity).toFixed(2)}
                                            </td>
                                            <td className="px-1.5 py-2 text-right text-sm font-black text-slate-900 whitespace-nowrap">
                                                ₹{item.adjustedTax.toFixed(2)}
                                                <span className="block text-[9px] text-slate-400 font-black">({item.gstPercentage}%)</span>
                                            </td>
                                            <td className="pl-2 pr-4 py-2 text-right text-sm font-black text-slate-900 whitespace-nowrap">
                                                ₹{item.adjustedLineTotal.toFixed(2)}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium text-purple-900">Items Total (Excl Tax)</span>
                        <span className="font-bold text-purple-600">₹{totalOriginalBase.toFixed(2)}</span>
                    </div>

                            {/* 🔥 Surabhi Coins Section */}
<div
  className={`p-4 rounded-lg border ${
    isCointEligible
      ? 'bg-green-50 border-green-200'
      : 'bg-gray-50 border-gray-200'
  }`}
>
  <div className="flex justify-between items-center mb-2">
    <span className="text-sm font-bold text-slate-800">
      Surabhi Coins
    </span>
    <span className="text-xs font-bold text-slate-500">
      Balance: ₹{(customerData?.surabhiBalance || 0).toFixed(2)}
    </span>
  </div>

  {isCointEligible ? (
    <div className="flex justify-between items-center">
      <span className="text-sm text-green-700 font-medium">
        Coins Applied
      </span>
      <span className="font-bold text-green-600">
        -₹{redeemedCoinsTotal.toFixed(2)}
      </span>
    </div>
  ) : (
    <div className="text-xs text-red-600 font-medium">
      Not eligible to redeem coins.
      <br />
      Spend ₹
      {Math.max(
        0,
        (customerData?.cummulativeTarget || 0) -
(customerData?.cumTotal || 0)
      ).toFixed(2)}{' '}
      more to unlock.
    </div>
  )}
</div>

                    <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                        <span className="text-sm font-medium text-indigo-900 font-bold italic">Total SPV Points</span>
                        <span className="font-bold text-indigo-600 font-mono italic">{totalSpv.toFixed(2)}</span>
                    </div>

                    {redeemedCoinsTotal > 0 && (
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                            <span className="text-sm font-medium text-amber-900">
                                Surabhi Coins Applied ({( (redeemedCoinsTotal / (totalOriginalBase || 1)) * 100).toFixed(1)}%)
                            </span>
                            <span className="font-bold text-amber-600">-{redeemedCoinsTotal.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">Adjusted Total Items Value</span>
                        <span className="font-bold text-slate-900">₹{totalAdjustedBase.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">Adjusted Tax value</span>
                        <span className="font-bold text-slate-900">₹{totalAdjustedTax.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <span className="text-sm font-medium text-emerald-900">Adjusted Items Total(Incl Tax)</span>
                        <span className="font-bold text-emerald-600">₹{itemsTotalAfterCoins.toFixed(2)}</span>
                    </div>

                    {/* Brand Wise Shipping Breakdown */}
                    <div className="py-3 space-y-2.5 border border-indigo-100 bg-indigo-50/30 rounded-xl px-4 my-2">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex justify-between items-center">
                            <span>Delivery Breakdown</span>
                            <span className="text-indigo-600">Brand Wise</span>
                        </p>
                        {Object.values(productsByGroup).map((group) => (
                            <div key={group.brandName} className="grid grid-cols-2 gap-4 items-center border-b border-indigo-100/30 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-700">{group.brandName}</span>
                                    <span className="text-[9px] text-indigo-500 font-medium leading-none mt-1">Total Weight: {group.displayWeight.toFixed(2)}kg</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-black text-slate-900">₹{group.shipping.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">Shipping Balance Available</span>
                        <span className={`font-bold ${(user as any)?.shippingBalance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            ₹{((user as any)?.shippingBalance || 0).toFixed(2)}
                        </span>
                    </div> */}

                    <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                        <span className="text-sm font-medium text-indigo-900">Total Estimated Delivery Charges</span>
                        <span className="font-bold text-indigo-600">₹{shippingCost.toFixed(2)}</span>
                    </div>

                        <div className="mt-2 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
  <p className="text-xs text-amber-800 leading-relaxed">
    <span className="font-semibold">Note:</span> Delivery charges shown are estimated. 
    Final charges will be calculated after packing based on actual weight. 
    Any difference will be adjusted in your shipping wallet 
    (debited or credited accordingly).
  </p>
</div>
                    {/* Shipping Credits Field */}
                    {/* {shippingCreditsUsed > 0 && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-blue-900">Shipping Credits Applied</p>
                                    <p className="text-[10px] text-blue-600 font-medium">
                                        Applied from Balance: ₹{shippingCreditsUsed.toFixed(2)}
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                                    Balance: ₹{maxShippingCreditsAvailable.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )} */}

                    {shippingCreditsUsed !== 0 && (
                        <div className={`flex items-center justify-between p-3 rounded-lg ${shippingCreditsUsed > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                            <span className={`text-sm font-black ${shippingCreditsUsed > 0 ? 'text-blue-900' : 'text-red-900'}`}>
                                {shippingCreditsUsed > 0 ? 'Shipping Credits Applied (Capped at Fee)' : 'Previous Shipping Dues (Added Total)'}
                            </span>
                            <span className={`font-bold ${shippingCreditsUsed > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {shippingCreditsUsed > 0 ? '-' : '+'}₹{Math.abs(shippingCreditsUsed).toFixed(2)}
                            </span>
                        </div>
                    )}


                    <div className="pt-4 border-t border-slate-200">
                         <div className="flex justify-between items-end mb-6">
                             <div>
                                 <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Total Payable Amount</p>
                                 <h2 className="text-5xl font-black text-slate-900 leading-none mt-2">
                                     ₹{totalPayableAmount.toFixed(2)}
                                 </h2>
                                 <p className="text-[10px] text-slate-400 font-black uppercase mt-3 flex items-center gap-2">
                                     <span className="h-1 w-4 bg-slate-200 rounded-full"></span>
                                     Inclusive of GST & Delivery Fees
                                 </p>
                             </div>
                         </div>
                    </div>

                    {/* Projections Section (Simplified) */}
                    <div className="pt-8 border-t border-slate-200">
                        <div className="flex flex-col gap-1 mb-6">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Projected Rewards</p>
                            <p className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit border border-emerald-100">
                                Basis: Adjusted SPV ({aggregateAdjustedSpv.toFixed(2)})
                            </p>
                        </div>
                        <div className="space-y-3">
                             <div className="flex justify-between text-sm font-black">
                                 <span className="text-slate-600">Surabhi Coins ({currentStore?.cashOnlyCommission || 0}%)</span>
                                 <span className="text-slate-900">{surabhiCoinsEarned}</span>
                             </div>
                             <div className="flex justify-between text-sm font-black">
                                 <span className="text-slate-600">Shipping Credit ({currentStore?.shippingCommission || 0}%)</span>
                                 <span className="text-slate-900">₹{totalShippingCreditsEarned.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-sm font-black">
                                 <span className="text-slate-600">Seva Pool ({currentStore?.sevaCommission || 0}%)</span>
                                 <span className="text-slate-900">₹{sevaPoolEarned.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-sm font-black">
                                 <span className="text-slate-600">Referral Bonus ({currentStore?.referralCommission || 0}%)</span>
                                 <span className="text-slate-900">₹{referralBonusEarned.toFixed(2)}</span>
                             </div>
                        </div>
                    </div>

                    <div className="pt-6 space-y-3">
                        <Button 
                            form="checkout-form"
                            disabled={loading || cart.length === 0}
                            className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-lg transition-all"
                        >
                            {loading ? 'Processing...' : 'Place Order'}
                        </Button>
                        <p className="text-[9px] text-slate-400 font-medium text-center uppercase tracking-wider">
                             Secure End-to-End Encryption
                        </p>
                    </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </ShopLayout>
  );
};

export default CheckoutPage;