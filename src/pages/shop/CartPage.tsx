import { ShopLayout } from '@/components/shop/ShopLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { getShippingConfig } from '@/services/shipping';
import { getBrands } from '@/services/shop';
import {
  ArrowRight,
  ChevronRight,
  Info,
  MapPin,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
        console.error('Failed to load shipping config', error);
      }
    };

    loadShippingConfig();
  }, []);

  const calculateShippingCharge = (weight: number, rates: any) => {
    if (!rates) return 0;
    const table = rates.rateTable?.A;
    const extra = rates.extraPerKg?.A;
    if (!table) return 0;

    if (weight <= 0.5) return table[0];
    if (weight <= 1) return table[1];
    if (weight <= 2) return table[2];
    if (weight <= 3) return table[3];
    if (weight <= 5) return table[4];

    return table[4] + Math.ceil(weight - 5) * (extra || 0);
  };

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brands = await getBrands();
        const map: Record<string, any> = {};
        brands.forEach(brand => {
          map[brand.id] = brand;
        });
        setBrandsMap(map);
      } catch (error) {
        console.error('Error loading brands', error);
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

  const totalShipping = Object.values(groupedBrands).reduce((total, products) => {
    const totalWeight = products.reduce(
      (sum, item) => sum + (Number(item.weightInKg || item.weight || 0) || 0) * item.quantity,
      0
    );
    const deliveryCharge = calculateShippingCharge(totalWeight, shippingRates);
    return total + deliveryCharge;
  }, 0);

  const totalSpv = cart.reduce(
    (sum, item) => sum + (Number(item.spv) || 0) * item.quantity,
    0
  );

  const grandTotal = cartTotal + totalShipping;
  const brandCount = Object.keys(groupedBrands).length;

  return (
    <ShopLayout title="Shopping Cart" onBack={() => navigate('/shop')}>
      <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-3 md:py-6">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="h-20 w-20 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
              <ShoppingCart className="h-10 w-10 text-slate-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              Your cart is empty
            </h2>
            <p className="text-slate-500 mb-8 max-w-md text-sm md:text-base leading-relaxed">
              Looks like you haven't added anything to your cart yet. Discover organic, farm-fresh,
              and sustainable products in our shop.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/shop')}
              className="rounded-full px-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Explore Products
            </Button>
          </div>
        ) : (
          <>
            {/* Sustainability & Multi-brand Delivery Card */}
            <div className="mb-6 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/50 p-5 md:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-11 w-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      Sustainable Direct-from-Farm Delivery
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      Your purchase directly supports{' '}
                      <span className="font-semibold text-emerald-800">
                        {brandCount} artisanal brand{brandCount > 1 ? 's' : ''}
                      </span>
                      . Items are shipped directly from origin farms and makers for peak freshness.
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full bg-white border border-emerald-200/80 px-3.5 py-1.5 shadow-xs text-xs font-semibold text-slate-800 shrink-0">
                  <Package className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {brandCount} direct shipment{brandCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-emerald-100/70 flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                <Info className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  Delivery charges are estimated based on package weight. Final weight adjustments are
                  automatically credited or debited to your shipping wallet upon dispatch.
                </span>
              </div>
            </div>

            {/* Layout Grid: 2/3 Cart Items + 1/3 Summary */}
            <div className="grid gap-6 lg:grid-cols-3 items-start">
              {/* Left Column: Grouped by Brand */}
              <div className="lg:col-span-2 space-y-6">
                {Object.entries(groupedBrands).map(([brandName, products]) => {
                  const totalWeight = products.reduce(
                    (sum, item) =>
                      sum + (Number(item.weightInKg || item.weight || 0) || 0) * item.quantity,
                    0
                  );

                  const totalProductAmount = products.reduce(
                    (total, item) => total + item.price * item.quantity,
                    0
                  );

                  const deliveryCharge = calculateShippingCharge(totalWeight, shippingRates);
                  const brandLogo = brandsMap[products[0]?.brandId]?.logo;
                  const originPlace = (products[0]?.placeOfOrigin || []).join(', ') || 'India';

                  return (
                    <Card
                      key={brandName}
                      className="border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden"
                    >
                      {/* Brand Group Header */}
                      <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                              {brandLogo ? (
                                <img
                                  src={brandLogo}
                                  alt={brandName}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-base font-bold text-slate-500">
                                  {brandName?.charAt(0)}
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Sold & Shipped By
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                                {brandName}
                              </h3>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                <span>{originPlace}</span>
                              </div>
                            </div>
                          </div>

                          {/* Brand Meta Tags */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <Badge
                              variant="outline"
                              className="bg-white text-slate-700 border-slate-200 font-medium text-[11px] py-0.5"
                            >
                              <Package className="h-3 w-3 mr-1 text-slate-400" />
                              {products.length} {products.length === 1 ? 'item' : 'items'}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-slate-50 text-slate-700 border-slate-200 font-medium text-[11px] py-0.5"
                            >
                              <Scale className="h-3 w-3 mr-1 text-slate-500" />
                              {totalWeight.toFixed(2)} Kg
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold text-[11px] py-0.5"
                            >
                              <Truck className="h-3 w-3 mr-1 text-emerald-600" />₹{deliveryCharge}{' '}
                              delivery
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-emerald-50/50 text-emerald-800 border-emerald-200/60 font-bold text-[11px] py-0.5"
                            >
                              ₹{totalProductAmount.toLocaleString()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      {/* Product Items List */}
                      <CardContent className="p-0 divide-y divide-slate-100">
                        {products.map(item => {
                          const itemWeight = Number(item.weightInKg || item.weight || 0);
                          const totalLineWeight = itemWeight * item.quantity;

                          return (
                            <div
                              key={item.productId}
                              className="p-4 sm:p-5 flex gap-3.5 sm:gap-4 items-start sm:items-center justify-between hover:bg-slate-50/50 transition-colors"
                            >
                              {/* Product Thumbnail */}
                              <div
                                className="h-20 w-20 sm:h-22 sm:w-22 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden group"
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
                                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-slate-400 text-xs font-medium">
                                    No Image
                                  </div>
                                )}
                              </div>

                              {/* Product Details */}
                              <div className="flex-1 min-w-0 pr-2">
                                <h4
                                  className="font-semibold text-sm sm:text-base text-slate-900 cursor-pointer hover:text-emerald-700 transition-colors line-clamp-2 leading-snug"
                                  onClick={() =>
                                    navigate(`/shop/product/${item.slug || item.productId}`, {
                                      state: { from: '/shop/cart' },
                                    })
                                  }
                                >
                                  {item.name}
                                  {item.productQuantity && (
                                    <span className="text-slate-500 font-normal">
                                      {' '}
                                      — {item.productQuantity} {item.unitsOfMeasure || ''}
                                    </span>
                                  )}
                                </h4>

                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  {itemWeight > 0 && (
                                    <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                                      <Scale className="h-3 w-3 mr-1 text-slate-400" />
                                      {itemWeight.toFixed(2)} Kg × {item.quantity} ={' '}
                                      {totalLineWeight.toFixed(2)} Kg
                                    </span>
                                  )}

                                  {item.spv > 0 && (
                                    <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-md px-2 py-0.5">
                                      SPV: {(item.spv * item.quantity).toFixed(0)}
                                    </span>
                                  )}
                                </div>

                                {/* Price block */}
                                <div className="flex items-baseline gap-2 mt-2">
                                  <span className="font-bold text-base sm:text-lg text-slate-900">
                                    ₹{(item.price * item.quantity).toLocaleString()}
                                  </span>
                                  {item.originalPrice && item.originalPrice > item.price && (
                                    <span className="text-xs text-slate-400 line-through">
                                      ₹{(item.originalPrice * item.quantity).toLocaleString()}
                                    </span>
                                  )}
                                  {item.quantity > 1 && (
                                    <span className="text-[11px] text-slate-400">
                                      (₹{item.price} each)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity & Delete Controls */}
                              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 shrink-0">
                                <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-xs">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </Button>
                                  <span className="w-8 text-center text-xs sm:text-sm font-semibold text-slate-900">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                    disabled={item.quantity >= (item.maxStock || 999)}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => removeFromCart(item.productId)}
                                  title="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Right Column: Order Summary (Sticky Sidebar) */}
              <div className="lg:col-span-1">
                <Card className="border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden sticky top-20">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Order Summary
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal</span>
                        <span className="font-semibold text-slate-900">
                          ₹{cartTotal.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-600">
                        <span className="flex items-center gap-1">
                          Estimated Shipping
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({brandCount} {brandCount === 1 ? 'brand' : 'brands'})
                          </span>
                        </span>
                        <span className="font-semibold text-slate-900">
                          ₹{totalShipping.toLocaleString()}
                        </span>
                      </div>

                      {totalSpv > 0 && (
                        <div className="flex justify-between items-center text-xs text-amber-800 bg-amber-50/70 border border-amber-200/60 rounded-lg px-3 py-2">
                          <span className="font-medium">Total SPV Points Earnable</span>
                          <span className="font-bold">{totalSpv.toFixed(0)} SPV</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-base font-bold text-slate-900">Grand Total</span>
                        <span className="text-2xl font-black text-slate-900">
                          ₹{grandTotal.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 text-right">
                        Inclusive of all estimated taxes & delivery
                      </p>
                    </div>

                    <Button
                      size="lg"
                      className="w-full text-base py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all group"
                      onClick={() => navigate('/shop/checkout')}
                    >
                      <span>Proceed to Checkout</span>
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full text-slate-600 hover:text-slate-900 text-sm"
                      onClick={() => navigate('/shop')}
                    >
                      Continue Shopping
                    </Button>

                    <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl">
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-semibold">Note:</span> Delivery charges are estimated. Final charges will be confirmed upon dispatch based on actual packed weight, with any difference credited or debited to your wallet.
                      </p>
                    </div>

                    {/* Trust badges */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>100% Genuine, chemical-free direct farm sourcing</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <RotateCcw className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>Transparent weight adjustment guarantee</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </ShopLayout>
  );
};

export default CartPage;
