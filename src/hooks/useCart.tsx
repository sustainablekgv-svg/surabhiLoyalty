import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { CartItem, Product } from '@/types/shop';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => Promise<boolean>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user } = useAuth(); // We need to verify if useAuth exists or use another way

  useEffect(() => {
    if (!user) {
      setCart([]);
      return;
    }

    const cartRef = doc(db, 'Customers', user.id!, 'cart', 'items');
    const unsubscribe = onSnapshot(cartRef, (doc) => {
      if (doc.exists()) {
        setCart(doc.data().items || []);
      } else {
        setCart([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const addToCart = async (product: Product, quantity = 1): Promise<boolean> => {
    if (!user || !user.id) {
      toast.error('Please login to add items to cart');
      return false;
    }

    const updatedCart = [...cart];
    const existingItemIndex = updatedCart.findIndex((item) => item.productId === product.id);

    if (existingItemIndex > -1) {
      const newQuantity = updatedCart[existingItemIndex].quantity + quantity;
      // Inventory Check Logic
      const isTrackingInventory = product.trackInventory === true;
      const maxStock = isTrackingInventory ? product.stock : 999999;
      
      if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} items available`);
        return false;
      }
      updatedCart[existingItemIndex].quantity = newQuantity;
    } else {
      updatedCart.push({
        productId: product.id,
        quantity,
        name: product.name,
        price: product.sellingPrice,
        image: product.images[0],
        maxStock: product.trackInventory === true ? product.stock : 999999, // High number if not tracking
        freeShipping: product.freeShipping,
        spv: product.spv,
        placeOfOrigin: product.placeOfOrigin,
        weight: product.weight,
        unitsOfMeasure: product.unitsOfMeasure,
      });
    }

    try {
      await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), { items: updatedCart });
      toast.success('Added to cart');
      return true;
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
      return false;
    }
  };

  const removeFromCart = async (productId: string) => {
    if (!user || !user.id) return;
    const updatedCart = cart.filter((item) => item.productId !== productId);
    await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), { items: updatedCart });
    toast.success('Removed from cart');
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user || !user.id) return;
    if (quantity < 1) {
        removeFromCart(productId);
        return;
    }
    
    const updatedCart = cart.map((item) => {
      if (item.productId === productId) {
         if (quantity > item.maxStock) {
            toast.error(`Only ${item.maxStock} items available`);
            return item;
         }
         return { ...item, quantity };
      }
      return item;
    });
    
    // Check if change actually happened
    const item = updatedCart.find(i => i.productId === productId);
    if(item && item.quantity !== quantity) return; // Update validation failed (stock)

    await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), { items: updatedCart });
  };

  const clearCart = async () => {
    if (!user || !user.id) return;
    await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), { items: [] });
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
