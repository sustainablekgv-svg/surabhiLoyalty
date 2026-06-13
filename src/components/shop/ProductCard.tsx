import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { Product } from '@/types/shop';
import {
  ChevronDown,
  Heart,
  ShoppingCart,
  Star,
  Trash2
} from 'lucide-react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'wishlist';
}

const ProductCardComponent: React.FC<ProductCardProps> = ({ product, variant = 'default' }) => {
  const { addToCart, toggleWishlist, isInWishlist } = useShop();
  const { user } = useAuth();
  const { settings } = useGlobalSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const isWishlisted = isInWishlist(product.id);
  const isPaused = settings.pauseOrders; 

  const [showVariants, setShowVariants] =
  React.useState(false);

  const [isPopupCollapsed, setIsPopupCollapsed] =
  React.useState(true);

  const [mobilePopupVisible, setMobilePopupVisible] =
  React.useState(false);

  const longPressRef =
  React.useRef<NodeJS.Timeout | null>(
    null
  );

  const [selectedProduct, setSelectedProduct] =
  React.useState(product);

  React.useEffect(() => {
  setSelectedProduct(product);
}, [product]);

const variants =
  product.variants || [];

const hasVariants =
  variants.length > 1;

const hasManyVariants =
  variants.length > 3;



  return (
    <div
  className="relative"
  onMouseEnter={() => {
  if (hasVariants) {
    setShowVariants(true);
    setIsPopupCollapsed(false);
  }
}}
  onMouseLeave={() => {
    setShowVariants(false);
  }}
>
  <Card
  className={cn(
    "group relative overflow-visible border-0 bg-transparent shadow-none hover:shadow-lg transition-shadow duration-300 rounded-xl bg-white flex flex-col h-full",
   showVariants &&
!isPopupCollapsed &&
"after:absolute after:inset-0 after:bg-black/40 after:rounded-xl after:z-10"
  )}
>

    {hasVariants && showVariants && (
  <div
  className={cn(
    `
    hidden md:block
    absolute
    z-20
    bg-white
    rounded-xl
    shadow-2xl
    border
    transition-all 
    duration-300 
    ease-in-out
    `,
    isPopupCollapsed
  ? `
    bottom-16
    left-1/2
    -translate-x-1/2
    w-[75%]
    max-w-[220px]
    py-2
    px-3
    bg-white
    border-2
    border-black
    rounded-xl
    shadow-xl
  `
     : `
  top-14
  left-1/2
  -translate-x-1/2
  w-[72%]
  max-w-[230px]
  p-3
  border-2
  border-black
  rounded-2xl
`
  )}
>
    <div className="mb-3 flex items-center justify-between">
  <h4 className="text-sm font-semibold text-gray-900">
    Select Size
  </h4>

<button
  type="button"
  className="
    text-xl
    font-medium
    text-gray-500
    hover:text-black
    transition-all
    duration-300
  "
    onClick={() =>
      setIsPopupCollapsed(
        !isPopupCollapsed
      )
    }
  >
    <span
  className="
    inline-block
    transition-transform
    duration-300
  "
>
  {isPopupCollapsed ? "+" : "−"}
</span>
  </button>
</div>

    <div
  className={cn(
    `
    overflow-hidden
    transition-all
    duration-300
    ease-in-out
    `,
    isPopupCollapsed
      ? "max-h-0 opacity-0"
      : hasManyVariants
      ? "max-h-[210px] opacity-100"
      : "max-h-[180px] opacity-100"
  )}
>
  <div
  className={cn(
    "space-y-2 pr-1",
    hasManyVariants &&
      "overflow-y-auto max-h-[155px]"
  )}
>
    {variants.map((variant) => (
        <button
          key={variant.id}
          className={cn(
  `
  w-full
  border
  rounded-md
  px-3
  py-2
  flex
  justify-center
  items-center
  transition-all
  `,
  selectedProduct.id === variant.id
    ? "border-primary bg-primary/10"
    : "border-gray-200 bg-white hover:border-primary hover:bg-slate-50"
)}
          onClick={() => {
  setSelectedProduct(variant);
}}
        >
          <span className="font-medium w-full text-center">
  {variant.quantity} {variant.unitsOfMeasure}
</span>
        </button>
           ))}
    </div>
</div>
  </div>
)}

      <div
  className="relative w-full aspect-square min-h-[200px] overflow-hidden bg-slate-50 cursor-pointer flex items-center justify-center"

  onTouchStart={() => {
    if (
      window.innerWidth < 768 &&
      hasVariants
    ) {
      longPressRef.current =
        setTimeout(() => {
          setMobilePopupVisible(true);
          setIsPopupCollapsed(false);
        }, 200);
    }
  }}

  onTouchEnd={() => {
    if (longPressRef.current) {
      clearTimeout(
        longPressRef.current
      );
    }
  }}

  onClick={() => {
    navigate(
      `/shop/product/${
        selectedProduct.slug ||
        selectedProduct.id
      }`,
      {
        state: {
          from:
            location.pathname +
            location.search
        }
      }
    );
  }}
>
        {isValidImageUrl(selectedProduct.images?.[0]) ? (
          <img
            src={selectedProduct.images[0]}
            alt={selectedProduct.name}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105 will-change-transform transform-gpu"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {selectedProduct.sellingPrice && selectedProduct.sellingPrice < selectedProduct.price && (
          <Badge className="absolute left-2 top-2 bg-red-600 hover:bg-red-700 font-bold px-2 py-1">
            {Math.round(((selectedProduct.price - selectedProduct.sellingPrice) / selectedProduct.price) * 100)}% OFF
          </Badge>
        )}
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute right-2 top-2 h-8 w-8 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 shadow-md",
            (isWishlisted || variant === 'wishlist') && "opacity-100",
            variant === 'wishlist' ? "text-red-500 hover:text-red-700 bg-white" : "text-red-500 hover:text-red-600 bg-white/90"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product as any);
          }}
        >
          {variant === 'wishlist' ? (
            <Trash2 className="h-4 w-4" />
          ) : (
            <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
          )}
        </Button>
      </div>

       {/* Mobile */}
{mobilePopupVisible && (
<div className="md:hidden relative mb-3">

  <div
    className={cn(
      `
      absolute
      left-0
      right-0
      bottom-2
      z-30
      bg-white
      border-2
      border-black
      rounded-lg
      shadow-lg
      overflow-hidden
      transition-all
      duration-300
      ease-in-out
      `,
      isPopupCollapsed
  ? "max-h-[52px]"
  : hasManyVariants
  ? "max-h-[210px]"
  : "max-h-[190px]"
    )}
  >
    <button
      type="button"
      className="w-full px-4 py-3 flex justify-between items-center"
      onClick={() => {
  if (!isPopupCollapsed) {
  setIsPopupCollapsed(true);
} else {
    setIsPopupCollapsed(false);
  }
}}
    >
      <span>Size</span>

      <span className="text-lg font-medium">
        {isPopupCollapsed ? "+" : "−"}
      </span>
    </button>

    {!isPopupCollapsed && (
 <div
  className={cn(
    hasManyVariants &&
      "max-h-[155px] overflow-y-auto"
  )}
>
        {variants.map((variant) => (
          <button
  key={variant.id}
  className={cn(
    `
    w-full
    px-4
    py-3
    border-t
    flex
    justify-center
    items-center
    transition-all
    `,
    selectedProduct.id === variant.id
      ? "bg-primary/10 border-primary"
      : "bg-white"
  )}
            onClick={() =>
              setSelectedProduct(
                variant
              )
            }
          >
            <span className="w-full text-center">
  {variant.quantity}
  {" "}
  {variant.unitsOfMeasure}
</span>
          </button>
        ))}
      </div>
    )}
  </div>

</div>
)}


      <CardContent className="p-4 flex-1 flex flex-col">
       <div className="mb-2 flex flex-col text-sm font-medium">

  

  {/* Brand */}
  <button
    type="button"
    className="w-fit text-left text-blue-600 hover:underline"
    onClick={(e) => {
      e.stopPropagation();

      navigate(
        `/shop/filters?brand=${
          product.brandSlug || product.brandId
        }`
      );
    }}
  >
    {product.brandName}
  </button>
</div>

        <h3
          className="font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors text-gray-900 min-h-[2.5rem]"
         onClick={() =>
  navigate(
    `/shop/product/${
      selectedProduct.slug ||
      selectedProduct.id
    }`,
    {
      state: {
        from:
          location.pathname +
          location.search
      }
    }
  )
}
          title={selectedProduct.name}
        >
          {selectedProduct.name}
        </h3>

        {selectedProduct.totalReviews ? (
          <div className="flex items-center gap-1 mt-1 mb-2 text-[10px] text-gray-500 font-bold">
            <div className="flex gap-0.5">
              {Array(5).fill(0).map((_, i) => (
                <Star key={i} className={`h-3 w-3 ${i < Math.round(selectedProduct.averageRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
              ))}
            </div>
            <span>({selectedProduct.totalReviews})</span>
          </div>
        ) : null}

        <div className="mt-auto">
          <div className="flex items-center flex-wrap gap-2 mb-2">
            {selectedProduct.sellingPrice && selectedProduct.sellingPrice < selectedProduct.price ? (
              <>
                <span className="font-bold text-lg text-gray-900">₹{selectedProduct.sellingPrice}</span>
                <span className="text-sm text-gray-500 line-through">₹{selectedProduct.price}</span>
              </>
            ) : (
              <span className="font-bold text-lg">₹{selectedProduct.price}</span>
            )}

            {(selectedProduct.quantity || selectedProduct.weight) && (
  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-auto">
    {selectedProduct.quantity || selectedProduct.weight}
    {" "}
    {selectedProduct.unitsOfMeasure === 'pcs'
      ? 'pc'
      : selectedProduct.unitsOfMeasure}
  </span>
)}
</div>

          {/* Rewards Section */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              🪙 {Math.floor((selectedProduct.spv || 0) * 0.1)} Coins
            </span>

            {(selectedProduct.spv || 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                💎 SPV: {selectedProduct.spv}
              </span>
            )}
          </div>
        </div>

      </CardContent>


   
      <CardFooter className="p-4 pt-0">
        <Button
          className={cn("w-full gap-2 rounded-full", isPaused && "bg-gray-100 text-gray-400 hover:bg-gray-100 cursor-not-allowed")}
          onClick={() =>
  !isPaused &&
  addToCart(selectedProduct)
}
          disabled={isPaused}
        >
          {isPaused ? (
            <>Orders Paused</>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
    </div>
  );
};

export const ProductCard = React.memo(ProductCardComponent);
