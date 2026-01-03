import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { Product, WishlistItem } from '@/types/shop';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface WishlistContextType {
  wishlist: WishlistItem[];
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
        setWishlist([]);
        return;
    }

    const wishlistRef = doc(db, 'Customers', user.id!, 'wishlist', 'items');
    const unsubscribe = onSnapshot(wishlistRef, (doc) => {
      if (doc.exists()) {
        setWishlist(doc.data().items || []);
      } else {
        setWishlist([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const addToWishlist = async (product: Product) => {
    if (!user || !user.id) {
      toast.error('Please login to use wishlist');
      return;
    }

    if (wishlist.some(item => item.productId === product.id)) {
        toast.info('Item already in wishlist');
        return;
    }

    const updatedWishlist = [...wishlist, {
        productId: product.id,
        name: product.name,
        price: product.sellingPrice,
        image: product.images[0],
        stock: product.stock
    }];

    try {
      await setDoc(doc(db, 'Customers', user.id, 'wishlist', 'items'), { items: updatedWishlist });
      toast.success('Added to wishlist');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Failed to add to wishlist');
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (!user || !user.id) return;
    const updatedWishlist = wishlist.filter((item) => item.productId !== productId);
    await setDoc(doc(db, 'Customers', user.id, 'wishlist', 'items'), { items: updatedWishlist });
    toast.success('Removed from wishlist');
  };

  const isInWishlist = (productId: string) => {
      return wishlist.some(item => item.productId === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addToWishlist, removeFromWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
