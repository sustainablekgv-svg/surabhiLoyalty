import { ProductCard } from '@/components/shop/ProductCard';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { db } from '@/lib/firebase';
import { getBrands, getBrandsPaginated, getCategories, getCategoriesPaginated, getProducts } from '@/services/shop';
import { Brand, Category, Product } from '@/types/shop';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Filter, Home, LayoutGrid, ShoppingBag, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const ShopPage = () => {
    const navigate = useNavigate();

    // Data State (Paginated)
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLastDoc, setProductsLastDoc] = useState<any>(null);
    const [productsHasMore, setProductsHasMore] = useState(true);
    const [productsLoading, setProductsLoading] = useState(false);

    const [brandsList, setBrandsList] = useState<Brand[]>([]);
    const [brandsLastDoc, setBrandsLastDoc] = useState<any>(null);
    const [brandsHasMore, setBrandsHasMore] = useState(true);
    const [brandsLoading, setBrandsLoading] = useState(false);

    const [categoriesList, setCategoriesList] = useState<Category[]>([]);
    const [categoriesLastDoc, setCategoriesLastDoc] = useState<any>(null);
    const [categoriesHasMore, setCategoriesHasMore] = useState(true);
    const [categoriesLoading, setCategoriesLoading] = useState(false);

    // Initial Filter Data (for dropdowns - limited fetch)
    const [filterBrands, setFilterBrands] = useState<Brand[]>([]);
    const [filterCategories, setFilterCategories] = useState<Category[]>([]);
    const [origins, setOrigins] = useState<{id: string, name: string}[]>([]);

    const PAGE_SIZE = 12;

    // Filters
    const [viewMode, setViewMode] = useState<'landing' | 'products'>('landing');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [spvRange, setSpvRange] = useState<[number, number]>([0, 5000]);
    const [sortBy, setSortBy] = useState<import('@/types/shop').FilterOptions['sort']>('order');

    // Filter Trigger (to reset pagination)
    const [filterTrigger, setFilterTrigger] = useState(0);

    const location = useLocation();

    // Initialize from URL params and Path
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('q');
        const cat = params.get('category');
        const brand = params.get('brand');
        const origin = params.get('origin');
        
        if (search) setSearchQuery(search);
        if (cat) setSelectedCategory(cat);
        if (brand) setSelectedBrand(brand);
        if (origin) setSelectedOrigin(origin);

        // Strict View Mode based on Path
        if (location.pathname === '/shop') {
            setViewMode('landing');
            // Clear filters when on landing, unless search is present (which might warrant a switch?)
            // User requested /shop is strictly categories/brands.
            // If search is present on /shop? Maybe redirect to /shop/filters?
            if (search) {
                navigate(`/shop/filters?q=${search}`, { replace: true });
            }
        } else if (location.pathname.startsWith('/shop/filters') || location.pathname.startsWith('/shop/category') || location.pathname.startsWith('/shop/brand')) {
            setViewMode('products');
        }
    }, [location.pathname, location.search, navigate]);

    // Debounce search query
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            // Auto-switch to products if user types search
            if (searchQuery) {
                 // If on landing page and searching, we might want to navigate to filters?
                 // But for now, let's just allow viewMode switch if the user is already on a page that supports it?
                 // Actually the previous logic just set viewMode.
                 // If we are strictly on /shop, we might want to navigate to /shop/filters?q=...
                 // But let's keep it simple: if search query exists, we assume we want to see products.
                 // However, if we enforce strict routing, we should navigate.
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { categoryName: urlCategory, brandId: urlBrand } = useParams<{ categoryName?: string, brandId?: string }>();

    // Effect: Handle URL Params for Categories/Brands routes
    useEffect(() => {
        if (urlCategory) {
            setSelectedCategory(urlCategory);
            setViewMode('products');
        } else if (urlBrand) {
            setSelectedBrand(urlBrand);
            setViewMode('products');
        }
    }, [urlCategory, urlBrand]);

    // Initial Load for Filter Dropdowns
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [fetchedBrands, fetchedCategoriesData, fetchedOrigins] = await Promise.all([
                    getBrands(), // Fetch all/many for dropdowns
                    getCategories(200), // Fetch many for dropdowns
                    getDocs(query(collection(db, 'origins'), orderBy('name')))
                ]);
                
                setFilterBrands(fetchedBrands);
                setFilterCategories(fetchedCategoriesData.categories);
                setOrigins(fetchedOrigins.docs.map(d => ({ id: d.id, name: d.data().name })));
            } catch (error) {
                console.error("Failed to load initial data", error);
                toast.error("Failed to load shop data");
            }
        };
        loadInitialData();
    }, []);


    // --- Products Fetching ---
    const fetchProducts = useCallback(async (isLoadMore = false) => {
        setProductsLoading(true);
        try {
            const lastDoc = isLoadMore ? productsLastDoc : null;
            
            // Build Filter Object
            const filterOptions = {
                category: selectedCategory === 'All' ? undefined : selectedCategory || undefined, // Note: selectedCategory stores Name string currently for UI match? 
                // Ah, wait. selectedCategory state stores NAME string in current UI, but backend expects ID usually. 
                // Let's check FilterContent. It sets NAME. 
                // getProducts expects ID generally, but let's check services/shop.ts.
                // getProducts: `where('categoryId', '==', filters.category)` -> Expects ID.
                // WE NEED TO FIX THIS MAPPING. Dropdowns should use ID, UI can show Name.
                
                // Let's fix selectedCategory to be ID based or map it.
                // Current UI uses IDs for Brands/Origins but Name for Category buttons?
                // Let's map Name to ID if needed, or better, store ID.
                
                // FIX: map selectedCategory (Name) to ID if possible from filterCategories
                // Actually, `filterCategories` has IDs. 
                
                brand: selectedBrand === 'all' ? undefined : selectedBrand || undefined,
                includeInactive: false,
                sort: sortBy,
                minPrice: priceRange[0],
                maxPrice: priceRange[1],
                // Origin filter isn't in getProducts yet? confirmed: it is NOT.
                // We'll Client Filter for Origin/SPV/Search if backend doesn't support it?
                // Or update backend. Implementation plan said "Use getProducts with lastDoc". 
                // getProducts DOES support price headers.
                
                // Search: Firestore has no partial search. We might need Client Side filtering on the PAGE_SIZE chunk?
                // Or just do name prefix match if we added it?
                // Let's assume for now we use what we have. 
            };
            
            // Hack: Map Category ID
            let catId = undefined;
            if (selectedCategory) {
                 const found = filterCategories.find(c => c.name === selectedCategory);
                 if (found) catId = found.id;
            }

            const constraints = {
                // ...filterOptions,
                category: catId,
                brand: selectedBrand === 'all' ? undefined : selectedBrand || undefined,
                minPrice: priceRange[0],
                maxPrice: priceRange[1],
                sort: sortBy,
                includeInactive: false,
                inStock: true // optional?
            };

            const result = await getProducts(constraints, lastDoc, PAGE_SIZE);
            
            let newProducts = result.products;

            // CLIENT SIDE FILTERS (that backend misses)
            // 1. Search (Name/Description) - This breaks pagination if filtered out heavily...
            // 2. Origin
            // 3. SPV
            // Ideally we move these to backend or accept generic "Client Search" limitation.
            
            if (debouncedSearch) {
                const lower = debouncedSearch.toLowerCase();
                newProducts = newProducts.filter(p => 
                    p.name.toLowerCase().includes(lower) || 
                    p.description?.toLowerCase().includes(lower)
                );
            }

             if (selectedOrigin && selectedOrigin !== 'all') {
                newProducts = newProducts.filter(p => p.placeOfOrigin?.includes(selectedOrigin));
            }
            
            if (spvRange[1] < 5000 || spvRange[0] > 0) {
                 newProducts = newProducts.filter(p => {
                    const val = p.spv || 0;
                    return val >= spvRange[0] && val <= spvRange[1];
                });
            }


            if (isLoadMore) {
                setProducts(prev => [...prev, ...newProducts]);
            } else {
                setProducts(newProducts);
            }
            
            setProductsLastDoc(result.lastDoc);
            setProductsHasMore(result.products.length >= PAGE_SIZE); // Approximation

        } catch (error) {
            console.error("Fetch products error", error);
            toast.error("Error loading products");
        } finally {
            setProductsLoading(false);
        }
    }, [debouncedSearch, selectedCategory, selectedBrand, selectedOrigin, priceRange, spvRange, sortBy, productsLastDoc, filterCategories]);


    // --- Brands Fetching (Landing) ---
    const fetchBrandsData = useCallback(async (isLoadMore = false) => {
        setBrandsLoading(true);
        try {
            const lastDoc = isLoadMore ? brandsLastDoc : null;
            const result = await getBrandsPaginated(20, lastDoc); // 20 per page for grid
            
            if (isLoadMore) {
                setBrandsList(prev => [...prev, ...result.brands]);
            } else {
                setBrandsList(result.brands);
            }
            setBrandsLastDoc(result.lastDoc);
            setBrandsHasMore(result.brands.length >= 20);
        } catch (e) {
            console.error(e);
        } finally {
            setBrandsLoading(false);
        }
    }, [brandsLastDoc]);

    // --- Categories Fetching (Landing) ---
    const fetchCategoriesData = useCallback(async (isLoadMore = false) => {
        setCategoriesLoading(true);
        try {
            const lastDoc = isLoadMore ? categoriesLastDoc : null;
            const result = await getCategoriesPaginated(20, lastDoc);
            
            if (isLoadMore) {
                setCategoriesList(prev => [...prev, ...result.categories]);
            } else {
                setCategoriesList(result.categories);
            }
            setCategoriesLastDoc(result.lastDoc);
            setCategoriesHasMore(result.categories.length >= 20);
        } catch (e) {
            console.error(e);
        } finally {
            setCategoriesLoading(false);
        }
    }, [categoriesLastDoc]);


    // Effect: Fetch Data on View Change or Filter Change
    useEffect(() => {
        if (viewMode === 'landing') {
            fetchBrandsData(false);
            fetchCategoriesData(false);
        } else {
            fetchProducts(false);
        }
    }, [viewMode, filterTrigger, debouncedSearch, selectedCategory, selectedBrand, selectedOrigin, priceRange, spvRange, sortBy]); 
    // Note: Including dependencies here triggers re-fetch. 
    // filterTrigger is a manual way to force refetch if needed, but deps cover it.

    
    const loadMoreProducts = () => {
        if (!productsLoading && productsHasMore) fetchProducts(true);
    };

    const loadMoreBrands = () => {
        if (!brandsLoading && brandsHasMore) fetchBrandsData(true);
    };

    const loadMoreCategories = () => {
         if (!categoriesLoading && categoriesHasMore) fetchCategoriesData(true);
    };

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCategory(null);
        setSelectedBrand(null);
        setSelectedOrigin(null);
        setPriceRange([0, 10000]);
        setSpvRange([0, 5000]);
        setSortBy('order');
        // Do NOT switch back to landing view automatically
        navigate('/shop');
    };

    const categoryNames = useMemo(() => filterCategories.map(c => c.name), [filterCategories]);

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
                        {filterBrands.map(brand => (
                            <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">Place of Origin</h3>
                <Select value={selectedOrigin || "all"} onValueChange={(val) => setSelectedOrigin(val === "all" ? null : val)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Origin" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Origins</SelectItem>
                        {origins.map(origin => (
                            <SelectItem key={origin.id} value={origin.name}>{origin.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">Price Range</h3>
                <div className="flex items-center gap-2 mb-2">
                    <Input 
                        type="number" 
                        value={priceRange[0]} 
                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                        className="h-8 text-xs"
                        min={0}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                        type="number" 
                        value={priceRange[1]} 
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="h-8 text-xs"
                        min={0}
                    />
                </div>
                <Slider
                    defaultValue={[0, 10000]}
                    max={10000}
                    step={100}
                    value={priceRange}
                    onValueChange={(val) => setPriceRange(val as [number, number])}
                />
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">SPV Range (Coins)</h3>
                <div className="flex items-center gap-2 mb-2">
                    <Input 
                        type="number" 
                        value={spvRange[0]} 
                        onChange={(e) => setSpvRange([Number(e.target.value), spvRange[1]])}
                        className="h-8 text-xs"
                        min={0}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                        type="number" 
                        value={spvRange[1]} 
                        onChange={(e) => setSpvRange([spvRange[0], Number(e.target.value)])}
                        className="h-8 text-xs"
                        min={0}
                    />
                </div>
                <Slider
                    defaultValue={[0, 5000]}
                    max={5000}
                    step={50}
                    value={spvRange}
                    onValueChange={(val) => setSpvRange(val as [number, number])}
                />
            </div>
             <Button variant="outline" className="w-full" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
        </div>
    );

    const isLandingPage = viewMode === 'landing';

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
                        
                        {/* Sort Dropdown */}
                        {!isLandingPage && (
                            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
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
                                {categoriesList.map(cat => (
                                    <div 
                                        key={cat.id} 
                                        onClick={() => {
                                            navigate(`/shop/filters?category=${cat.name}`);
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
                            {categoriesHasMore && (
                                <div className="mt-4 text-center">
                                    <Button onClick={loadMoreCategories} variant="ghost" disabled={categoriesLoading}>
                                        {categoriesLoading ? <LoadingSpinner size={20} /> : 'Load More Categories'}
                                    </Button>
                                </div>
                            )}
                        </section>

                        {/* Brands Section */}
                        <section>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <LayoutGrid className="h-6 w-6 text-primary" /> Shop by Brand
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {brandsList.map(brand => (
                                    <div 
                                        key={brand.id} 
                                        onClick={() => {
                                            navigate(`/shop/filters?brand=${brand.id}`);
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
                            {brandsHasMore && (
                                <div className="mt-4 text-center">
                                    <Button onClick={loadMoreBrands} variant="ghost" disabled={brandsLoading}>
                                        {brandsLoading ? <LoadingSpinner size={20} /> : 'Load More Brands'}
                                    </Button>
                                </div>
                            )}
                        </section>

                    </div>
                ) : (
                    // PRODUCT LISTING VIEW
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
                            {/* Brand Description Header */}
                            {selectedBrand && filterBrands.find(b => b.id === selectedBrand)?.description && (
                                <div className="mb-6 bg-white p-6 rounded-lg border shadow-sm">
                                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                                        {filterBrands.find(b => b.id === selectedBrand)?.name}
                                    </h2>
                                    <div 
                                        className="prose prose-sm text-gray-600 max-w-none"
                                        dangerouslySetInnerHTML={{ __html: filterBrands.find(b => b.id === selectedBrand)?.description || '' }}
                                    />
                                </div>
                            )}

                            {productsLoading && products.length === 0 ? (
                                <div className="min-h-[40vh] flex items-center justify-center">
                                    <LoadingSpinner size={40} />
                                </div>
                            ) : products.length === 0 ? (
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
                                                {selectedBrand && <span className="text-primary ml-1">{filterBrands.find(b => b.id === selectedBrand)?.name || 'Brand'}</span>}
                                                {selectedOrigin && <span className="mx-1">&</span>}
                                                {selectedOrigin && <span className="text-primary ml-1">{selectedOrigin}</span>}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                        {products.map((product) => (
                                            <ProductCard key={product.id} product={product} />
                                        ))}
                                    </div>
                                    {productsHasMore && (
                                        <div className="mt-8 text-center">
                                                <Button onClick={loadMoreProducts} variant="secondary" size="lg" disabled={productsLoading}>
                                                    {productsLoading ? <LoadingSpinner size={20} /> : 'Load More Products'}
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
