import { ProductCard } from '@/components/shop/ProductCard';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { useShop } from '@/hooks/shop-context';
import { db } from '@/lib/firebase';
import { Product } from '@/types/shop';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const WishlistPage = () => {
    const { wishlist } = useShop();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Re-using dummy data for now if FS fails or empty, but ideally we fetch specific IDs
    // Since we don't have infinite mock data, we will just fetch from FS logic or filter dummy
    
    useEffect(() => {
        const fetchWishlist = async () => {
             // If we have items in wishlist (which are WishlistItems), we can display them directly.
             // But if we want full product details (like updated stock/price), we should fetch.
             // Given the 'WishlistItem' has basic details, let's use them for display to be fast, 
             // OR fetch fresh data. The previous code wanted fresh data. 
             // Let's stick to fresh data but use correct ID.
             
            if (wishlist.length === 0) {
                setProducts([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const fetched: Product[] = [];
                for (const item of wishlist) {
                     const id = item.productId;
                     // Try to fetch from FS first
                     const docRef = doc(db, 'products', id);
                     const docSnap = await getDoc(docRef);
                     if (docSnap.exists()) {
                         fetched.push({ id: docSnap.id, ...docSnap.data() } as Product);
                     } else {
                        // Fallback or use stored item details as a Product-like object
                        // Construct a product from WishlistItem
                        fetched.push({
                            id: item.productId,
                            name: item.name,
                            description: '',
                            price: item.price,
                            sellingPrice: item.price,
                            weight: '',
                            stock: item.stock,
                            images: [item.image],
                            categoryId: '',
                            categoryName: '',
                            brandId: '',
                            brandName: '',
                            isActive: true,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                     }
                }
                setProducts(fetched);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchWishlist();
    }, [wishlist]);

  return (
    <ShopLayout title="My Wishlist">
      {loading ? (
        <div className="flex justify-center items-center h-64">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
             <h2 className="text-2xl font-semibold mb-4">Your wishlist is empty</h2>
             <Button onClick={() => navigate('/shop')}>Start Shopping</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
                <ProductCard key={product.id} product={product} variant="wishlist" />
            ))}
        </div>
      )}
    </ShopLayout>
  );
};

export default WishlistPage;
