import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { ArrowLeft, Heart, LayoutDashboard, ShoppingCart, User } from 'lucide-react';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Footer } from './Footer';

import { SEO } from '@/components/SEO';
import { FloatingWhatsApp } from './FloatingWhatsApp';

interface ShopLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const ShopLayout: React.FC<ShopLayoutProps> = ({ children, title = 'Shop', showBack = true, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, wishlist } = useShop();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <SEO title={title} description="Browse our collection of premium products." />
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 md:h-16 items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-1 md:gap-4 min-w-0 flex-1">
            {showBack && (
              <Button variant="ghost" size="icon" onClick={onBack || (() => navigate(-1))} className="shrink-0 h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            )}
            <Link to="/shop" className="text-base md:text-xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity truncate">
              {title}
            </Link>
          </div>

          <div className="flex items-center gap-0.5 md:gap-2 shrink-0">
            {/* Profile / Login / Dashboard */}
            {user ? (
               (user.role === 'admin' || user.role === 'superadmin') ? (
                  <Button variant="default" size="sm" onClick={() => navigate('/admin/dashboard')} className="gap-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 md:px-3">
                    <LayoutDashboard className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Back to Dashboard</span>
                    <span className="sm:hidden">Admin</span>
                  </Button>
               ) : (
                  <Button variant="ghost" size="icon" onClick={() => navigate('/customer/dashboard')} title="My Profile" className="h-8 w-8 md:h-10 md:w-10">
                    <User className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
               )
            ) : (
               <Button variant="ghost" size="sm" onClick={() => navigate('/login', { state: { from: location } })} className="text-xs md:text-sm px-2 md:px-3">
                 Login
               </Button>
            )}

            <Button variant="ghost" size="icon" onClick={() => navigate('/shop/wishlist')} className="relative h-8 w-8 md:h-10 md:w-10">
              <Heart className="h-4 w-4 md:h-5 md:w-5" />
              {wishlist.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center rounded-full p-0 text-[10px] md:text-xs">
                  {wishlist.length}
                </Badge>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/shop/cart')} className="relative h-8 w-8 md:h-10 md:w-10">
              <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center rounded-full p-0 text-[10px] md:text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-4 md:py-8 flex-1 px-3 md:px-4">
        {children}
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
