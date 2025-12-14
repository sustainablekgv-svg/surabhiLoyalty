import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CartPage = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useShop();
  const navigate = useNavigate();

  return (
    <ShopLayout title="Shopping Cart">
      <div className="max-w-4xl mx-auto">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-4">Your cart is empty</h2>
            <Button onClick={() => navigate('/shop')}>Continue Shopping</Button>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              {cart.map((item) => (

                <div key={item.productId} className="flex gap-4 p-4 bg-white rounded-lg shadow-sm border">
                  <div className="h-24 w-24 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => navigate(`/shop/product/${item.productId}`)}>
                    {isValidImageUrl(item.image) ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">No Img</div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-lg cursor-pointer hover:underline" onClick={() => navigate(`/shop/product/${item.productId}`)}>{item.name}</h3>
                      {/* item.product.brand is no longer available directly unless we fetch it or store it. Removing for now or we could store brand too */}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="font-bold">₹{item.price}</div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeFromCart(item.productId)}>
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="md:col-span-1">
                <div className="bg-white p-6 rounded-lg shadow-sm border sticky top-24">
                    <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal</span>
                            <span>₹{cartTotal}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Shipping</span>
                            <span className="text-muted-foreground text-sm">Calculated at checkout</span>
                        </div>
                    </div>
                    <div className="border-t pt-4 mb-6">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>₹{cartTotal}</span>
                        </div>
                    </div>
                    <Button className="w-full text-lg py-6" onClick={() => navigate('/shop/checkout')}>Proceed to Checkout</Button>
                </div>
            </div>
          </div>
        )}
      </div>
    </ShopLayout>
  );
};

export default CartPage;
