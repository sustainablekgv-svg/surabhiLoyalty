
import { useAuth } from '@/hooks/auth-context';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { db } from '@/lib/firebase';
import { createOrder as createOrderService } from '@/services/shop';
import { CartItem, Order, Product } from '@/types/shop';
import {
  doc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import React, { createContext, useContext } from 'react';
import { toast } from 'sonner';

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
  const syncCartToFirebase = async (
  userId: string,
  cartItems: CartItem[]
) => {

  try {

    const totalItems = cartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const totalAmount = cartItems.reduce(
      (sum, item) =>
        sum + (item.price * item.quantity),
      0
    );

    await setDoc(
      doc(db, 'carts', userId),
      {
        userId,

        items: cartItems,

        totalItems,

        totalAmount,

        updatedAt: Timestamp.now(),

        abandoned: true
      },
      { merge: true }
    );

  } catch (error) {

    console.error('Cart sync failed', error);

  }
};

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

   /* const createOrder = async (orderData: Partial<Order>) => {
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
            ...JSON.parse(JSON.stringify(orderData)),
            userId: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'pending' // Or 'placed'
        });

        //updated

        // ✅ ADD THIS BLOCK AFTER ORDER CREATION
if (docRef?.id && orderData.surabhiCoinsUsed && orderData.surabhiCoinsUsed > 0) {
  const { doc, updateDoc, increment } = await import('firebase/firestore');
  const customerRef = doc(db, 'Customers', userId);

  await updateDoc(customerRef, {
    pendingSurabhiCoins: increment(orderData.surabhiCoinsUsed)
  });
}
        

// ✅ LOCK SHIPPING BALANCE
if (
  docRef?.id &&
  orderData.shippingPointsUsed &&
  orderData.shippingPointsUsed > 0
) {
  const { doc, updateDoc, increment } =
    await import('firebase/firestore');

  const customerRef = doc(db, 'Customers', userId);

  await updateDoc(customerRef, {
    pendingShippingBalance: increment(
      orderData.shippingPointsUsed
    ),
  });
}

        return docRef.id;
    } catch (e) {
        console.error("Order creation failed", e);
        throw e;
    }
  };  */

  const createOrder = async (orderData: Partial<Order>) => {
  return await createOrderService(orderData as any);
};

 const handleAddToCart = async (
  product: Product,
  quantity?: number
) => {

  await addToCart(product, quantity);

  // ✅ REMOVE FROM WISHLIST
  if (isInWishlist(product.id)) {

    await removeFromWishlist(product.id);

    toast.info("Moved to cart from wishlist");
  }

  // ✅ FIREBASE SYNC
  if (user?.uid) {

    console.log("USER UID:", user.uid);

    const updatedCart = [
      ...cart,
      {
        ...product,
        productId: product.id,
        quantity: quantity || 1
      }
    ];

    console.log("UPDATED CART:", updatedCart);

    await syncCartToFirebase(
      user.uid,
      updatedCart as CartItem[]
    );
  }
};

// ✅ UPDATED REMOVE FROM CART WITH FIREBASE SYNC
const handleRemoveFromCart = async (
  productId: string
) => {

  await removeFromCart(productId);

  if (user?.uid) {

    const updatedCart = cart.filter(
      item => item.productId !== productId
    );

    await syncCartToFirebase(
      user.uid,
      updatedCart
    );
  }
};


// ✅ UPDATED QUANTITY UPDATE WITH FIREBASE SYNC
const handleUpdateQuantity = async (
  productId: string,
  quantity: number
) => {

  await updateQuantity(productId, quantity);

  if (user?.uid) {

    const updatedCart = cart.map(item =>
      item.productId === productId
        ? { ...item, quantity }
        : item
    );

    await syncCartToFirebase(
      user.uid,
      updatedCart
    );
  }
};
  return (
    <ShopContext.Provider
      value={{
        cart,
        wishlist,
        addToCart: handleAddToCart,
        removeFromCart: handleRemoveFromCart,
  updateQuantity: handleUpdateQuantity,
        clearCart,
        toggleWishlist: handleToggleWishlist as any,
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
