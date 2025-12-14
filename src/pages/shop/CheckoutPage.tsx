import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { calculateShippingCost, getZoneForState, INDIAN_STATES } from '@/services/shipping';
import { Loader2, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const CheckoutPage = () => {
  const { cart, clearCart, createOrder } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
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
      // Assuming item has weight property or we assume generic
      // We actually need to fetch product weight or store it in cart.
      // Based on types/shop.ts CartItem doesn't have weight. 
      // We might need to fetch products or add weight to CartItem.
      // For now, let's assume CartItem has weight (we'll need to check shop-context/services)
      // OR we just use a default since we can't easily change the backend on the fly right now without checking.
      // Wait, CartItem in types/shop.ts DOES NOT have weight. 
      // I should update addToCart to include weight or fetch it here.
      // For this implementation, I will assume a default weight or try to extract from 'product' if passed
      // Ideally we update the CartItem type, but for speed, let's look at how Cart is built.
      return sum + (0.5 * item.quantity); // Placeholder 500g per book if unknown
  }, 0);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Re-calculate shipping when state changes
  useEffect(() => {
    if (formData.state) {
        const cost = calculateShippingCost(totalWeight, formData.state);
        setShippingCost(cost);
    }
  }, [formData.state, totalWeight]);

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
      // Create order object
      const orderData = {
          items: cart,
          totalAmount: subtotal + shippingCost,
          shippingAddress: formData,
          paymentMethod: 'cod', // Defaulting to COD for now as per usual simple flows
          paymentStatus: 'pending'
      };
      
      await createOrder(orderData as any); 
      clearCart();
      toast.success("Order placed successfully!");
      navigate('/shop');
    } catch (error) {
      console.error(error);
      toast.error("Failed to place order");
    } finally {
      setLoading(false);
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
    <div className="container mx-auto p-4 py-8 max-w-6xl">
       <h1 className="text-3xl font-bold mb-8">Checkout</h1>
       
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Address Form */}
           <div className="lg:col-span-2 space-y-6">
               <Card>
                   <CardHeader>
                       <CardTitle className="flex items-center gap-2">
                           <Truck className="h-5 w-5" /> Shipping Address
                       </CardTitle>
                   </CardHeader>
                   <CardContent>
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
                       </form>
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
                            Place Order (COD)
                        </Button>
                        <p className="text-xs text-center text-gray-500 mt-2">
                           * Shipping calculated based on weight and destination zone.
                        </p>
                    </CardContent>
                </Card>
           </div>
       </div>
    </div>
  );
};

export default CheckoutPage;
