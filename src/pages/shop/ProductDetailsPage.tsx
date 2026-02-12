import { ShopLayout } from '@/components/shop/ShopLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/auth-context';
import { useShop } from '@/hooks/shop-context';
import { db } from '@/lib/firebase';
import { Product } from '@/types/shop';
import { doc, getDoc } from 'firebase/firestore';
import { Heart, Minus, Plus, Share2, ShoppingCart, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const ProductDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { addToCart, toggleWishlist, isInWishlist } = useShop();
    const { user } = useAuth();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [selectedImage, setSelectedImage] = useState<string>('');
    
    // Custom back handler to preserve filters
    const handleBack = () => {
        if (location.state?.from) {
            navigate(location.state.from);
        } else {
            navigate('/shop');
        }
    };
    
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

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
            <ShopLayout title="Product Details" onBack={handleBack}>
                <div className="min-h-[60vh] flex items-center justify-center">
                    <LoadingSpinner size={48} />
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
        <ShopLayout onBack={handleBack}>
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                {/* Image Gallery */}
                <div className="space-y-4">
                    <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
                        <DialogTrigger asChild>
                            <div className="aspect-square bg-white rounded-2xl overflow-hidden border flex items-center justify-center cursor-pointer hover:opacity-95 transition-opacity relative group">
                                {selectedImage ? (
                                    <>
                                    <img 
                                        src={selectedImage} 
                                        alt={product.name} 
                                        className="max-h-full max-w-full object-contain" 
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://placehold.co/600x600?text=No+Image';
                                            e.currentTarget.onerror = null; // Prevent infinite loop
                                        }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="bg-white/90 text-xs px-2 py-1 rounded shadow-sm">Click to expand</span>
                                    </div>
                                    </>
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-400">No Image</div>
                                )}
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-transparent border-0 shadow-none flex flex-col items-center justify-center">
                             <div className="relative w-full h-full flex items-center justify-center" onClick={() => setIsImageModalOpen(false)}>
                                <img
                                    src={selectedImage}
                                    alt={product.name}
                                    className="max-w-full max-h-full object-contain rounded-lg"
                                />
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="absolute top-4 right-4 rounded-full h-10 w-10 bg-white/80 hover:bg-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsImageModalOpen(false);
                                    }}
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                             </div>
                        </DialogContent>
                    </Dialog>

                    {product.images && product.images.length > 1 && (
                        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2 scrollbar-hide max-w-full">
                            {product.images.map((img, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => setSelectedImage(img)}
                                    className={`relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all flex items-center justify-center bg-white ${selectedImage === img ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-200'}`}
                                >
                                    <img src={img} alt={`${product.name} view ${idx + 1}`} className="max-h-full max-w-full object-contain" />
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
                        
                        {/* Rewards Display */}
                        <div className="mt-4 flex flex-wrap gap-3">
                             <span className="flex items-center gap-1.5 text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                🪙 Earn {Math.floor((product.spv || 0) * 0.1)} Surabhi Coins
                             </span>

                            {(product.spv || 0) > 0 && (
                                <div className="">
                                    <span className="flex items-center gap-1.5 text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                        💎 SPV: {product.spv}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div 
                        className="prose prose-sm text-gray-600 max-w-none text-justify overflow-hidden break-words"
                        dangerouslySetInnerHTML={{ __html: product.description }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm max-w-full">
                        <div className="p-3 bg-gray-50 rounded-lg overflow-hidden">
                            <span className="block text-gray-500 mb-1">Quantity</span>
                            <span className="font-medium break-words">
                                {product.quantity || product.weight || 'N/A'} {product.unitsOfMeasure ? (product.unitsOfMeasure === 'pcs' ? 'pc' : product.unitsOfMeasure) : ''}
                            </span>
                        </div>
                         <div className="p-3 bg-gray-50 rounded-lg overflow-hidden">
                            <span className="block text-gray-500 mb-1">Category</span>
                            <span className="font-medium break-words">{product.categoryName}</span>
                        </div>
                        
                        
                        {product.placeOfOrigin && product.placeOfOrigin.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg overflow-hidden">
                                <span className="block text-gray-500 mb-1">Place of Origin</span>
                                <span className="font-medium break-words">{product.placeOfOrigin.join(', ')}</span>
                            </div>
                        )}
                        
                        {product.weightInKg && (
                            <div className="p-3 bg-gray-50 rounded-lg overflow-hidden">
                                <span className="block text-gray-500 mb-1">Shipping Weight</span>
                                <span className="font-medium break-words">{product.weightInKg} kg</span>
                            </div>
                        )}
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
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex-1 flex gap-3">
                             <Button 
                                className="flex-1 gap-2 rounded-full h-10" 
                                size="lg"
                                onClick={() => addToCart(product, quantity)}
                            >
                                <ShoppingCart className="h-5 w-5" />
                                Add to Cart
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
