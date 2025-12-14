import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useShop } from '@/hooks/shop-context';
import { ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface ShopLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export const ShopLayout: React.FC<ShopLayoutProps> = ({ children, title = 'Shop', showBack = true }) => {
  const navigate = useNavigate();
  const { cartCount, wishlist } = useShop();

  return (
    <div className="min-h-screen bg-gray-50/50">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {showBack && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Link to="/shop" className="text-xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity">
              {title}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/shop/wishlist')} className="relative">
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs">
                  {wishlist.length}
                </Badge>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/shop/cart')} className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-8">
        {children}
      </main>
    </div>
  );
};
