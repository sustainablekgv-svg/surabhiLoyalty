import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useShop } from '@/hooks/shop-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { Product } from '@/types/shop';
import { Heart, ShoppingCart } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, toggleWishlist, isInWishlist } = useShop();
  const navigate = useNavigate();
  const isWishlisted = isInWishlist(product.id);

  return (
    <Card className="group overflow-hidden border-0 bg-transparent shadow-none hover:shadow-lg transition-all duration-300 rounded-xl bg-white">

      <div className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer" onClick={() => navigate(`/shop/product/${product.id}`)}>
        {isValidImageUrl(product.images?.[0]) ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {product.sellingPrice && product.sellingPrice < product.price && (
          <Badge className="absolute left-2 top-2 bg-red-500 hover:bg-red-600">
            Sale
          </Badge>
        )}
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute right-2 top-2 h-8 w-8 rounded-full opacity-0 transition-all duration-300 group-hover:opacity-100",
            isWishlisted && "opacity-100 text-red-500 hover:text-red-600"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
        >
          <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
        </Button>
      </div>
      <CardContent className="p-4">
        <div 
          className="mb-2 text-sm text-gray-500 cursor-pointer hover:underline"
          onClick={() => navigate(`/shop?category=${product.categoryName}`)}
        >
          {product.categoryName}
        </div>
        <h3 
          className="font-medium leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors mb-2"
          onClick={() => navigate(`/shop/product/${product.id}`)}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          {product.sellingPrice && product.sellingPrice < product.price ? (
            <>
              <span className="font-bold text-lg">₹{product.sellingPrice}</span>
              <span className="text-sm text-gray-400 line-through">₹{product.price}</span>
            </>
          ) : (
            <span className="font-bold text-lg">₹{product.price}</span>
          )}
        </div>
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
