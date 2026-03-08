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

  const cleanCartItem = (item: CartItem): CartItem => ({
    productId: item.productId || '',
    quantity: item.quantity || 1,
    name: item.name || 'Unknown Product',
    price: item.price || 0,
    image: item.image || '',
    maxStock: item.maxStock || 999999,
    brandName: item.brandName ?? '',
    brandId: item.brandId ?? '',
    freeShipping: item.freeShipping ?? false,
    spv: item.spv ?? 0,
    placeOfOrigin: item.placeOfOrigin ?? [],
    weight: item.weight ?? '',
    productQuantity: item.productQuantity ?? item.weight ?? '',
    weightInKg: item.weightInKg || 0.5,
    unitsOfMeasure: item.unitsOfMeasure ?? '',
  });

  const addToCart = async (product: Product, quantity = 1): Promise<boolean> => {
    if (!user || !user.id) {
      toast.error('Please login to add items to cart');
      return false;
    }

    let updatedCart = [...cart];
    const existingItemIndex = updatedCart.findIndex((item) => item.productId === product.id);

    if (existingItemIndex > -1) {
      const newQuantity = updatedCart[existingItemIndex].quantity + quantity;
      updatedCart[existingItemIndex].quantity = newQuantity;
    } else {
      updatedCart.push({
        productId: product.id,
        quantity,
        name: product.name,
        price: product.sellingPrice,
        image: product.images?.[0] || '',
        maxStock: product.trackInventory === false ? 9999 : (product.stock || 0),
        brandName: product.brandName ?? '',
        brandId: product.brandId ?? '',
        freeShipping: product.freeShipping ?? false,
        spv: product.spv ?? 0,
        placeOfOrigin: product.placeOfOrigin ?? [],
        weight: product.weight ?? '',
        productQuantity: product.quantity ?? product.weight ?? '',
        weightInKg: product.weightInKg || 0.5,
        unitsOfMeasure: product.unitsOfMeasure ?? '',
      });
    }

    // Clean all items before saving
    updatedCart = updatedCart.map(cleanCartItem);

    try {
      // Foolproof data cleaning to remove any undefined properties
      const dataToSave = JSON.parse(JSON.stringify({ items: updatedCart }));
      await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), dataToSave);
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
    const updatedCart = cart.filter((item) => item.productId !== productId).map(cleanCartItem);
    const dataToSave = JSON.parse(JSON.stringify({ items: updatedCart }));
    await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), dataToSave);
    toast.success('Removed from cart');
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user || !user.id) return;
    if (quantity < 1) {
        removeFromCart(productId);
        return;
    }
    
    let updatedCart = cart.map((item) => {
      if (item.productId === productId) {
         const cappedQuantity = Math.min(item.maxStock, quantity);
         return { ...item, quantity: cappedQuantity };
      }
      return item;
    });

    // Clean all items before saving
    updatedCart = updatedCart.map(cleanCartItem);

    const dataToSave = JSON.parse(JSON.stringify({ items: updatedCart }));
    await setDoc(doc(db, 'Customers', user.id, 'cart', 'items'), dataToSave);
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
