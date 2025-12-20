import { ShopLayout } from '@/components/shop/ShopLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useShop } from '@/hooks/shop-context';
import { db } from '@/lib/firebase';
import { Product } from '@/types/shop';
import { doc, getDoc } from 'firebase/firestore';
import { Heart, Minus, Plus, Share2, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const ProductDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart, toggleWishlist, isInWishlist } = useShop();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [selectedImage, setSelectedImage] = useState<string>('');

    useEffect(() => {
        const fetchProduct = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const docRef = doc(db, 'products', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as Product;
                    setProduct({ id: docSnap.id, ...data });
                    setSelectedImage(data.images?.[0] || '');
                } else {
                    toast.error("Product not found");
                    navigate('/shop');
                }
            } catch (error) {
                console.error("Error fetching product", error);
                toast.error("Failed to load product");
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [id, navigate]);

    if (loading) {
        return (
            <ShopLayout title="Product Details">
                <div className="grid md:grid-cols-2 gap-8">
                    <Skeleton className="aspect-square rounded-xl" />
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-6 w-1/4" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                </div>
            </ShopLayout>
        );
    }

    if (!product) return null;

    const isWishlisted = isInWishlist(product.id);
    const hasDiscount = !!product.sellingPrice && product.sellingPrice < product.price;
    const discountPercentage = hasDiscount 
        ? Math.round(((product.price - product.sellingPrice!) / product.price) * 100) 
        : 0;

    const decreaseQty = () => setQuantity(prev => Math.max(1, prev - 1));
    const increaseQty = () => setQuantity(prev => Math.min(product.stock, prev + 1));

    return (
        <ShopLayout>
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                {/* Image Gallery */}
                <div className="space-y-4">
                    <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border">
                        {selectedImage ? (
                            <img 
                                src={selectedImage} 
                                alt={product.name} 
                                className="h-full w-full object-cover" 
                                onError={(e) => {
                                    e.currentTarget.src = 'https://placehold.co/600x600?text=No+Image';
                                    e.currentTarget.onerror = null; // Prevent infinite loop
                                }}
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                    </div>
                    {product.images && product.images.length > 1 && (
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {product.images.map((img, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => setSelectedImage(img)}
                                    className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transaction-all ${selectedImage === img ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-200'}`}
                                >
                                    <img src={img} alt={`${product.name} view ${idx + 1}`} className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-start">
                            <div>
                                {product.brandName && (
                                    <Badge variant="secondary" className="mb-2 hover:bg-secondary">
                                        {product.brandName || "Brand"}
                                    </Badge>
                                )}
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                toast.success("Link copied to clipboard");
                            }}>
                                <Share2 className="h-5 w-5 text-gray-500" />
                            </Button>
                        </div>
                        
                        <div className="mt-4 flex items-end gap-3">
                            <span className="text-3xl font-bold text-primary">
                                ₹{product.sellingPrice || product.price}
                            </span>
                            {hasDiscount && (
                                <>
                                    <span className="text-lg text-gray-400 line-through decoration-2">
                                        ₹{product.price}
                                    </span>
                                    <Badge variant="destructive" className="mb-1">
                                        {discountPercentage}% OFF
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="prose prose-sm text-gray-600 max-w-none">
                        <p>{product.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <span className="block text-gray-500 mb-1">Weight</span>
                            <span className="font-medium">{product.weight || 'N/A'}</span>
                        </div>
                         <div className="p-3 bg-gray-50 rounded-lg">
                            <span className="block text-gray-500 mb-1">Category</span>
                            <span className="font-medium">{product.categoryName}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                             <span className="block text-gray-500 mb-1">Stock Status</span>
                             {product.stock > 0 ? (
                                <span className="font-medium text-green-600">In Stock ({product.stock})</span>
                             ) : (
                                <span className="font-medium text-red-600">Out of Stock</span>
                             )}
                        </div>
                    </div>

                    <div className="pt-6 border-t flex flex-col sm:flex-row gap-4">
                        <div className="flex items-center border rounded-full w-fit">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-l-full" 
                                onClick={decreaseQty}
                                disabled={quantity <= 1}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-12 text-center font-medium">{quantity}</span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-r-full" 
                                onClick={increaseQty}
                                disabled={quantity >= product.stock}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex-1 flex gap-3">
                            <Button 
                                className="flex-1 gap-2 rounded-full h-10" 
                                size="lg"
                                onClick={() => addToCart(product, quantity)}
                                disabled={product.stock <= 0}
                            >
                                <ShoppingCart className="h-5 w-5" />
                                {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
                            </Button>
                             <Button 
                                variant={isWishlisted ? "default" : "outline"}
                                className={`h-10 w-10 shrink-0 rounded-full ${isWishlisted ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' : ''}`}
                                size="icon"
                                onClick={() => toggleWishlist(product.id)}
                            >
                                <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </ShopLayout>
    );
};

export default ProductDetailsPage;
