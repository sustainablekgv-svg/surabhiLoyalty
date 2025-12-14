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
            if (wishlist.length === 0) {
                setProducts([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // In a real app with many items, we might use 'in' query or fetch individually
                // For this demo, let's just simulate fetching
                const fetched: Product[] = [];
                for (const id of wishlist) {
                     // Try to fetch from FS first
                     const docRef = doc(db, 'products', id);
                     const docSnap = await getDoc(docRef);
                     if (docSnap.exists()) {
                         fetched.push({ id: docSnap.id, ...docSnap.data() } as Product);
                     } else {
                        // If not in DB, check if it matches our dummy IDs (1,2,3) for seamless demo
                        const dummyProducts: Product[] = [
                            {
                              id: '1',
                              name: 'Organic Honey 500g',
                              description: 'Pure organic honey from our farms.',
                              price: 500,
                              sellingPrice: 450,
                              weight: '500g',
                              stock: 10,
                              images: ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=800'],
                              categoryId: 'organic',
                              categoryName: 'Organic',
                              brandId: 'vaaradhi',
                              brandName: 'Vaaradhi',
                              isActive: true,
                              createdAt: new Date(),
                              updatedAt: new Date()
                            },
                            {
                              id: '2',
                              name: 'Mysore Sandal Soap',
                              description: 'Classic sandalwood soap.',
                              price: 180,
                              sellingPrice: 150,
                              weight: '150g',
                              stock: 50,
                              images: ['https://images.unsplash.com/photo-1600857062241-98e5dba7f214?auto=format&fit=crop&q=80&w=800'],
                              categoryId: 'personal-care',
                              categoryName: 'Personal Care',
                              brandId: 'mysore-sandal',
                              brandName: 'Mysore Sandal',
                              isActive: true,
                              createdAt: new Date(),
                              updatedAt: new Date()
                            },
                            {
                                id: '3',
                                name: 'Organic Turmeric Powder',
                                description: 'High curcumin turmeric powder.',
                                price: 250,
                                sellingPrice: 200,
                                weight: '200g',
                                stock: 20,
                                images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=800'],
                                categoryId: 'spices',
                                categoryName: 'Spices',
                                brandId: 'vaaradhi',
                                brandName: 'Vaaradhi',
                                isActive: true,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }
                          ];
                         const found = dummyProducts.find(p => p.id === id);
                         if(found) fetched.push(found);
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
                <ProductCard key={product.id} product={product} />
            ))}
        </div>
      )}
    </ShopLayout>
  );
};

export default WishlistPage;
