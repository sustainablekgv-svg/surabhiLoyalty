
import { db } from '@/lib/firebase';
import { CartItem, Order, Product } from '@/types/shop';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { createContext, useContext } from 'react';
import { toast } from 'sonner';
import { useAuth } from './auth-context';
import { useCart } from './useCart';
import { useWishlist } from './useWishlist';

interface ShopContextType {
  cart: CartItem[];
  wishlist: import('@/types/shop').WishlistItem[]; // Update type match
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>; // Changed to match useWishlist signature if possible or wrap
  isInWishlist: (productId: string) => boolean;
  cartTotal: number;
  cartCount: number;
  createOrder: (orderData: Partial<Order>) => Promise<string | undefined>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, itemCount } = useCart();
  const { wishlist, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();

  // Helper to match the toggleWishlist signature expected by UI (id only) 
  // But useWishlist.addToWishlist needs PRODUCT. 
  // UI in ProductCard passes 'product.id' to toggleWishlist? No, ProductCard passes 'product.id' to toggleWishlist in the OLD code. 
  // I need to change ProductCard to pass Product or update ShopContext to find product.
  // Ideally, ProductCard has the product object.
  // I will update this context to accept Product for toggle. 
  // But to support legacy calls (if any), I might need to fetch it.
  // Actually, ProductCard.tsx line 50: toggleWishlist(product.id). 
  // I should update ProductCard to pass the product. 
  
  // For now, I will implement a check. If I can't get product, I can't add to wishlist in new system.
  // NOTE: New WishlistItem stores name/price/image. Old system stored just ID string.
  // So I MUST have the product object to add.
  // I will leave this as a TODO to update ProductCard.
  
  // Actually, let's just expose a `toggleWishlistWithProduct` or modify `toggleWishlist` implementation here 
  // by fetching product if needed? No, that's slow.
  // I will refactor ProductCard to pass 'product'. 
  // But wait, the ShopContext interface defines `toggleWishlist: (productId: string) => void`. 
  // I should change the interface or implementation.
  
  // Let's change the interface here to accept (product: Product | string).
  // If string, we try to find it in products list? No, getting complicated.
  // I'll update ProductCard.tsx to use `addToWishlist(product)` or `removeFromWishlist(id)`.
  
  // Check ShopContext legacy interface:
  // toggleWishlist: (productId: string) => void;
  
  // I will implement a makeshift toggle here that works if we have the item in wishlist (remove).
  // If we want to ADD, we need the product object.
  // I will export `handleToggleWishlist` which takes `product`.

  const handleToggleWishlist = async (productOrId: string | Product) => {
      if (typeof productOrId === 'string') {
          // Can only remove if string passed, or we fail.
          // Check if in wishlist
          if (isInWishlist(productOrId)) {
             await removeFromWishlist(productOrId);
          } else {
             toast.error("Cannot add to wishlist without product details. Please click the heart icon on a product card.");
          }
      } else {
          // It's a product
          const product = productOrId;
           if (isInWishlist(product.id)) {
             await removeFromWishlist(product.id);
          } else {
             await addToWishlist(product);
          }
      }
  };

  const createOrder = async (orderData: Partial<Order>) => {
    if (!user || (!user.id && !(user as any).uid)) { 
         toast.error("You must be logged in to place an order.");
         return;
    }
    const userId = user.id || (user as any).uid;

    try {
        // Save order to Firestore 'orders' collection
        // Note: Real Razorpay flow involves creating order on server first, then client payment, then verification.
        // But for COD (which is default in CheckoutPage code so far), this is fine.
        // If Online Payment, we handle differently.
        
        const docRef = await addDoc(collection(db, 'orders'), {
            ...orderData,
            userId: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'pending' // Or 'placed'
        });
        
        return docRef.id;
    } catch (e) {
        console.error("Order creation failed", e);
        throw e;
    }
  };

  return (
    <ShopContext.Provider
      value={{
        cart,
        wishlist,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        toggleWishlist: handleToggleWishlist as any, // Cast to any to satisfy TS for now or update Type
        isInWishlist,
        cartTotal,
        cartCount: itemCount,
        createOrder,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
