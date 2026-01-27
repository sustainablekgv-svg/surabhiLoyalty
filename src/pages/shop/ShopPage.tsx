import { ProductCard } from '@/components/shop/ProductCard';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { getActiveProducts, getBrands, getCategories } from '@/services/shop';
import { Brand, Category, Product } from '@/types/shop';
import { Filter, Home, LayoutGrid, ShoppingBag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ShopPage = () => {
    const navigate = useNavigate();
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 12;

    // Filters
    const [viewMode, setViewMode] = useState<'landing' | 'products'>('landing');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [spvRange, setSpvRange] = useState<[number, number]>([0, 5000]);
    const [sortBy, setSortBy] = useState<string>('order');

    // Debounce search query
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            if (searchQuery) {
                setViewMode('products');
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch brands, products, and categories in parallel
                const [fetchedBrands, fetchedProducts, fetchedCategories] = await Promise.all([
                    getBrands(),
                    getActiveProducts(),
                    getCategories(200) // Fetch enough relevant categories
                ]);
                
                setBrands(fetchedBrands);
                setAllProducts(fetchedProducts);
                setAllCategories(fetchedCategories.categories);
            } catch (error) {
                console.error("Failed to load shop data", error);
                toast.error("Failed to load products");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Check if we are in "Landing Mode" (No filters active)
    const isLandingPage = useMemo(() => {
        return viewMode === 'landing';
    }, [viewMode]);

    // Extract categories name strings
    const categoryNames = useMemo(() => {
        return allCategories.map(c => c.name);
    }, [allCategories]);

    // Filter and Sort Products
    const filteredProducts = useMemo(() => {
        let result = [...allProducts];

        // Search
        if (debouncedSearch) {
            const lowerQuery = debouncedSearch.toLowerCase();
            result = result.filter(p => 
                p.name.toLowerCase().includes(lowerQuery) || 
                p.description.toLowerCase().includes(lowerQuery)
            );
        }

        // Category
        if (selectedCategory) {
            result = result.filter(p => p.categoryName === selectedCategory);
        }

        // Brand
        if (selectedBrand && selectedBrand !== 'all') {
            result = result.filter(p => p.brandId === selectedBrand);
        }

        // Price
        result = result.filter(p => p.sellingPrice >= priceRange[0] && p.sellingPrice <= priceRange[1]);

        // SPV
        result = result.filter(p => {
            const val = p.spv || 0;
            return val >= spvRange[0] && val <= spvRange[1];
        });

        // Sort
        if (sortBy === 'price_asc') {
            result.sort((a, b) => a.sellingPrice - b.sellingPrice);
        } else if (sortBy === 'price_desc') {
            result.sort((a, b) => b.sellingPrice - a.sellingPrice);
        } else if (sortBy === 'spv_asc') {
            result.sort((a, b) => (a.spv || 0) - (b.spv || 0));
        } else if (sortBy === 'spv_desc') {
            result.sort((a, b) => (b.spv || 0) - (a.spv || 0));
        } else {
             // Default (Admin Order)
             result.sort((a, b) => {
                 const orderA = a.displayOrder || 999999;
                 const orderB = b.displayOrder || 999999;
                 if (orderA === orderB) {
                    const dateA = a.createdAt?.seconds || 0;
                    const dateB = b.createdAt?.seconds || 0;
                    return dateB - dateA;
                 }
                 return orderA - orderB;
             });
        }

        return result;
        return result;
    }, [allProducts, debouncedSearch, selectedCategory, selectedBrand, priceRange, spvRange, sortBy]);

    // Pagination
    const displayedProducts = useMemo(() => {
        return filteredProducts.slice(0, page * PAGE_SIZE);
    }, [filteredProducts, page]);

    const hasMore = displayedProducts.length < filteredProducts.length;

    const loadMore = () => {
        setPage(prev => prev + 1);
    };

    // Reset pagination when filters change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedCategory, selectedBrand, priceRange, spvRange, sortBy]);
    

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCategory(null);
        setSelectedBrand(null);
        setSelectedBrand(null);
        setPriceRange([0, 10000]);
        setSpvRange([0, 5000]);
        setSortBy('order');
        // Do NOT switch back to landing view automatically
    };

    const FilterContent = () => (
        <div className="space-y-6">
            <div>
                <h3 className="mb-2 text-sm font-medium">Categories</h3>
                <div className="flex flex-wrap gap-2">
                    <Button 
                        variant={selectedCategory === null ? "default" : "outline"} 
                        size="sm"
                        onClick={() => setSelectedCategory(null)}
                        className="rounded-full"
                    >
                        All
                    </Button>
                    {categoryNames.map(cat => (
                        <Button 
                            key={cat}
                            variant={selectedCategory === cat ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCategory(cat)}
                            className="rounded-full"
                        >
                            {cat}
                        </Button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">Brands</h3>
                <Select value={selectedBrand || "all"} onValueChange={(val) => setSelectedBrand(val === "all" ? null : val)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {brands.map(brand => (
                            <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">Price Range (₹{priceRange[0]} - ₹{priceRange[1]})</h3>
                 <Slider
                    defaultValue={[0, 10000]}
                    max={10000}
                    step={100}
                    value={priceRange}
                    onValueChange={(val) => setPriceRange(val as [number, number])}
                    className="mt-4"
                />
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">SPV Range (Coins: {spvRange[0]} - {spvRange[1]})</h3>
                 <Slider
                    defaultValue={[0, 5000]}
                    max={5000}
                    step={50}
                    value={spvRange}
                    onValueChange={(val) => setSpvRange(val as [number, number])}
                    className="mt-4"
                />
            </div>
             <Button variant="outline" className="w-full" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
        </div>
    );

    return (
        <ShopLayout title="Shop">
            <div className="flex flex-col gap-6">
                
                {/* 1. Header & Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm sticky top-16 z-30">
                     <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Go Home" className="-ml-2">
                            <Home className="h-6 w-6" />
                     </Button>
                     <div className="relative w-full md:w-96">
                        <Input 
                            placeholder="Search products..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        {/* Mobile Filters Trigger - Visible only in Product View */}
                        {!isLandingPage && (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" className="md:hidden w-full">
                                        <Filter className="mr-2 h-4 w-4" /> Filters
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left">
                                    <SheetHeader>
                                        <SheetTitle>Filters</SheetTitle>
                                    </SheetHeader>
                                    <div className="mt-4">
                                        <FilterContent />
                                    </div>
                                </SheetContent>
                            </Sheet>
                        )}
                        
                        {/* Sort Dropdown - Removed Featured/Newest, kept Price */}
                        {!isLandingPage && (
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="order">Default</SelectItem>
                                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                                    <SelectItem value="spv_asc">SPV: Low to High</SelectItem>
                                    <SelectItem value="spv_desc">SPV: High to Low</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {/* 2. Content Area */}
                {isLandingPage ? (
                    // LANDING PAGE VIEW
                    <div className="space-y-12 py-4">
                        
                        {/* Categories Section */}
                        <section>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <ShoppingBag className="h-6 w-6 text-primary" /> Shop by Category
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {allCategories.map(cat => (
                                    <div 
                                        key={cat.id} 
                                        onClick={() => {
                                            setSelectedCategory(cat.name);
                                            setViewMode('products');
                                        }}
                                        className="group cursor-pointer bg-white rounded-xl border hover:shadow-md transition-all p-4 flex flex-col items-center text-center gap-3"
                                    >
                                        <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                                            {cat.image ? (
                                                <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="h-8 w-8 text-gray-400" />
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Brands Section */}
                        <section>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <LayoutGrid className="h-6 w-6 text-primary" /> Shop by Brand
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {brands.map(brand => (
                                    <div 
                                        key={brand.id} 
                                        onClick={() => {
                                            setSelectedBrand(brand.id);
                                            setViewMode('products');
                                        }}
                                        className="group cursor-pointer bg-white rounded-xl border hover:shadow-md transition-all p-4 flex flex-col items-center text-center gap-3"
                                    >
                                        <div className="h-20 w-full flex items-center justify-center overflow-hidden">
                                             {brand.logo ? (
                                                <img src={brand.logo} alt={brand.name} className="max-h-16 max-w-full object-contain group-hover:scale-105 transition-transform" />
                                            ) : (
                                                <span className="text-xl font-bold text-gray-400">{brand.name[0]}</span>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800">{brand.name}</h3>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>
                ) : (
                    // PRODUCT LISTING VIEW (Existing Layout)
                    <div className="flex gap-8 items-start">
                        {/* Desktop Sidebar Filters */}
                        <div className="hidden md:block w-64 shrink-0 space-y-6 sticky top-36">
                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                    <h2 className="font-semibold text-lg mb-4">Filters</h2>
                                    <FilterContent />
                            </div>
                        </div>

                        {/* Product Grid */}
                        <div className="flex-1">
                            {loading && allProducts.length === 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <div key={i} className="space-y-4">
                                            <Skeleton className="h-[250px] w-full rounded-xl" />
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-lg border border-dashed">
                                    <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                                    <p className="text-gray-500 mt-1">Try adjusting your filters or search query.</p>
                                    <Button variant="link" onClick={resetFilters} className="mt-2 text-primary">Clear all filters</Button>
                                </div>
                            ) : (
                                    <>
                                    <div className="mb-4 flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground hover:text-foreground">
                                            <X className="h-4 w-4 mr-2" /> Clear Filters
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => {
                                                resetFilters();
                                                setViewMode('landing');
                                            }} 
                                            className="text-primary hover:text-primary/80"
                                        >
                                            <LayoutGrid className="h-4 w-4 mr-2" /> Back to Categories
                                        </Button>
                                        {(selectedCategory || selectedBrand || searchQuery) && (
                                            <span className="text-sm font-medium text-gray-600">
                                                Showing results for 
                                                {selectedCategory && <span className="text-primary ml-1">{selectedCategory}</span>}
                                                {selectedCategory && selectedBrand && <span className="mx-1">&</span>}
                                                {selectedBrand && <span className="text-primary ml-1">{brands.find(b => b.id === selectedBrand)?.name || 'Brand'}</span>}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                        {displayedProducts.map((product) => (
                                            <ProductCard key={product.id} product={product} />
                                        ))}
                                    </div>
                                    {hasMore && (
                                        <div className="mt-8 text-center">
                                                <Button onClick={loadMore} variant="secondary" size="lg">
                                                    Load More Products
                                                </Button>
                                        </div>
                                    )}
                                    </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </ShopLayout>
    );
};

export default ShopPage;
