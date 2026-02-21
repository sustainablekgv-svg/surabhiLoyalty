import { WhatsAppIcon } from '@/components/shop/FloatingWhatsApp';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { addAddress, getAddresses } from '@/lib/addressService';
import { db } from '@/lib/firebase';
import { calculateShippingCost, getWeightBracketLabel, INDIAN_STATES, parseWeightToKg } from '@/services/shipping';
import { Address, CartItem } from '@/types/shop';
import { collection, getDocs } from 'firebase/firestore';
import { Check, Copy, Loader2, Plus, ShoppingCart, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const CheckoutPage = () => {
  const { cart, clearCart, createOrder } = useShop();
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

  useEffect(() => {
    // Load addresses if user is a customer
    if (user && 'role' in user && user.role === 'customer' && user.id) {
       getAddresses(user.id).then(addresses => {
           setSavedAddresses(addresses);
           if (addresses.length > 0) {
               setSavedAddresses(addresses);
               setSelectedAddressIndex(0);
               setFormData(addresses[0]);
           } else {
               setIsAddingNewAddress(true);
           }
       }).catch(console.error);
    }
  }, [user]);

  const [formData, setFormData] = useState<Address>({
    fullName: user ? ('customerName' in user ? user.customerName : (user as any).staffName) : '',
    mobile: user ? ('customerMobile' in user ? user.customerMobile : (user as any).staffMobile) : '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    landmark: ''
  });

  const [brands, setBrands] = useState<any[]>([]);
  const [shippingCreditsUsed, setShippingCreditsUsed] = useState(0);
  const [maxShippingCreditsAvailable, setMaxShippingCreditsAvailable] = useState(0);


  const [shippingConfig, setShippingConfig] = useState<any>(null);
  const [originsList, setOriginsList] = useState<any[]>([]);

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
        setMaxShippingCreditsAvailable(user.shippingBalance || 0);
    }
  }, [user]);


  // Calculate totals by brand + origin for breakdown
  // FIXED: Case insensitive matching for origins
    interface ShippingGroup {
    brandName: string;
    originName: string;
    items: CartItem[];
    weight: number; // Billable weight
    displayWeight: number; // Total physical weight
    shipping: number;
    shippingCreditsEarned: number;
    originZone: string;
  }

  const productsByGroup = useMemo(() => {
    const groups = cart.reduce<Record<string, ShippingGroup>>((acc, item: CartItem) => {
        const brandName = item.brandName || 'Other';
        const originName = (item.placeOfOrigin && item.placeOfOrigin.length > 0) ? item.placeOfOrigin[0] : 'Unknown';
        // Use brandName as the primary grouping key
        const groupKey = brandName;
    
        if (!acc[groupKey]) {
          // Find origin case-insensitively
          const originObj = originsList.find(o => o.name && o.name.toLowerCase() === originName.toLowerCase());
          
          acc[groupKey] = {
            brandName,
            originName, // keep original name for display
            items: [],
            weight: 0,
            displayWeight: 0,
            shipping: 0,
            shippingCreditsEarned: 0,
            // Fallback to Zone A if origin not found or collection empty
            originZone: originObj?.zone || 'A' 
          };
        }
        acc[groupKey].items.push(item);
        
        // Calculate weight for ALL items for display purposes
        const weight = item.weightInKg || parseWeightToKg(item.weight || '0.5kg');
        acc[groupKey].displayWeight += (weight * item.quantity);
        
        if (!item.freeShipping) {
          acc[groupKey].weight += (weight * item.quantity);
        }

        // Shipping credits will be calculated later using the current store's shippingCommission
        acc[groupKey].shippingCreditsEarned = 0;
        
        return acc;
    }, {});
    
    // Calculate shipping for each group
    // Calculate shipping for each group
    if (formData.state) {
        Object.values(groups).forEach(group => {
             // Fallback: If billable weight is 0 (all items free shipping?) but we have items, 
             // we use displayWeight to ensure a shipping cost is always calculated as per user request.
             const effectiveWeight = group.weight > 0 ? group.weight : group.displayWeight;

             if (effectiveWeight > 0) {
                const cost = calculateShippingCost(
                    effectiveWeight, 
                    group.originZone, 
                    formData.state, 
                    shippingConfig || undefined
                );
                
                group.shipping = cost;
                
                // If we used fallback, update weight so share calculation works correctly
                if (group.weight === 0) group.weight = effectiveWeight; 
             }
        });
    }

    return groups;
  }, [cart, originsList, formData.state, shippingConfig]);

  const totalWeight = Object.values(productsByGroup).reduce((sum, b) => sum + b.displayWeight, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = Object.values(productsByGroup).reduce((sum, group) => sum + group.shipping, 0);

  // Calculate total SPV
  const totalSpv = cart.reduce((sum, item) => sum + ((item.spv || 0) * item.quantity), 0);

  // Rewards projections
  const storeLocation = user && 'storeLocation' in user ? user.storeLocation : 'Main Store';
  const [currentStore, setCurrentStore] = useState<any>(null);

  useEffect(() => {
    const fetchStore = async () => {
        const { getStoreByLocation } = await import('@/services/shop');
        const store = await getStoreByLocation(storeLocation);
        setCurrentStore(store);
    };
    if (storeLocation) fetchStore();
  }, [storeLocation]);

  const totalShippingCreditsEarned = useMemo(() => {
    if (!currentStore) return 0;
    const commission = currentStore.shippingCommission || 0;
    return (totalSpv * commission) / 100;
  }, [totalSpv, currentStore]);

  const netSpvForEarning = useMemo(() => {
    // Loyalty points should be calculated on SPV minus any credits used
    return Math.max(0, totalSpv - shippingCreditsUsed);
  }, [totalSpv, shippingCreditsUsed]);

  const surabhiCoinsEarned = useMemo(() => {
    if (!currentStore) return 0;
    const commission = currentStore.cashOnlyCommission || 0;
    return Math.round((netSpvForEarning * commission) / 100);
  }, [netSpvForEarning, currentStore]);

  const sevaPoolEarned = useMemo(() => {
    if (!currentStore) return 0;
    const commission = currentStore.sevaCommission || 0;
    return Math.round((netSpvForEarning * commission) / 100);
  }, [netSpvForEarning, currentStore]);

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
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
      if (paymentMethod === 'cod') {
          // COD Flow
          const netShippingCharges = Math.max(0, shippingCost - shippingCreditsUsed);
          const orderData = {
              items: cart,
              totalAmount: subtotal + netShippingCharges,
              shippingAddress: formData,
              paymentMethod: 'cod',
              paymentStatus: 'pending',
              shippingPointsEarned: totalShippingCreditsEarned,
              shippingPointsUsed: shippingCreditsUsed,
              netShippingCharges: netShippingCharges,
              surabhiCoinsEarned: surabhiCoinsEarned,
              sevaCoinsEarned: sevaPoolEarned
          };
          
          await createOrder(orderData as any); 
          
          // Sales processing deferred to Admin Confirmation
          // Coins and Referrals will be calculated when order status is set to 'confirmed'

          clearCart();
          toast.success("Order placed successfully!");
          navigate('/shop');
      } else {
          // Razorpay Flow
          const res = await loadRazorpay();
          if (!res) {
              toast.error('Razorpay SDK failed to load. Are you online?');
              return;
          }

          // 1. Create Order on Backend (Cloud Function)
          // We need to call the Cloud Function directly or via shop-context.
          // Since shop-context doesn't expose createRazorpayOrder, we'll import generic cloud function caller or use fetching.
          // Let's assume user.functions allows calling 'createRazorpayOrder'.
          // Or we can import { createRazorpayOrder } from '@/services/api' if we created it on frontend?
          // We haven't created frontend service wrapper for it yet.
          // I'll call using httpsCallable from firebase/functions directly here.
          
          const { functions } = await import('@/lib/firebase');
          const { httpsCallable } = await import('firebase/functions');
          const createRazorpayOrderFn = httpsCallable(functions, 'createRazorpayOrder');
          const verifyRazorpayPaymentFn = httpsCallable(functions, 'verifyRazorpayPayment');

          const netShippingCharges = Math.max(0, shippingCost - shippingCreditsUsed);
          const amount = subtotal + netShippingCharges;
          const razorpayOrder = await createRazorpayOrderFn({ amount: amount, currency: 'INR' });
          const orderDetails = razorpayOrder.data as any;

          const options = {
              key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID', // Replace with valid key or env
              amount: orderDetails.amount,
              currency: orderDetails.currency,
              name: 'Surabhi Loyalty',
              description: 'Order Payment',
              order_id: orderDetails.id,
              handler: async function (response: any) {
                  // Verify Payment
                  try {
                      const verifyRes = await verifyRazorpayPaymentFn({
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_signature: response.razorpay_signature
                      });

                      if ((verifyRes.data as any).success) {
                          // Payment Success - Create Order in DB
                          const orderData = {
                              items: cart,
                              totalAmount: amount,
                              shippingAddress: formData,
                              paymentMethod: 'online',
                              paymentStatus: 'paid',
                              paymentDetails: {
                                  razorpay_order_id: response.razorpay_order_id,
                                  razorpay_payment_id: response.razorpay_payment_id
                              },
                              shippingPointsEarned: totalShippingCreditsEarned,
                              shippingPointsUsed: shippingCreditsUsed,
                              netShippingCharges: netShippingCharges,
                              surabhiCoinsEarned: surabhiCoinsEarned,
                              sevaCoinsEarned: sevaPoolEarned
                          };
                          await createOrder(orderData as any);

                          // Sales processing deferred to Admin Confirmation
                          // Coins and Referrals will be calculated when order status is set to 'confirmed'
                          
                          // Save new address if requested
                          if (saveNewAddress && user && user.id) {
                              await addAddress(user.id, formData);
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
                  }
              },
              prefill: {
                  name: formData.fullName,
                  contact: formData.mobile
              },
              theme: {
                  color: '#3399cc'
              }
          };

          const paymentObject = new (window as any).Razorpay(options);
          paymentObject.open();
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to initiate order");
    } finally {
      if (paymentMethod === 'cod') setLoading(false); // For online, loading stays until modal opens? Actually we should turn it off.
      else setLoading(false);
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
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Address Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Saved Addresses Selection */}
                <div className="mb-6 space-y-4">
                    <Label className="text-base font-semibold">Select Shipping Address</Label>
                    
                    {savedAddresses.length > 0 ? (
                        <Select 
                            value={isAddingNewAddress ? "new" : selectedAddressIndex !== null ? selectedAddressIndex.toString() : ""} 
                            onValueChange={(val) => {
                                if (val === "new") {
                                    setIsAddingNewAddress(true);
                                    setSelectedAddressIndex(null);
                                    setFormData({
                                        fullName: user ? ('customerName' in user ? user.customerName : (user as any).staffName) : '',
                                        mobile: user ? ('customerMobile' in user ? user.customerMobile : (user as any).staffMobile) : '',
                                        street: '',
                                        city: '',
                                        state: '',
                                        zipCode: '',
                                        landmark: ''
                                    } as Address);
                                } else {
                                    const idx = parseInt(val);
                                    setIsAddingNewAddress(false);
                                    setSelectedAddressIndex(idx);
                                    setFormData(savedAddresses[idx]);
                                }
                            }}
                        >
                            <SelectTrigger className="w-full h-auto py-3">
                                <SelectValue placeholder="Select an address" />
                            </SelectTrigger>
                            <SelectContent>
                                {savedAddresses.map((addr, idx) => (
                                    <SelectItem key={idx} value={idx.toString()}>
                                        <div className="flex flex-col text-left">
                                            <span className="font-semibold">{addr.fullName}</span>
                                            <span className="text-sm text-gray-500 ellipsis">{addr.street}, {addr.city}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                                <Separator className="my-2"/>
                                <SelectItem value="new">
                                    <div className="flex items-center text-primary font-medium">
                                        <Plus className="h-4 w-4 mr-2" /> Add New Address
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                         <div className="text-sm text-gray-500 italic">
                             No saved addresses found. Please enter your details below.
                         </div>
                    )}
                </div>
                
                {/* Manual Address Form - Always Visible */}
                <div className="space-y-4">                     
                    <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input 
                                    required 
                                    value={formData.fullName} 
                                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Mobile Number</Label>
                                <Input 
                                    required 
                                    type="tel"
                                    value={formData.mobile} 
                                    onChange={e => setFormData({...formData, mobile: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Street Address</Label>
                            <Input 
                                required 
                                value={formData.street} 
                                onChange={e => setFormData({...formData, street: e.target.value})} 
                                placeholder="House No, Street Name"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>City</Label>
                                <Input 
                                    required 
                                    value={formData.city} 
                                    onChange={e => setFormData({...formData, city: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>State</Label>
                                <Select 
                                    value={formData.state} 
                                    onValueChange={val => setFormData({...formData, state: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select State" />
                                    </SelectTrigger>
                                    <SelectContent className="h-64">
                                        {INDIAN_STATES.map(state => (
                                            <SelectItem key={state} value={state}>{state}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Pincode</Label>
                                <Input 
                                    required 
                                    value={formData.zipCode} 
                                    onChange={e => setFormData({...formData, zipCode: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Landmark (Optional)</Label>
                                <Input 
                                    value={formData.landmark} 
                                    onChange={e => setFormData({...formData, landmark: e.target.value})} 
                                />
                            </div>
                        </div>
                        
                        {/* Option to save address */}
                        {(isAddingNewAddress || savedAddresses.length === 0) && user && 'role' in user && (user as any).role === 'customer' && (
                            <div className="flex items-center space-x-2 pt-2">
                                <input 
                                    type="checkbox" 
                                    id="save-address" 
                                    checked={saveNewAddress}
                                    onChange={(e) => setSaveNewAddress(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="save-address" className="font-normal text-sm cursor-pointer">
                                    Save this address for future use
                                </Label>
                            </div>
                        )}

                    </form>
                </div>
              </CardContent>
            </Card>

               <Card>
                   <CardHeader>
                       <CardTitle>Payment Method</CardTitle>
                   </CardHeader>
                   <CardContent>
                       {/* <div className="flex gap-4">
                           <Button 
                                type="button" 
                                variant={paymentMethod === 'cod' ? 'default' : 'outline'}
                                onClick={() => setPaymentMethod('cod')}
                                className="flex-1"
                           >
                               Cash on Delivery
                           </Button>
                           <Button 
                                type="button" 
                                variant={paymentMethod === 'online' ? 'default' : 'outline'}
                                onClick={() => setPaymentMethod('online')}
                                className="flex-1"
                           >
                               Online Payment (Razorpay)
                           </Button>
                       </div> */}
                       
                       <div className="mt-8 pt-6 border-t">
                           <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 md:p-6 shadow-sm">
                               <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
                                   <div className="relative group shrink-0">
                                       <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                                       <div className="relative bg-white p-3 rounded-xl shadow-lg border border-white">
                                           <img 
                                               src="/qr.jpeg" 
                                               alt="Payment QR Code" 
                                               className="h-48 w-48 md:h-56 md:w-56 object-contain rounded-lg" 
                                               onError={(e) => {
                                                   e.currentTarget.src = 'https://placehold.co/320x320?text=QR+Code+Not+Found';
                                               }}
                                           />
                                       </div>
                                       <div className="mt-3 flex flex-col items-center">
                                           <p className="text-center text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full">Scan to Pay</p>
                                           
                                       </div>
                                   </div>
                                   
                                   <div className="flex-1 space-y-6 w-full">
                                       <div>
                                           <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                               Scan & Pay via UPI
                                               <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Fastest</span>
                                           </h3>
                                           <p className="text-sm text-slate-600">Confirm instantly for faster shipping.</p>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                           {/* UPI ID Card */}
                                           <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                               <div className="flex justify-between items-center relative z-10">
                                                   <div>
                                                       <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mb-0.5">UPI ID</p>
                                                       <p className="font-mono text-sm font-bold text-slate-800 break-all">sustainablekgv@okicici</p>
                                                   </div>
                                                   <Button 
                                                       variant="secondary" 
                                                       size="sm"
                                                       onClick={() => handleCopy('sustainablekgv@okicici', 'UPI ID')}
                                                       className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                                       title="Copy UPI ID"
                                                   >
                                                       {copiedField === 'UPI ID' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                   </Button>
                                               </div>
                                           </div>

                                           {/* WhatsApp Card */}
                                           <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                               <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                                               <div className="flex justify-between items-center relative z-10">
                                                   <div>
                                                       <p className="text-[9px] text-green-600 font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1">
                                                           <WhatsAppIcon className="h-3 w-3" /> WhatsApp screenshot
                                                       </p>
                                                       <p className="font-mono text-sm font-bold text-slate-800">
                                                            <a 
                                                                href="https://wa.me/9606979530" 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="hover:text-green-600 hover:underline transition-colors block"
                                                                title="Open in WhatsApp"
                                                            >
                                                                9606979530
                                                            </a>
                                                       </p>
                                                   </div>
                                                   <Button 
                                                       variant="secondary" 
                                                       size="sm"
                                                       onClick={() => handleCopy('9606979530', 'WhatsApp number')}
                                                       className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                                                       title="Copy WhatsApp Number"
                                                   >
                                                       {copiedField === 'WhatsApp number' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                   </Button>
                                               </div>
                                           </div>
                                       </div>

                                       <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-indigo-100/50">
                                           <p className="font-bold text-[11px] text-slate-800 mb-2 uppercase tracking-widest">
                                               
                                               Instructions:
                                           </p>
                                           <ul className="space-y-1.5">
                                               <li className="flex gap-2 items-start">
                                                   <span className="flex-shrink-0 h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                                                   <span className="text-xs text-slate-700">Scan the QR code or copy the UPI ID to pay <strong className="text-slate-900 font-bold">₹{subtotal + shippingCost}</strong>.</span>
                                               </li>
                                               <li className="flex gap-2 items-start">
                                                   <span className="flex-shrink-0 h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                                                   <span className="text-xs text-slate-700">Take a clear screenshot of the successful transaction page.</span>
                                               </li>
                                               <li className="flex gap-2 items-start">
                                                   <span className="flex-shrink-0 h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                                                   <span className="text-xs text-slate-700">Click the copy icon for WhatsApp and send the screenshot to us.</span>
                                               </li>
                                           </ul>
                                       </div>
                                       
                                       {/* {paymentMethod === 'cod' && (
                                           <div className="flex items-center gap-3 text-sm font-bold text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-inner animate-in fade-in slide-in-from-top-2 duration-500">
                                               <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">!</div>
                                               <span>Pro-tip: Pay now via UPI to skip cash handling on delivery and get priority shipping!</span>
                                           </div>
                                       )} */}
                                   </div>
                               </div>
                           </div>
                       </div>
                   </CardContent>
               </Card>
           </div>

            {/* Order Summary */}
           <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Table Breakdown */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-slate-500 uppercase font-bold border-b">
                                    <tr>
                                        <th className="py-2">Items</th>
                                        <th className="py-2 text-center">Qty</th>
                                        <th className="py-2 text-center">SPV</th>
                                        <th className="py-2 text-center">Rate</th>
                                        <th className="py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {cart.map(item => (
                                        <tr key={item.productId}>
                                            <td className="py-3 font-medium text-slate-900 max-w-[120px] truncate">{item.name}</td>
                                            <td className="py-3 text-center">{item.quantity}</td>
                                            <td className="py-3 text-center text-purple-600 font-bold">{item.spv * item.quantity}</td>
                                            <td className="py-3 text-center">₹{item.price}</td>
                                            <td className="py-3 text-right font-bold text-slate-900">₹{item.price * item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Separator />
                        
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm text-slate-900">Delivery Distribution Breakdown</h4>
                            {Object.entries(productsByGroup).map(([groupKey, data]) => (
                               <div key={groupKey} className="bg-slate-50/50 p-3 rounded-xl space-y-2 border border-slate-100">
                                <div className="flex justify-between items-center">
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-slate-900 text-sm">{data.brandName}</span>
                                    <span className="text-[10px] text-slate-500 font-medium tracking-tight">Ships from: {data.originName} (Zone {data.originZone})</span>
                                  </div>
                                  <span className="text-sm font-bold text-slate-900">₹{data.shipping}</span>
                                </div>
                                
                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                  <span className="text-slate-500 uppercase tracking-tighter">Bracket: {getWeightBracketLabel(data.displayWeight)}</span>
                                  <span className="text-indigo-600 uppercase tracking-tighter">Total: {data.displayWeight.toFixed(2)} kg</span>
                                  <span className="text-purple-600 uppercase tracking-tighter">Credits: +{data.shippingCreditsEarned.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                         </div>

                         <Separator />
                         
                         {/* Shipping Credits Usage Section */}
                         {maxShippingCreditsAvailable > 0 && (
                             <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                                 <div className="flex justify-between items-center">
                                     <Label className="text-xs font-bold text-blue-900 uppercase tracking-wider">Use Shipping Credits</Label>
                                     <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Avail: {maxShippingCreditsAvailable.toFixed(2)}</span>
                                 </div>
                                 <div className="flex gap-2">
                                     <Input 
                                        type="number"
                                        max={Math.min(maxShippingCreditsAvailable, shippingCost)}
                                        value={shippingCreditsUsed}
                                        onChange={(e) => {
                                            const val = Math.min(Number(e.target.value), maxShippingCreditsAvailable, shippingCost);
                                            setShippingCreditsUsed(val);
                                        }}
                                        className="h-9 text-sm font-bold"
                                        placeholder="0.00"
                                     />
                                     <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        className="h-9 px-3 text-xs font-bold uppercase"
                                        onClick={() => setShippingCreditsUsed(Math.min(maxShippingCreditsAvailable, shippingCost))}
                                     >
                                         Max
                                     </Button>
                                 </div>
                                 <p className="text-[10px] text-blue-600 font-medium">* Credits applied to reduce shipping cost.</p>
                             </div>
                         )}

                         <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                             <div className="flex justify-between text-sm font-medium">
                                 <span className="text-slate-500">Subtotal</span>
                                 <span className="text-slate-900">₹{subtotal}</span>
                             </div>
                             <div className="flex justify-between text-sm font-medium">
                                 <span className="text-slate-500 text-xs">Total Shipping</span>
                                 <span className="text-slate-900">₹{shippingCost}</span>
                             </div>
                             {shippingCreditsUsed > 0 && (
                                 <div className="flex justify-between text-sm font-bold text-green-600 border-t border-dashed border-green-200 pt-1">
                                     <span className="text-xs">Shipping Credits Used</span>
                                     <span>-₹{shippingCreditsUsed.toFixed(2)}</span>
                                 </div>
                             )}
                             <div className="flex justify-between text-sm font-bold text-slate-900 border-t pt-2 mt-2">
                                 <span className="text-slate-500 text-xs uppercase">Net Shipping Charges</span>
                                 <span>₹{Math.max(0, shippingCost - shippingCreditsUsed).toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between font-extrabold text-xl text-slate-900 pt-4 mt-2 border-t-2 border-slate-900">
                                <span>Net Payable</span>
                                <span>₹{(subtotal + Math.max(0, shippingCost - shippingCreditsUsed)).toFixed(2)}</span>
                            </div>
                         </div>

                        {/* Rewards Section */}
                        <div className="bg-indigo-600 text-white rounded-2xl p-5 space-y-4 shadow-xl shadow-indigo-100">
                            <h4 className="font-extrabold text-sm uppercase tracking-widest border-b border-indigo-500 pb-2">Rewards earned On Order</h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-indigo-300"></div>
                                        <span className="text-xs font-medium text-indigo-100">Shipping Credits</span>
                                    </div>
                                    <span className="font-bold text-sm tracking-tight">+{totalShippingCreditsEarned.toFixed(2)} pts</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-indigo-300"></div>
                                        <span className="text-xs font-medium text-indigo-100">Surabhi Coins Earned</span>
                                    </div>
                                    <span className="font-bold text-sm tracking-tight">+{surabhiCoinsEarned} pts</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-indigo-300"></div>
                                        <span className="text-xs font-medium text-indigo-100">Go Seva Pool Contribution</span>
                                    </div>
                                    <span className="font-bold text-sm tracking-tight">+{sevaPoolEarned} pts</span>
                                </div>
                            </div>
                            <div className="bg-indigo-500/30 rounded-lg p-2.5 text-[10px] font-medium text-indigo-100 flex items-center gap-2 border border-indigo-400/20">
                                <ShoppingCart className="h-3 w-3" />
                                <span>Total Sales Point Value (SPV): {totalSpv}</span>
                            </div>
                        </div>

                        <Button 
                            className="w-full h-14 rounded-xl text-base font-extrabold uppercase tracking-widest shadow-lg shadow-primary/20 
                                     bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all active:scale-[0.98]" 
                            size="lg" 
                            type="submit" 
                            form="checkout-form"
                            disabled={loading}
                        >
                            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Place Order Now
                        </Button>
                        <p className="text-[10px] text-center text-gray-500 font-medium">
                           Secured by end-to-end encrypted payment processing.
                        </p>
                    </CardContent>
                </Card>
           </div>
        </div>
      </div>
    </ShopLayout>
  );
};

export default CheckoutPage;
