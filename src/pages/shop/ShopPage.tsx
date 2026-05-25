import SEO from '@/components/SEO';
import { PauseAnnouncement } from '@/components/shop/PauseAnnouncement';
import { ProductCard } from '@/components/shop/ProductCard';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { HorizontalScroll } from '@/components/ui/horizontal-scroll';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { db } from '@/lib/firebase';
import { getBrands, getBrandsPaginated, getCategories, getProducts } from '@/services/shop';
import { Brand, Category, Product } from '@/types/shop';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Filter, Home, LayoutGrid, ShoppingBag, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';



const ShopPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Determine initial view mode based on URL
    const getInitialViewMode = () => {
        if (location.pathname === '/shop' && !location.search) return 'landing';
        return 'products';
    };

    // Data State (Paginated)
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLastDoc, setProductsLastDoc] = useState<any>(null);
    const [productsHasMore, setProductsHasMore] = useState(true);
    const [productsLoading, setProductsLoading] = useState(getInitialViewMode() === 'products');

    const [brandsList, setBrandsList] = useState<Brand[]>([]);
    const [brandsLastDoc, setBrandsLastDoc] = useState<any>(null);
    const [brandsHasMore, setBrandsHasMore] = useState(true);
    const [brandsLoading, setBrandsLoading] = useState(false);

    const [categoriesList, setCategoriesList] = useState<Category[]>([]);
    const [categoriesLastDoc, setCategoriesLastDoc] = useState<any>(null);
    const [categoriesHasMore, setCategoriesHasMore] = useState(true);
    const [categoriesLoading, setCategoriesLoading] = useState(false);

    // Refs for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null);
    const categoryObserverTarget = useRef<HTMLDivElement>(null);
    const brandObserverTarget = useRef<HTMLDivElement>(null);



    // Initial Filter Data (for dropdowns - limited fetch)
    const [filterBrands, setFilterBrands] = useState<Brand[]>([]);
    const [filterCategories, setFilterCategories] = useState<Category[]>([]);
    const [origins, setOrigins] = useState<{id: string, name: string}[]>([]);

    const PAGE_SIZE = 12;

    // Filters
    const [viewMode, setViewMode] = useState<'landing' | 'products'>(getInitialViewMode);
    
    // Initialize filter states from URL search params to avoid flashing empty state
    const getInitialParam = (key: string) => {
        const params = new URLSearchParams(window.location.search);
        return params.get(key);
    };

    const [searchQuery, setSearchQuery] = useState(getInitialParam('q') || '');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(getInitialParam('category') || null);
    const [landingPageSelectedCategory, setLandingPageSelectedCategory] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(getInitialParam('brand') || null);
    const [selectedOrigin, setSelectedOrigin] = useState<string | null>(getInitialParam('origin') || null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [spvRange, setSpvRange] = useState<[number, number]>([0, 5000]);
    const [sortBy, setSortBy] = useState<import('@/types/shop').FilterOptions['sort']>('order');

    // Filter Trigger (to reset pagination)
    const [filterTrigger, setFilterTrigger] = useState(0);

    // Initialize from URL params and Path
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('q') || '';
        const cat = params.get('category') || null;
        const brand = params.get('brand') || null;
        const origin = params.get('origin') || null;
        
        // Only update if actually different to avoid unnecessary triggers
        setSearchQuery(prev => prev !== search ? search : prev);
        setSelectedCategory(prev => prev !== cat ? cat : prev);
        setSelectedBrand(prev => prev !== brand ? brand : prev);
        setSelectedOrigin(prev => prev !== origin ? origin : prev);

        // Strict View Mode based on Path
        if (location.pathname === '/shop') {
            setViewMode('landing');
            if (search) {
                navigate(`/shop/filters?q=${search}`, { replace: true });
            }
        } else if (location.pathname.startsWith('/shop/filters') || location.pathname.startsWith('/shop/category') || location.pathname.startsWith('/shop/brand')) {
            setViewMode('products');
        }
    }, [location.pathname, location.search, navigate]);

    // Auto scroll to top on filter/navigation changes
useEffect(() => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth',
    });
}, [
    selectedCategory,
    selectedBrand,
    selectedOrigin,
    searchQuery,
    location.pathname,
    location.search,
]);

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
            // Redirect to slug version if currently using ID
            if (filterCategories.length > 0) {
                const cat = filterCategories.find(c => c.id === urlCategory || c.slug === urlCategory);
                if (cat?.slug && cat.slug !== urlCategory) {
                    navigate(`/shop/category/${cat.slug}`, { replace: true });
                    return;
                }
            }
            setSelectedCategory(urlCategory);
            setViewMode('products');
        } else if (urlBrand) {
            // Redirect to slug version if currently using ID
            if (filterBrands.length > 0) {
                const brand = filterBrands.find(b => b.id === urlBrand || b.slug === urlBrand);
                if (brand?.slug && brand.slug !== urlBrand) {
                    navigate(`/shop/brand/${brand.slug}`, { replace: true });
                    return;
                }
            }
            setSelectedBrand(urlBrand);
            setViewMode('products');
        }
    }, [urlCategory, urlBrand, navigate, filterCategories, filterBrands]);

    // Sync filters to URL params to preserve state on refresh and handle "redirection" better
    useEffect(() => {
        if (viewMode === 'landing' || location.pathname === '/shop') return;

        const params = new URLSearchParams();
        if (searchQuery) params.set('q', searchQuery);
        
        // Resolve Slugs for Category
        let categoryParam = selectedCategory;
        if (selectedCategory && filterCategories.length > 0) {
            const cat = filterCategories.find(c => c.id === selectedCategory || c.slug === selectedCategory);
            if (cat?.slug) categoryParam = cat.slug;
        }
        if (categoryParam) params.set('category', categoryParam);

        // Resolve Slugs for Brand
        let brandParam = selectedBrand;
        if (selectedBrand && filterBrands.length > 0) {
            const brand = filterBrands.find(b => b.id === selectedBrand || b.slug === selectedBrand);
            if (brand?.slug) brandParam = brand.slug;
        }
        if (brandParam) params.set('brand', brandParam);
        
        if (selectedOrigin) params.set('origin', selectedOrigin);
        
        const newSearch = params.toString();
        const currentSearch = location.search.startsWith('?') ? location.search.substring(1) : location.search;
        
        if (newSearch !== currentSearch && !urlCategory && !urlBrand) {
            navigate({
                pathname: '/shop/filters',
                search: newSearch ? `?${newSearch}` : ''
            }, { replace: true });
        }
    }, [searchQuery, selectedCategory, selectedBrand, selectedOrigin, viewMode, navigate, location.pathname, urlCategory, urlBrand, filterCategories, filterBrands]);

    // Initial Load for Filter Dropdowns
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [fetchedBrands, fetchedCategoriesData, fetchedOrigins] = await Promise.all([
                    getBrands(), 
                    getCategories(100), 
                    getDocs(query(collection(db, 'origins'), orderBy('name')))
                ]);
                
                setFilterBrands(fetchedBrands);
                setFilterCategories(fetchedCategoriesData.categories);
                setProductsLoading(false);
                setBrandsList(fetchedBrands); // Initialize brands list for landing view
                setCategoriesList(fetchedCategoriesData.categories); // Initialize categories list for landing view
                setOrigins(fetchedOrigins.docs.map(d => ({ id: d.id, name: d.data().name })));
            } catch (error) {
                console.error("Failed to load initial data", error);
                toast.error("Failed to load shop data");
            }
        };
        loadInitialData();
    }, []);


    // --- Products Fetching ---
    const fetchProducts = useCallback(async (isLoadMore = false, customLastDoc = null) => {
        setProductsLoading(true);
        try {
            const lastDoc = isLoadMore ? (customLastDoc || productsLastDoc) : null;
            
            // Build Filter Object
            const filterOptions: import('@/types/shop').FilterOptions = {
                category: selectedCategory === 'All' ? undefined : selectedCategory || undefined, 
                brand: selectedBrand === 'all' ? undefined : selectedBrand || undefined,
                includeInactive: false,
                sort: sortBy,
                minPrice: priceRange[0],
                maxPrice: priceRange[1],
                searchQuery: debouncedSearch || undefined
            };
            
            // Mapping slug to ID if needed
            const category = selectedCategory 
                ? filterCategories.find(c => c.slug === selectedCategory || c.id === selectedCategory) 
                : null;
            const categoryId = category?.id || selectedCategory || undefined;

            const brand = selectedBrand 
                ? filterBrands.find(b => b.slug === selectedBrand || b.id === selectedBrand) 
                : null;
            const brandId = brand?.id || selectedBrand || undefined;

            const constraints: import('@/types/shop').FilterOptions = {
                category: categoryId,
                brand: brandId,
                minPrice: priceRange[0],
                maxPrice: priceRange[1],
                sort: sortBy,
                includeInactive: false,
                searchQuery: debouncedSearch || undefined
            };

            const result = await getProducts(constraints, lastDoc, PAGE_SIZE);
            
            let newProducts = result.products;

            // CLIENT SIDE FILTERS (that backend misses)
            // 1. Origin
            // 2. SPV
            // Ideally we move these to backend or accept generic "Client Search" limitation.
            
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
            setProductsHasMore(!!result.lastDoc); // Approximation

        } finally {
            setProductsLoading(false);
        }
    // We remove productsLastDoc from dependencies to prevent infinite loops when it updates
    }, [
    debouncedSearch,
    selectedCategory,
    selectedBrand,
    selectedOrigin,
    priceRange,
    spvRange,
    sortBy,
    filterCategories,
    filterBrands
]);


    // --- Load More Wrapper ---
    const loadMoreProducts = () => {
        if (!productsLoading && productsHasMore) {
            fetchProducts(true, productsLastDoc);
        }
    };

    // Effect for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && productsHasMore && !productsLoading && viewMode === 'products') {
                    loadMoreProducts();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [productsHasMore, productsLoading, viewMode]);


    // --- Brands Fetching (Landing) ---
    const fetchBrandsData = useCallback(async (isLoadMore = false) => {
        setBrandsLoading(true);
        try {
            const lastDoc = isLoadMore ? brandsLastDoc : null;
            const result = await getBrandsPaginated(100, lastDoc); 
            
            if (isLoadMore) {
                setBrandsList(prev => [...prev, ...result.brands]);
            } else {
                setBrandsList(result.brands);
            }
            setBrandsLastDoc(result.lastDoc);
            setBrandsHasMore(result.brands.length >= 100);
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
            const result = await getCategories(100, lastDoc);
            
            if (isLoadMore) {
                setCategoriesList(prev => [...prev, ...result.categories]);
            } else {
                setCategoriesList(result.categories);
            }
            setCategoriesLastDoc(result.lastDoc);
            setCategoriesHasMore(result.categories.length >= 100);
        } catch (e) {
            console.error(e);
        } finally {
            setCategoriesLoading(false);
        }
    }, [categoriesLastDoc]);


    useEffect(() => {
    const loadData = async () => {
        try {

            // VERY IMPORTANT:
            // wait until categories/brands load
            // before resolving slug filters

            if (
                (selectedCategory && filterCategories.length === 0) ||
                (selectedBrand && filterBrands.length === 0)
            ) {
                return;
            }

            // Reset pagination
            setProducts([]);
            setProductsLastDoc(null);
            setProductsHasMore(true);

            // Landing data
            if (viewMode === 'landing') {
                await Promise.all([
                    fetchBrandsData(false),
                    fetchCategoriesData(false)
                ]);
            }

            // Fetch products
            await fetchProducts(false);

        } catch (error) {
            console.error('Failed loading shop data:', error);
        }
    };

    loadData();

}, [
    viewMode,
    filterTrigger,
    debouncedSearch,
    selectedCategory,
    selectedBrand,
    selectedOrigin,
    priceRange,
    spvRange,
    sortBy,
    filterCategories,
    filterBrands
]);

    

    const loadMoreBrands = () => {
        if (!brandsLoading && brandsHasMore) fetchBrandsData(true);
    };

    const loadMoreCategories = () => {
         if (!categoriesLoading && categoriesHasMore) fetchCategoriesData(true);
    };

    // Effect for Category Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && categoriesHasMore && !categoriesLoading && viewMode === 'landing') {
                    loadMoreCategories();
                }
            },
            { threshold: 0.1 }
        );

        if (categoryObserverTarget.current) {
            observer.observe(categoryObserverTarget.current);
        }

        return () => {
            if (categoryObserverTarget.current) {
                observer.unobserve(categoryObserverTarget.current);
            }
        };
    }, [categoriesHasMore, categoriesLoading, viewMode]);

    // Effect for Brand Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && brandsHasMore && !brandsLoading && viewMode === 'landing') {
                    loadMoreBrands();
                }
            },
            { threshold: 0.1 }
        );

        if (brandObserverTarget.current) {
            observer.observe(brandObserverTarget.current);
        }

        return () => {
            if (brandObserverTarget.current) {
                observer.unobserve(brandObserverTarget.current);
            }
        };
    }, [brandsHasMore, brandsLoading, viewMode]);

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
    
    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/shop/filters?q=${encodeURIComponent(searchQuery.trim())}`);
            setViewMode('products');
        }
    };

    const displayedFilterBrands = useMemo(() => {
        if (!selectedCategory || selectedCategory === 'All') return filterBrands;
        
        // Find category ID if selectedCategory is a slug/id
        const category = filterCategories.find(c => c.slug === selectedCategory || c.id === selectedCategory);
        const categoryId = category?.id || selectedCategory;

        return filterBrands.filter(brand => 
            brand.categoryIds?.includes(categoryId) || 
            brand.categoryId === categoryId
        );
    }, [filterBrands, selectedCategory, filterCategories]);

    const displayedLandingBrands = useMemo(() => {
        if (!landingPageSelectedCategory || landingPageSelectedCategory === 'All') return brandsList;
        return brandsList.filter(brand => 
            brand.categoryIds?.includes(landingPageSelectedCategory) || 
            brand.categoryId === landingPageSelectedCategory
        );
    }, [brandsList, landingPageSelectedCategory]);

    const categoryNames = useMemo(() => filterCategories.map(c => c.name), [filterCategories]);

    const FilterContent = () => (
        <div className="space-y-6">
            <div className="space-y-3">
    <h3 className="text-lg font-semibold">Categories</h3>

    {/* All Products */}
    <button
        onClick={() => {
            setSelectedBrand(null);
            setSelectedCategory(null);
        }}
        className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
            selectedCategory === null
                ? 'bg-primary text-white'
                : 'hover:bg-gray-100 text-gray-700'
        }`}
    >
        <span className="font-medium">All Products</span>

        <span
            className={`text-lg ${
                selectedCategory === null
                    ? 'text-white'
                    : 'text-gray-400'
            }`}
        >
            ›
        </span>
    </button>

    {/* Categories List */}
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {filterCategories.map((cat) => {
            const isActive =
                selectedCategory === cat.id ||
                selectedCategory === cat.slug;

            return (
                <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                        setSelectedBrand(null);
                        setSelectedCategory(cat.slug || cat.id);
                    }}
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
                        isActive
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                    {/* LEFT SIDE */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                            {cat.images?.[0] || cat.image ? (
                                <img
                                    src={cat.images?.[0] || cat.image}
                                    alt={cat.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-xs">
                                    📦
                                </div>
                            )}
                        </div>

                        <span className="font-medium text-left break-words">
                            {cat.name}
                        </span>
                    </div>

                    {/* RIGHT ARROW */}
                    <span
                        className={`text-lg ${
                            isActive
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                    >
                        ›
                    </span>
                </button>
            );
        })}
    </div>
</div>

            <div className="space-y-3">
    <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
            Brands
        </h3>

        {selectedCategory && (
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                Category Filter
            </span>
        )}
    </div>

    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {/* All Brands */}
        <button
            type="button"
            onClick={() => setSelectedBrand(null)}
            className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
                selectedBrand === null
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
            }`}
        >
            <span className="font-medium">
                All Brands
            </span>

            <span
                className={`text-lg ${
                    selectedBrand === null
                        ? 'text-white'
                        : 'text-gray-400'
                }`}
            >
                ›
            </span>
        </button>

        {displayedFilterBrands.map((brand) => {
            const isActive =
                selectedBrand === brand.id ||
                selectedBrand === brand.slug;

            return (
                <button
                    key={brand.id}
                    type="button"
                    onClick={() =>
                        setSelectedBrand(
                            brand.slug || brand.id
                        )
                    }
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
                        isActive
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                            {brand.images?.[0] || brand.logo ? (
                                <img
                                    src={
                                        brand.images?.[0] ||
                                        brand.logo
                                    }
                                    alt={brand.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    🏷️
                                </div>
                            )}
                        </div>

                        <span className="font-medium text-left break-words">
                            {brand.name}
                        </span>
                    </div>

                    <span
                        className={`text-lg ${
                            isActive
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                    >
                        ›
                    </span>
                </button>
            );
        })}
    </div>
</div>

           <div className="space-y-3">
    <h3 className="text-lg font-semibold">
        Place of Origin
    </h3>

    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        <button
            type="button"
            onClick={() => setSelectedOrigin(null)}
            className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
                selectedOrigin === null
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
            }`}
        >
            <span className="font-medium">
                All Origins
            </span>

            <span
                className={`text-lg ${
                    selectedOrigin === null
                        ? 'text-white'
                        : 'text-gray-400'
                }`}
            >
                ›
            </span>
        </button>

        {origins.map((origin) => {
            const isActive =
                selectedOrigin === origin.name;

            return (
                <button
                    key={origin.id}
                    type="button"
                    onClick={() =>
                        setSelectedOrigin(origin.name)
                    }
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
                        isActive
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                    <span className="font-medium text-left">
                        {origin.name}
                    </span>

                    <span
                        className={`text-lg ${
                            isActive
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                    >
                        ›
                    </span>
                </button>
            );
        })}
    </div>
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
        <ShopLayout 
            title="Shop" 
            onBack={() => {
                if (location.pathname !== '/shop') {
                    navigate('/shop');
                } else {
                    navigate('/');
                }
            }}
        >
            <SEO 
                title={debouncedSearch ? `Search results for "${debouncedSearch}"` : selectedCategory ? `Shop ${selectedCategory}` : selectedBrand ? `Shop ${filterBrands.find(b => b.id === selectedBrand)?.name || 'Brand'}` : 'Shop Premium Organic Products'}
                description="Browse our collection of premium sustainable products. Earn Surabhi Coins, Shipping Credits and support our community of farmers and gopalaks."
                keywords="organic products, a2 ghee, surabhi shop, sustainable shopping, farmer support, loyalty rewards"
            />
            <div className="flex flex-col gap-6">
                <PauseAnnouncement />
                
                {/* 1. Header & Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm sticky top-16 z-30">
                     <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Go Home" className="-ml-2">
                            <Home className="h-6 w-6" />
                     </Button>
                     <form onSubmit={onSearchSubmit} className="relative w-full md:w-96 flex gap-2">
                        <div className="relative flex-1">
                            {/* <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" /> */}
                            <Input 
                                placeholder="Search products..." 
                                className="pl-10 pr-4 h-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button type="submit" size="sm" className="h-10 px-4 shrink-0">
                            Search
                        </Button>
                    </form>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        {/* Mobile Filters Trigger - Visible only in Product View */}
                        {!isLandingPage && (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" className="md:hidden w-full">
                                        <Filter className="mr-2 h-4 w-4" /> Filters
                                    </Button>
                                </SheetTrigger>
                               <SheetContent
    side="left"
    className="w-[90vw] sm:w-[420px] overflow-y-auto"
> 
                                    <SheetHeader>
                                        <SheetTitle>Filters</SheetTitle>
                                    </SheetHeader>
                                    <div className="mt-4 pb-20">
    {FilterContent()}
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
                        <section className="pt-4">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <ShoppingBag className="h-6 w-6 text-primary" /> Shop by Category
                            </h2>
                            <HorizontalScroll 
   itemClassName="grid grid-rows-3 grid-flow-col gap-3 sm:gap-6 auto-cols-[32%] sm:auto-cols-[31%] pb-4"
>
                                {categoriesList.map(cat => (
                                    <div 
                                        key={cat.id} 
                                        onClick={() => {
                                            window.scrollTo(0, 0);
                                            navigate(`/shop/filters?category=${cat.slug || cat.id}`);
                                        }}
                                        className="group cursor-pointer bg-white rounded-xl border hover:shadow-md transition-all p-3 flex flex-col items-center text-center gap-2 group-hover:scale-[1.02] snap-start"
                                    >
                                        <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform shadow-inner">
                                            {cat.image ? (
                                                <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="h-6 w-6 text-gray-400" />
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-[10px] sm:text-sm line-clamp-2">{cat.name}</h3>
                                    </div>
                                ))}
                            </HorizontalScroll>
                        </section>

                        {/* Brands Section */}
                        <section className="pt-8 border-t border-gray-100">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <LayoutGrid className="h-6 w-6 text-primary" /> Shop by Brand
                                </h2>
                            </div>

                            <HorizontalScroll 
    itemClassName="grid grid-rows-3 grid-flow-col gap-3 sm:gap-6 auto-cols-[32%] sm:auto-cols-[31%] pb-4"
>
                                {displayedLandingBrands.map(brand => (
                                    <div 
                                        key={brand.id} 
                                        onClick={() => {
                                            window.scrollTo(0, 0);
                                            navigate(`/shop/filters?brand=${brand.slug || brand.id}`);
                                        }}
                                        className="group cursor-pointer bg-white rounded-xl border hover:shadow-md transition-all p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-3 group-hover:scale-[1.02] snap-start"
                                    >
                                        <div className="h-8 sm:h-14 w-full flex items-center justify-center overflow-hidden">
                                             {brand.logo ? (
                                                <img src={brand.logo} alt={brand.name} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <span className="text-xl font-bold text-gray-400">{brand.name[0]}</span>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-[9px] sm:text-xs line-clamp-2 px-2">{brand.name}</h3>
                                    </div>
                                ))}
                            </HorizontalScroll>
                        </section>

                        {/* Recent Products Section */}
                        <section className="mt-12">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <ShoppingBag className="h-6 w-6 text-primary" /> Recently Added
                                </h2>
                                <Button 
                                    variant="link" 
                                    className="text-primary font-bold"
                                    onClick={() => {
                                        navigate('/shop/filters');
                                        setViewMode('products');
                                    }}
                                >
                                    View All
                                </Button>
                            </div>
                            <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:gap-6 lg:overflow-visible">
                                {products.slice(0, 10).map((product) => (
                                    <div key={product.id} className="min-w-[280px] sm:min-w-[320px] lg:min-w-0 snap-start">
                                        <ProductCard product={product} />
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>
                ) : (
                    // PRODUCT LISTING VIEW
                    <div className="flex gap-8 items-start">
                        {/* Desktop Sidebar Filters */}
                        <div className="hidden lg:block w-[280px] shrink-0 sticky top-32">
    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b bg-orange-50">
            <h2 className="text-lg font-bold text-gray-900">
                All Categories
            </h2>
        </div>

        {/* Categories */}
        <div className="p-3 space-y-2 max-h-[75vh] overflow-y-auto">

            {/* All */}
            <button
                onClick={() => {
                    setSelectedCategory('');
                    setViewMode('products');
                }}
                className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all
                ${
                    !selectedCategory
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                }`}
            >
                <span className="font-medium">All Products</span>
            </button>

            {/* Categories */}
            {filterCategories.map((category) => (
                <button
                    key={category.id}
                    onClick={() => {
                       setSelectedCategory(category.slug || category.id); 
                        setViewMode('products');
                    }}
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all
                    ${
                       selectedCategory === category.id ||
                       selectedCategory === category.slug
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-3">

                        {/* Category Image */}
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                            {category.image ? (
                                <img
                                    src={category.image}
                                    alt={category.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-xs">
                                    📦
                                </div>
                            )}
                        </div>

                        {/* Name */}
                        <span className="font-medium text-left line-clamp-2">
                            {category.name}
                        </span>
                    </div>

                    <span
  className={`text-lg ${
    selectedCategory === category.id ||
    selectedCategory === category.slug
      ? 'text-white'
      : 'text-gray-400'
  }`}
>
                        ›
                    </span>
                </button>
            ))}

            {/* Brands */}
<div className="mt-6 border-t pt-4">
    <h3 className="px-2 mb-3 text-sm font-bold text-gray-500 uppercase tracking-wide">
        Brands
    </h3>

    <div className="space-y-2">
        <button
            onClick={() => {
                setSelectedBrand(null);
                setViewMode('products');
            }}
            className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                !selectedBrand
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
            }`}
        >
            <span className="font-medium">
                All Brands
            </span>

            <span className={!selectedBrand ? 'text-white' : 'text-gray-400'}>
                ›
            </span>
        </button>

        {filterBrands.map((brand) => (
            <button
                key={brand.id}
                onClick={() => {
                    setSelectedBrand(brand.slug || brand.id);
                    setViewMode('products');
                }}
                className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                    selectedBrand === brand.id ||
                    selectedBrand === brand.slug
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                }`}
            >
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {brand.images?.[0] || brand.logo ? (
                            <img
                                src={brand.images?.[0] || brand.logo}
                                alt={brand.name}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs">
                                🏷️
                            </div>
                        )}
                    </div>

                    <span className="font-medium text-left line-clamp-2">
                        {brand.name}
                    </span>
                </div>

                <span
                    className={`text-lg ${
                        selectedBrand === brand.id ||
                        selectedBrand === brand.slug
                            ? 'text-white'
                            : 'text-gray-400'
                    }`}
                >
                    ›
                </span>
            </button>
        ))}
    </div>
</div>

{/* Origins */}
<div className="mt-6 border-t pt-4">
    <h3 className="px-2 mb-3 text-sm font-bold text-gray-500 uppercase tracking-wide">
        Place of Origin
    </h3>

    <div className="space-y-2">
        <button
            onClick={() => {
                setSelectedOrigin(null);
                setViewMode('products');
            }}
            className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                !selectedOrigin
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
            }`}
        >
            <span className="font-medium">
                All Origins
            </span>

            <span className={!selectedOrigin ? 'text-white' : 'text-gray-400'}>
                ›
            </span>
        </button>

        {origins.map((origin) => (
            <button
                key={origin.id}
                onClick={() => {
                    setSelectedOrigin(origin.name);
                    setViewMode('products');
                }}
                className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                    selectedOrigin === origin.name
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                }`}
            >
                <span className="font-medium text-left">
                    {origin.name}
                </span>

                <span
                    className={`text-lg ${
                        selectedOrigin === origin.name
                            ? 'text-white'
                            : 'text-gray-400'
                    }`}
                >
                    ›
                </span>
            </button>
        ))}
    </div>
</div>
        </div>
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
                                        className="prose prose-sm text-gray-600 max-w-none overflow-hidden break-words"
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
                                                {selectedCategory && <span className="text-primary ml-1">{filterCategories.find(c => c.id === selectedCategory)?.name || 'Category'}</span>}
                                                {selectedCategory && selectedBrand && <span className="mx-1">&</span>}
                                                {selectedBrand && <span className="text-primary ml-1">{filterBrands.find(b => b.id === selectedBrand)?.name || 'Brand'}</span>}
                                                {selectedOrigin && <span className="mx-1">&</span>}
                                                {selectedOrigin && <span className="text-primary ml-1">{selectedOrigin}</span>}
                                            </span>
                                        )}
                                    </div>
                                   <div
  className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-6"
  style={{
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 1000px'
  }}
>
                                        {products.map((product) => (
                                            <ProductCard key={product.id} product={product} />
                                        ))}
                                    </div>
                                    
                                    {/* Infinite Scroll Trigger */}
                                    <div ref={observerTarget} className="h-20 flex items-center justify-center mt-4">
                                        {productsLoading && <LoadingSpinner size={32} />}
                                        {!productsHasMore && products.length > 0 && (
                                            <p className="text-muted-foreground text-sm">No more products to show.</p>
                                        )}
                                    </div>
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
