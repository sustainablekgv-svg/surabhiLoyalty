import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { ArrowLeft, Heart, LayoutDashboard, ShoppingCart, User } from 'lucide-react';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Footer } from './Footer';

import { SEO } from '@/components/SEO';

interface ShopLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export const ShopLayout: React.FC<ShopLayoutProps> = ({ children, title = 'Shop', showBack = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, wishlist } = useShop();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <SEO title={title} description="Browse our collection of premium products." />
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
            {/* Profile / Login / Dashboard */}
            {user ? (
               (user.role === 'admin' || user.role === 'superadmin') ? (
                  <Button variant="default" size="sm" onClick={() => navigate('/admin/dashboard')} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <LayoutDashboard className="h-4 w-4" />
                    Back to Dashboard
                  </Button>
               ) : (
                  <Button variant="ghost" size="icon" onClick={() => navigate('/customer/dashboard')} title="My Profile">
                    <User className="h-5 w-5" />
                  </Button>
               )
            ) : (
               <Button variant="ghost" size="sm" onClick={() => navigate('/login', { state: { from: location } })}>
                 Login
               </Button>
            )}

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
      <main className="container py-8 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};
