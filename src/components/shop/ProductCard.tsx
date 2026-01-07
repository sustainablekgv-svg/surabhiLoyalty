import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { Product } from '@/types/shop';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'wishlist';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, variant = 'default' }) => {
  const { addToCart, toggleWishlist, isInWishlist } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isWishlisted = isInWishlist(product.id);

  return (
    <Card className="group overflow-hidden border-0 bg-transparent shadow-none hover:shadow-lg transition-all duration-300 rounded-xl bg-white">

      <div className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer" onClick={() => navigate(`/shop/product/${product.id}`)}>
        {isValidImageUrl(product.images?.[0]) ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {product.sellingPrice && product.sellingPrice < product.price && (
          <Badge className="absolute left-2 top-2 bg-red-600 hover:bg-red-700 font-bold px-2 py-1">
             {Math.round(((product.price - product.sellingPrice) / product.price) * 100)}% OFF
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
      <CardContent className="p-4">
        <div 
          className="mb-2 text-sm text-gray-600 cursor-pointer hover:underline font-medium"
          onClick={() => navigate(`/shop?category=${product.categoryName}`)}
        >
          {product.categoryName}
        </div>
        <h3 
          className="font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors mb-2 text-gray-900"
          onClick={() => navigate(`/shop/product/${product.id}`)}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          {product.sellingPrice && product.sellingPrice < product.price ? (
            <>
              <span className="font-bold text-lg text-gray-900">₹{product.sellingPrice}</span>
              <span className="text-sm text-gray-500 line-through">₹{product.price}</span>
            </>
          ) : (
            <span className="font-bold text-lg">₹{product.price}</span>
          )}
        </div>
        {user && user.role === 'customer' && product.spv && product.spv > 0 && (
          <div className="mt-1">
             <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
               SPV: {product.spv}
             </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full gap-2 rounded-full" 
          onClick={() => addToCart(product)}
          disabled={product.stock <= 0}
        >
          <ShoppingCart className="h-4 w-4" />
          {product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </CardFooter>
    </Card>
  );
};
