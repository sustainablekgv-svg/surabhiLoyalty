import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBrands } from '@/services/shop';
import { getShippingConfig } from '@/services/shipping';

const CartPage = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useShop();
  const navigate = useNavigate();
  const [brandsMap, setBrandsMap] = useState<Record<string, any>>({});
  const [shippingRates, setShippingRates] = useState<any>(null);
 useEffect(() => {
  const loadShippingConfig = async () => {
    try {
      const config = await getShippingConfig();
      setShippingRates(config);
    } catch (error) {
      console.error("Failed to load shipping config", error);
    }
  };

  loadShippingConfig();
}, []);
const calculateShippingCharge = (
  weight: number,
  rates: any
) => {
  if (!rates) return 0;

  const table = rates.rateTable?.A;
  const extra = rates.extraPerKg?.A;

  if (!table) return 0;

  if (weight <= 0.5) return table[0];
  if (weight <= 1) return table[1];
  if (weight <= 2) return table[2];
  if (weight <= 3) return table[3];
  if (weight <= 5) return table[4];

  return (
    table[4] +
    Math.ceil(weight - 5) * extra
  );
};
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brands = await getBrands();

        const map: Record<string, any> = {};

        brands.forEach((brand) => {
          map[brand.id] = brand;
        });

        setBrandsMap(map);
      } catch (error) {
        console.error("Error loading brands", error);
      }
    };

    loadBrands();
  }, []);
  const groupedBrands = cart.reduce((acc, item) => {
    
  const brand = item.brandName || 'Other Brand';

  if (!acc[brand]) {
    acc[brand] = [];
  }

  acc[brand].push(item);

  return acc;
}, {} as Record<string, typeof cart>);
console.log("shippingRates", shippingRates);
const totalShipping = Object.values(groupedBrands).reduce(
  (total, products) => {
    const totalWeight = products.reduce(
      (sum, item) =>
        sum +
        ((Number(item.weightInKg || item.weight || 0) || 0) *
          item.quantity),
      0
    );

    const deliveryCharge = calculateShippingCharge(
  totalWeight,
  shippingRates
);

return total + deliveryCharge;
  },
  0
);

const grandTotal = cartTotal + totalShipping;

  return (
    <ShopLayout title="Shopping Cart" onBack={() => navigate('/shop')}>
    <div>{cart.length > 0 && (
  <div className="mb-6">
  <div className="flex justify-center">
    <div className="inline-flex flex-col items-center rounded-2xl bg-gradient-to-r from-purple-400 via-violet-400 to-orange-400 px-8 py-6 text-white shadow-lg text-center">

      <h2 className="text-xl md:text-3xl font-bold mb-4">
        🚚 Your Purchase Supports {Object.keys(groupedBrands).length} brands to become Sustainable
      </h2>
      <p className="inline-flex items-center rounded-full bg-yellow-400 text-slate-900 px-5 py-2 text-[16px] md:text-[18px] font-bold shadow-lg mb-4">
  🚚 Total of {Object.keys(groupedBrands).length} shipments will be delivered to your location.
</p>
      
<p className="text-[14px] text-white/80 mt-2 max-w-2xl leading-relaxed">
  Delivery charges shown are estimated. Final shipping charges will be calculated after packing based on actual weight, and any difference will be automatically adjusted in your shipping wallet as a credit or debit.
</p>
    </div>
  </div>
</div>
)}</div>
      <div className="max-w-4xl mx-auto py-4">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-4">Your cart is empty</h2>
            <Button onClick={() => navigate('/shop')}>Continue Shopping</Button>
            
          </div>
        ) : (
          <>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              {Object.entries(groupedBrands).map(([brandName, products]) => (
  <div
    key={brandName}
    className="overflow-hidden rounded-2xl border bg-white shadow-md"
  >
    {/* Brand Ribbon */}

  {(() => {
    const totalWeight = products.reduce(
      (sum, item) =>
        sum +
        ((Number(item.weightInKg || item.weight || 0) || 0) *
          item.quantity),
      0
    );
    
    const totalProductAmount = products.reduce(
  (total, item) => total + (item.price * item.quantity),
  0
);

    const deliveryCharge = calculateShippingCharge(
  totalWeight,
  shippingRates
);
  

    return (
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200">
  <div className="rounded-2xl p-5 border border-white/30 shadow-lg bg-gradient-to-r from-purple-400 via-pink-300 to-orange-300 backdrop-blur-sm">

    <div className="text-xs uppercase tracking-wider text-white-500 font-semibold mb-4 bg-orange">
      Sold & Shipped By
    </div>

    <div className="flex items-start gap-4">

      <div className="h-14 w-14 w-min-[56px] rounded-xl bg-white border overflow-hidden flex items-center justify-center shrink-0">

  {brandsMap[products[0]?.brandId]?.logo ? (
  <img
    src={brandsMap[products[0].brandId].logo}
    alt={brandName}
    className="h-full w-full object-contain p-1"
  />
) : (
  <span className="text-lg font-bold text-gray-400">
    {brandName?.charAt(0)}
  </span>
)}

</div>

      <div className="flex-1">

        <h3 className="text-lg md:text-xl font-bold text-slate-900">
          {brandName}
        </h3>

        <div className="mt-1 flex items-center gap-2 text-grey">
          <span>📍</span>

          <span>
            {(products[0]?.placeOfOrigin || []).join(', ') || 'India'}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">

          <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 px-3 py-1 text-sm font-medium">
            📦 {products.length} {products.length === 1 ? 'Product' : 'Products'}
          </span>
           <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-sm font-medium">
  💰 ₹{totalProductAmount.toLocaleString()}
</span>

          <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm font-medium">
            ⚖️ {totalWeight.toFixed(2)} Kg
          </span>

          <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-3 py-1 text-sm font-medium">
            🚚 ₹{deliveryCharge} Delivery
          </span>

        </div>

      </div>

    </div>

  </div>
  </div>
);
  })()}


    {/* Products */}
    <div className="p-3 space-y-3">
      {products.map((item) => (
        <div
          key={item.productId}
          className="flex gap-3 md:gap-4 p-3 md:p-4 bg-white rounded-lg border relative"
        >
          <div
            className="h-20 w-20 md:h-24 md:w-24 bg-white rounded-md overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center border"
            onClick={() =>
              navigate(`/shop/product/${item.slug || item.productId}`, {
                state: { from: '/shop/cart' },
              })
            }
          >
            {isValidImageUrl(item.image) ? (
              <img
                src={item.image}
                alt={item.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400 text-xs">
                No Img
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div className="pr-8">
              <h3
                className="font-medium text-base md:text-lg cursor-pointer hover:underline line-clamp-2"
                onClick={() =>
                  navigate(`/shop/product/${item.slug || item.productId}`)
                }
              >
                {item.name}- {item.productQuantity}
      {item.unitsOfMeasure}
      
      
              </h3>

              <div className="flex flex-wrap gap-2 mt-1">
               
                  {(item.weightInKg || item.weight) && (
  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
    ⚖️ {Number(item.weightInKg || item.weight).toFixed(2)} Kg × {item.quantity}
    = {(Number(item.weightInKg || item.weight) * item.quantity).toFixed(2)} Kg
  </span>
)}
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-col gap-1">

  



  {/* Total Price */}
  <div className="flex items-center gap-2">
    <span className="font-bold text-2xl">
      ₹{(item.price * item.quantity).toFixed(2)}
    </span>

    {item.originalPrice &&
      item.originalPrice > item.price && (
        <span className="text-xs text-gray-400 line-through">
          ₹{item.originalPrice}
        </span>
      )}
  </div>

  {/* Price Calculation */}
  <div className="text-[11px] text-slate-500">
    ₹{item.price} × {item.quantity}
    = ₹{(item.price * item.quantity).toFixed(2)}
  </div>

  {/* SPV */}
  {item.spv > 0 && (
    <div className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded-full w-fit">
      SPV: {(item.spv * item.quantity).toFixed(0)}
    </div>
  )}

</div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 md:h-8 md:w-8"
                  onClick={() =>
                    updateQuantity(
                      item.productId,
                      item.quantity - 1
                    )
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <span className="w-6 md:w-8 text-center text-sm">
                  {item.quantity}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 md:h-8 md:w-8"
                  onClick={() =>
                    updateQuantity(
                      item.productId,
                      item.quantity + 1
                    )
                  }
                  disabled={item.quantity >= item.maxStock}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 absolute top-2 right-2 md:static"
            onClick={() =>
              removeFromCart(item.productId)
            }
          >
            <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      ))}
    </div>
  </div>
))}
            </div>
            
            <div className="md:col-span-1">
                <div className="bg-white p-6 rounded-lg shadow-sm border sticky top-24">
                    <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
                    <div className="space-y-3 mb-4">

  <div className="flex justify-between">
    <span className="text-gray-600">Subtotal</span>
    <span>₹{cartTotal}</span>
  </div>

  <div className="flex justify-between">
    <span className="text-gray-600">
      Shipping ({Object.keys(groupedBrands).length} Brands)
    </span>
    <span className="text-green-600 font-medium">
      ₹{totalShipping}
    </span>
  </div>

</div>

<div className="border-t pt-4 mb-6">
  <div className="flex justify-between font-bold text-xl">
    <span>Total</span>
    <span>₹{grandTotal}</span>
  </div>
</div>
                    <div className="border-t pt-4 mb-6">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>₹{grandTotal}</span>
                        </div>
                    </div>
                    <Button className="w-full text-lg py-6" onClick={() => navigate('/shop/checkout')}>Proceed to Checkout</Button>
                </div>
            </div>
          </div>
          </>
        )}
      </div>
    </ShopLayout>
  );
};

export default CartPage;
