import { Footer } from '@/components/shop/Footer';
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
import { processSaleTransaction } from '@/services/sales';
import { calculateShippingCost, getZoneForState, INDIAN_STATES } from '@/services/shipping';
import { Address } from '@/types/shop';
import { CustomerType, StoreType } from '@/types/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const CheckoutPage = () => {
  const { cart, clearCart, createOrder } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  
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

  // Calculate totals
  const totalWeight = cart.reduce((sum, item) => {
      // If product has free shipping, it doesn't count towards shipping weight
      // We need to check the product data. CartItem might not have freeShipping field?
      // Wait, CartItem definition in types/shop.ts doesn't have it.
      // We need to ensure CartItem has it or we look it up.
      // Actually, better to extend CartItem or checking if we can pass it.
      // For now, assuming CartItem needs update or we blindly trust he will add it to CartItem too?
      // Let's check CartItem in types.
      // Use 'as any' for now if CartItem isn't updated yet, but I should update CartItem too.
      if (item.freeShipping) return sum;

      // Assuming 0.5kg default weight if not available
      return sum + (0.5 * item.quantity); 
  }, 0);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Re-calculate shipping when state changes
  useEffect(() => {
    if (formData.state) {
        const cost = calculateShippingCost(totalWeight, formData.state);
        setShippingCost(cost);
    }
  }, [formData.state, totalWeight]);

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
          const orderData = {
              items: cart,
              totalAmount: subtotal + shippingCost,
              shippingAddress: formData,
              paymentMethod: 'cod',
              paymentStatus: 'pending'
          };
          
          await createOrder(orderData as any); 
          
          // Save new address if requested
          if (saveNewAddress && user && user.id) {
              await addAddress(user.id, formData);
          }

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

                          // Process Sales Logic (Coins, Referrals, etc.)
                          try {
                              if (user && 'role' in user && user.role === 'customer' && user.storeLocation) {
                                  // 1. Fetch Store Details
                                  const storeQ = query(collection(db, 'stores'), where('storeName', '==', user.storeLocation));
                                  const storeSnap = await getDocs(storeQ);
                                  
                                  // 2. Fetch Latest Customer Details
                                  // We use mobile as key identifier typically
                                  const customerMobile = (user as any).customerMobile;
                                  const custQ = query(collection(db, 'Customers'), where('customerMobile', '==', customerMobile));
                                  const custSnap = await getDocs(custQ);

                                  if (!storeSnap.empty && !custSnap.empty) {
                                      const storeDetails = { id: storeSnap.docs[0].id, ...storeSnap.docs[0].data() } as StoreType;
                                      const customerDetails = { id: custSnap.docs[0].id, ...custSnap.docs[0].data() } as CustomerType;

                                      await processSaleTransaction({
                                          orderId: response.razorpay_order_id, // Use Razorpay ID as Order Ref
                                          invoiceId: response.razorpay_order_id,
                                          amount: amount,
                                          customer: customerDetails,
                                          storeDetails: storeDetails,
                                          user: user,
                                          paymentMethod: 'online',
                                          paymentDetails: {
                                              razorpay_payment_id: response.razorpay_payment_id
                                          }
                                      });
                                      toast.success("Coins earned and transaction recorded!");
                                  } else {
                                      console.error("Could not find store or customer details for sales processing");
                                  }
                              }
                          } catch (salesError) {
                              console.error("Error processing sales logic:", salesError);
                              // Don't fail the order flow, just log it. 
                              // Ideally we should have a retry mechanism or alert admin.
                              toast.warning("Order placed, but points calculation failed. Please contact support.");
                          }
                          
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
          <div className="container mx-auto p-4 py-8 text-center">
              <h1 className="text-2xl font-bold mb-4">Checkout</h1>
              <p className="text-gray-500 mb-4">Your cart is empty</p>
              <Button onClick={() => navigate('/shop')}>Go to Shop</Button>
          </div>
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
                       <div className="flex gap-4">
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
                        
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>₹{subtotal}</span>
                            </div>
                             <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Estimated Weight</span>
                                <span>{totalWeight.toFixed(2)} kg</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shipping ({formData.state ? `Zone ${getZoneForState(formData.state)}` : '-'})</span>
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
                            Place Order ({paymentMethod === 'cod' ? 'COD' : 'Online'})
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
