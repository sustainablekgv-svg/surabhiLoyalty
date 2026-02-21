import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CartPage = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useShop();
  const navigate = useNavigate();

  return (
    <ShopLayout title="Surabhi" showBack={false}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shop/filters')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
        </div>
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-4">Your cart is empty</h2>
            <Button onClick={() => navigate('/shop')}>Continue Shopping</Button>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              {cart.map((item) => (

                <div key={item.productId} className="flex gap-3 md:gap-4 p-3 md:p-4 bg-white rounded-lg shadow-sm border relative">
                  <div className="h-20 w-20 md:h-24 md:w-24 bg-white rounded-md overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center border" onClick={() => navigate(`/shop/product/${item.productId}`)}>
                    {isValidImageUrl(item.image) ? (
                      <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400 text-xs">No Img</div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="pr-8">
                      <h3 className="font-medium text-base md:text-lg cursor-pointer hover:underline line-clamp-2" onClick={() => navigate(`/shop/product/${item.productId}`)}>{item.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {item.brandName && (
                          <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">{item.brandName}</span>
                        )}
                        {item.placeOfOrigin && item.placeOfOrigin.length > 0 && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Origin: {item.placeOfOrigin.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                            <div className="font-bold text-sm md:text-base">₹{item.price}</div>
                            {item.spv > 0 && (
                                <div className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded-full w-fit">
                                    SPV: {item.spv * item.quantity}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-7 w-7 md:h-8 md:w-8" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 md:w-8 text-center text-sm">{item.quantity}</span>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7 md:h-8 md:w-8" 
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxStock}
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 absolute top-2 right-2 md:static md:text-red-500" onClick={() => removeFromCart(item.productId)}>
                    <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
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
