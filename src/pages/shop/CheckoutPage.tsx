import { Footer } from '@/components/shop/Footer';
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
import { calculateShippingCost, getZoneForState, INDIAN_STATES, parseWeightToKg } from '@/services/shipping';
import { Address, CartItem } from '@/types/shop';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowLeft, Check, Copy, Loader2, Plus, ShoppingCart, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
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

  const [shippingCost, setShippingCost] = useState(0);
  const [shippingConfig, setShippingConfig] = useState<any>(null);
  const [originsList, setOriginsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchConfigAndOrigins = async () => {
      const { getShippingConfig } = await import('@/services/shipping');
      const [config, originsSnap] = await Promise.all([
        getShippingConfig(),
        getDocs(collection(db, 'origins'))
      ]);
      setShippingConfig(config);
      setOriginsList(originsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchConfigAndOrigins();
  }, []);


  // Calculate totals by brand + origin for breakdown
  const productsByGroup = cart.reduce((acc, item) => {
    const brandName = item.brandName || 'Other';
    const originName = (item.placeOfOrigin && item.placeOfOrigin.length > 0) ? item.placeOfOrigin[0] : 'Unknown';
    const groupKey = `${brandName}|${originName}`;

    if (!acc[groupKey]) {
      acc[groupKey] = {
        brandName,
        originName,
        items: [],
        weight: 0,
        shipping: 0,
        originZone: originsList.find(o => o.name === originName)?.zone || 'A'
      };
    }
    acc[groupKey].items.push(item);
    
    if (!item.freeShipping) {
      const weight = item.weightInKg || parseWeightToKg(item.weight || '0.5kg');
      acc[groupKey].weight += (weight * item.quantity);
    }
    return acc;
  }, {} as Record<string, { brandName: string, originName: string, items: CartItem[], weight: number, shipping: number, originZone: string }>);

  const totalWeight = Object.values(productsByGroup).reduce((sum, b) => sum + b.weight, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Re-calculate shipping when state or groupings change
  useEffect(() => {
    if (formData.state && originsList.length > 0) {
        let totalCost = 0;
        Object.keys(productsByGroup).forEach(groupKey => {
          const groupData = productsByGroup[groupKey];
          if (groupData.weight > 0) {
            const cost = calculateShippingCost(
                groupData.weight, 
                groupData.originZone, 
                formData.state, 
                shippingConfig || undefined
            );
            groupData.shipping = cost;
            totalCost += cost;
          }
        });
        setShippingCost(totalCost);
    }
  }, [formData.state, JSON.stringify(productsByGroup), shippingConfig, originsList]);

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

  // Calculate total SPV
  const totalSpv = cart.reduce((sum, item) => sum + ((item.spv || item.price) * item.quantity), 0);

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
          const orderData = {
              items: cart,
              totalAmount: subtotal + shippingCost,
              shippingAddress: formData,
              paymentMethod: 'cod',
              paymentStatus: 'pending'
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

          const amount = subtotal + shippingCost;
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
                              }
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
    <div className="min-h-screen flex flex-col bg-gray-50/50">
    <div className="container mx-auto p-4 py-8 max-w-6xl flex-1">   
       <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold">Checkout</h1>
       </div>
       
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
                                                       <p className="text-[9px] text-green-600 font-bold uppercase tracking-widest mb-0.5">WhatsApp screenshot</p>
                                                       <p className="font-mono text-sm font-bold text-slate-800">9606979530</p>
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
                    <CardContent className="space-y-4">
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {cart.map(item => (
                                <div key={item.productId} className="flex justify-between text-sm">
                                    <span className="truncate max-w-[180px]">{item.name} x {item.quantity}</span>
                                    <span>₹{item.price * item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <Separator />
                        
                         <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Delivery Price Breakdown</h4>
                            {Object.entries(productsByGroup).map(([groupKey, data]) => (
                               <div key={groupKey} className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-100">
                                <div className="flex justify-between items-center">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{data.brandName}</span>
                                    <span className="text-[10px] text-slate-500">Ships from: {data.originName} (Zone {data.originZone})</span>
                                  </div>
                                  <span className="text-sm font-medium">₹{data.shipping}</span>
                                </div>
                                <div className="space-y-1">
                                  {data.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                                      <span className="font-medium truncate max-w-[140px]">{item.name}</span>
                                      <span>x{item.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="text-[10px] text-slate-400 text-right">
                                  Weight: {data.weight.toFixed(2)} kg
                                </div>
                              </div>
                            ))}
                         </div>
                         <Separator />
                         
                         <div className="space-y-1.5">
                             <div className="flex justify-between text-sm">
                                 <span className="text-muted-foreground">Subtotal</span>
                                 <span>₹{subtotal}</span>
                             </div>
                              <div className="flex justify-between text-sm">
                                 <span className="text-muted-foreground">Total Weight</span>
                                 <span>{totalWeight.toFixed(2)} kg</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="text-muted-foreground">Total Shipping ({formData.state ? `Zone ${getZoneForState(formData.state)}` : '-'})</span>
                                 <span className={shippingCost === 0 ? "text-orange-500" : ""}>
                                     {shippingCost === 0 && !formData.state ? 'Select State' : `₹${shippingCost}`}
                                 </span>
                             </div>
                         </div>

                        <Separator />
                        
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>₹{subtotal + shippingCost}</span>
                        </div>

                        <Button 
                            className="w-full mt-4" 
                            size="lg" 
                            type="submit" 
                            form="checkout-form"
                            disabled={loading}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Place Order
                        </Button>
                        <p className="text-xs text-center text-gray-500 mt-2">
                           * Shipping calculated based on weight and destination zone.
                        </p>
                    </CardContent>
                </Card>
           </div>
       </div>
    </div>
    <Footer />
    </div>
  );
};


export default CheckoutPage;
