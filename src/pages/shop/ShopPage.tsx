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
import { Filter, Home, LayoutGrid, ShoppingBag,MapPinned, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { statesList } from "@/constants/states";



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
   const [origins, setOrigins] = useState<{
  id: string;
  name: string;
  state: string;
  stateSlug: string;
  stateImage?: string;
}[]>([]);

    const PAGE_SIZE = 150;

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
    const [selectedState, setSelectedState] = useState<string | null>(getInitialParam('state') || null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [spvRange, setSpvRange] = useState<[number, number]>([0, 5000]);
    const [sortBy, setSortBy] = useState<import('@/types/shop').FilterOptions['sort']>('order');

    const [openMobileProductId, setOpenMobileProductId] =
  useState<string | null>(null);

    // Filter Trigger (to reset pagination)
    const [filterTrigger, setFilterTrigger] = useState(0);
   

    // Initialize from URL params and Path
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('q') || '';
        const cat = params.get('category') || null;
        const brand = params.get('brand') || null;
        const origin = params.get('origin') || null;
        const state = params.get('state') || null;
      
        
        // Only update if actually different to avoid unnecessary triggers
        setSearchQuery(prev => prev !== search ? search : prev);
        setSelectedCategory(prev => prev !== cat ? cat : prev);
        setSelectedBrand(prev => prev !== brand ? brand : prev);
        setSelectedOrigin(prev => prev !== origin ? origin : prev);
        setSelectedState(prev => prev !== state ? state : prev);

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
    selectedState,
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
        if (selectedState) params.set('state', selectedState);
        
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
 setOrigins(
  fetchedOrigins.docs.map(d => ({
    id: d.id,
    name: d.data().name,
    state: d.data().state || '',
    stateSlug: (d.data().stateSlug || '')
      .toLowerCase()
      .trim(),
    stateImage: d.data().stateImage || ''
  }))
);
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


// DEBUG LOGS




let newProducts = result.products;

            // CLIENT SIDE FILTERS (that backend misses)
            // 1. Origin
            // 2. SPV
            // Ideally we move these to backend or accept generic "Client Search" limitation.
            
const normalize = (str: string = "") =>
  str
    .toLowerCase()
    .trim()
    .replace(/,/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");


// STATE FILTER
if (selectedState) {

   
  const stateOrigins = origins
    .filter(origin => origin.stateSlug?.toLowerCase().trim() ===
selectedState?.toLowerCase().trim())
    .map(origin => normalize(origin.name));


  if (selectedState) {
 
}

  newProducts = newProducts.filter(product => {
    const productOrigins = (product.placeOfOrigin || [])
      .map(origin => normalize(origin));

    return productOrigins.some(productOrigin =>
  stateOrigins.some(stateOrigin => {
    const p = normalize(productOrigin);
    const s = normalize(stateOrigin);

    return (
      p === s ||
      p.includes(s) ||
      s.includes(p)
    );
  })
);
  });

}


// ORIGIN FILTER
if (selectedOrigin) {
  const selected = normalize(selectedOrigin);



  newProducts = newProducts.filter(product => {
    const productOrigins = (product.placeOfOrigin || [])
      .map(origin => normalize(origin));

    return productOrigins.some(productOrigin =>
      productOrigin.includes(selected) ||
      selected.includes(productOrigin)
    );
  });


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
    selectedState,
    priceRange,
    spvRange,
    sortBy,
    filterCategories,
    filterBrands,
    origins,
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
await fetchProducts(false);
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
    selectedState,
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
        setSelectedState(null);
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

    const toggleCategory = (categorySlugOrId: string) => {
        setSelectedCategory(prev => {
            const isCurrent = prev === categorySlugOrId;
            if (isCurrent) {
                setSelectedBrand(null);
                return null;
            }
            return categorySlugOrId;
        });
        setViewMode('products');
    };

    const toggleBrand = (brandSlugOrId: string) => {
        setSelectedBrand(prev => {
            const isCurrent = prev === brandSlugOrId;
            return isCurrent ? null : brandSlugOrId;
        });
        setViewMode('products');
    };

    const toggleOrigin = (originName: string) => {
        setSelectedOrigin(prev => {
            const isCurrent = prev === originName;
            return isCurrent ? null : originName;
        });
        setViewMode('products');
    };
    const filteredOrigins = selectedState
  ? origins.filter(
      origin => origin.stateSlug?.toLowerCase().trim() ===
selectedState?.toLowerCase().trim()
    )
  : origins;
const uniqueStates = useMemo(() => {
  const map = new Map();

  origins.forEach(origin => {
    if (!map.has(origin.stateSlug)) {
      map.set(origin.stateSlug, {
        name: origin.state,
        slug: origin.stateSlug,
        image: origin.stateImage || ''
      });
    }
  });

  return Array.from(map.values());
}, [origins]);
  const statesWithImages = useMemo(() => {
  return statesList.map((state) => {
    const stateData = origins
  .filter(
    (o) =>
      o.stateSlug?.toLowerCase().trim() ===
      state.slug.toLowerCase().trim()
  )
  .find((o) => o.stateImage);
    return {
  ...state,
  image: stateData?.stateImage || ""
};
  });
}, [origins]);

console.log("statesWithImages", statesWithImages);
    const FilterContent = () => (
        <div className="space-y-6">
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide px-2">Categories</h3>

                {/* All Products */}
                <button
                    onClick={() => {
                        setSelectedCategory(null);
                        setSelectedBrand(null);
                        setViewMode('products');
                    }}
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-200 ${
                        selectedCategory === null
                            ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                            : 'hover:bg-gray-50 text-gray-500'
                    }`}
                >
                    <span className="text-sm font-semibold">All Categories</span>
                    {selectedCategory === null && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">Active</span>}
                </button>

                {/* Categories List */}
                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                    {filterCategories.map((cat) => {
                        const isActive = selectedCategory === cat.id || selectedCategory === cat.slug;

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => toggleCategory(cat.slug || cat.id)}
                                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary text-white font-semibold shadow-sm scale-[1.01]'
                                        : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg overflow-hidden bg-gray-100 shrink-0 shadow-inner">
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

                                    <span className="text-xs text-left truncate font-medium">
                                        {cat.name}
                                    </span>
                                </div>

                                {isActive ? (
                                    <X className="h-3.5 w-3.5 text-white/80 hover:text-white" />
                                ) : (
                                    <span className="text-sm text-gray-400">›</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Brands</h3>
                    {selectedCategory && (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Filtered
                        </span>
                    )}
                </div>

                {/* All Brands button */}
                <button
                    onClick={() => {
                        setSelectedBrand(null);
                        setViewMode('products');
                    }}
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-200 ${
                        selectedBrand === null
                            ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                            : 'hover:bg-gray-50 text-gray-500'
                    }`}
                >
                    <span className="text-sm font-semibold">All Brands</span>
                    {selectedBrand === null && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">Active</span>}
                </button>

                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                    {displayedFilterBrands.map((brand) => {
                        const isActive = selectedBrand === brand.id || selectedBrand === brand.slug;

                        return (
                            <button
                                key={brand.id}
                                type="button"
                                onClick={() => toggleBrand(brand.slug || brand.id)}
                                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary text-white font-semibold shadow-sm scale-[1.01]'
                                        : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg overflow-hidden bg-gray-100 shrink-0 shadow-inner">
                                        {brand.images?.[0] || brand.logo ? (
                                            <img
                                                src={brand.images?.[0] || brand.logo}
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

                                    <span className="text-xs text-left truncate font-medium">
                                        {brand.name}
                                    </span>
                                </div>

                                {isActive ? (
                                    <X className="h-3.5 w-3.5 text-white/80 hover:text-white" />
                                ) : (
                                    <span className="text-sm text-gray-400">›</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-2">Place of Origin</h3>

                {/* All Origins button */}
                <div className="space-y-2 mb-4">
  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-2">
    State
  </h3>

  <Select
    value={selectedState || "all"}
    onValueChange={(value) => {
      setSelectedState(value === "all" ? null : value);
      setSelectedOrigin(null);
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select State" />
    </SelectTrigger>

    <SelectContent>
      <SelectItem value="all">All States</SelectItem>

      {uniqueStates.map((state) => (
        <SelectItem
          key={state.slug}
          value={state.slug}
        >
          {state.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                    {filteredOrigins.map((origin) => {
                        const isActive = selectedOrigin === origin.name;

                        return (
                            <button
                                key={origin.id}
                                type="button"
                                onClick={() => toggleOrigin(origin.name)}
                                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary text-white font-semibold shadow-sm scale-[1.01]'
                                        : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <span className="text-xs text-left truncate font-medium px-1">
                                    {origin.name}
                                </span>

                                {isActive ? (
                                    <X className="h-3.5 w-3.5 text-white/80 hover:text-white" />
                                ) : (
                                    <span className="text-sm text-gray-400">›</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100 px-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Price Range</h3>
                <div className="flex items-center gap-2 mb-2">
                    <Input 
                        type="number" 
                        value={priceRange[0]} 
                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                        className="h-8 text-xs rounded-lg"
                        min={0}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                        type="number" 
                        value={priceRange[1]} 
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="h-8 text-xs rounded-lg"
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

            <div className="space-y-3 pt-4 border-t border-gray-100 px-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">SPV Range (Coins)</h3>
                <div className="flex items-center gap-2 mb-2">
                    <Input 
                        type="number" 
                        value={spvRange[0]} 
                        onChange={(e) => setSpvRange([Number(e.target.value), spvRange[1]])}
                        className="h-8 text-xs rounded-lg"
                        min={0}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                        type="number" 
                        value={spvRange[1]} 
                        onChange={(e) => setSpvRange([spvRange[0], Number(e.target.value)])}
                        className="h-8 text-xs rounded-lg"
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
            
            <Button variant="outline" className="w-full rounded-xl mt-4 border-red-100 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-gray-500" onClick={resetFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Clear All Filters
            </Button>
        </div>
    );
const activeChips = useMemo(() => {
  const chips: {
    id: string;
    label: string;
    onClear: () => void;
  }[] = [];

  if (debouncedSearch) {
    chips.push({
      id: "search",
      label: `Search: "${debouncedSearch}"`,
      onClear: () => setSearchQuery(""),
    });
  }

  if (selectedCategory) {
    const cat = filterCategories.find(
      (c) =>
        c.id === selectedCategory ||
        c.slug === selectedCategory
    );

    chips.push({
      id: "category",
      label: `Category: ${cat?.name || "Category"}`,
      onClear: () => setSelectedCategory(null),
    });
  }

  if (selectedBrand) {
    const brand = filterBrands.find(
      (b) =>
        b.id === selectedBrand ||
        b.slug === selectedBrand
    );

    chips.push({
      id: "brand",
      label: `Brand: ${brand?.name || "Brand"}`,
      onClear: () => setSelectedBrand(null),
    });
  }

  // ✅ STATE CHIP
  if (selectedState) {
    const state = statesList.find(
      (s) => s.slug === selectedState
    );

    chips.push({
      id: "state",
      label: `State: ${state?.name || selectedState}`,
      onClear: () => {
        setSelectedState(null);
        setSelectedOrigin(null);
      },
    });
  }

  // ✅ ORIGIN CHIP
  if (selectedOrigin) {
    chips.push({
      id: "origin",
      label: `Origin: ${selectedOrigin}`,
      onClear: () => setSelectedOrigin(null),
    });
  }

  if (priceRange[0] > 0 || priceRange[1] < 10000) {
    chips.push({
      id: "price",
      label: `Price: ₹${priceRange[0]} - ₹${priceRange[1]}`,
      onClear: () => setPriceRange([0, 10000]),
    });
  }

  if (spvRange[0] > 0 || spvRange[1] < 5000) {
    chips.push({
      id: "spv",
      label: `SPV: ${spvRange[0]} - ${spvRange[1]} Coins`,
      onClear: () => setSpvRange([0, 5000]),
    });
  }

  return chips;
}, [
  debouncedSearch,
  selectedCategory,
  selectedBrand,
  selectedState, // ✅ added
  selectedOrigin,
  priceRange,
  spvRange,
  filterCategories,
  filterBrands,
]);

const groupedProducts = useMemo(() => {
  const families = new Map<
    string,
    {
      main: Product;
      variants: Product[];
    }
  >();

  products.forEach((product) => {


    const key =
      product.productFamily ||
      product.id;

    const existing =
      families.get(key);

    if (!existing) {
      families.set(key, {
        main: product,
        variants: [product]
      });

      return;
    }

    existing.variants.push(product);

    const currentPrice =
      product.sellingPrice ||
      product.price;

    const existingPrice =
      existing.main.sellingPrice ||
      existing.main.price;

    if (currentPrice < existingPrice) {
      existing.main = product;
    }
  });

  return Array.from(
    families.values()
  ).map((family) => ({
    
    ...family.main,
    variants: family.variants.sort(
      (a, b) =>
        (a.weightInKg || 0) -
        (b.weightInKg || 0)
    )
  }));
}, [products]);

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
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-3 sm:p-4 rounded-2xl border shadow-sm sticky top-14 md:top-16 z-30 backdrop-blur-md bg-white/95">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                         <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Go Home" className="h-10 w-10 hover:bg-gray-100 rounded-xl">
                                <Home className="h-5 w-5 text-gray-600" />
                         </Button>
                         <form onSubmit={onSearchSubmit} className="relative flex-1 max-w-md flex gap-2">
                            <div className="relative flex-1">
                                <Input 
                                    placeholder="Search products..." 
                                    className="pl-3 pr-8 h-10 text-sm rounded-xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button 
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                    
                    <div className="flex items-center gap-2 justify-end shrink-0">
                        {/* Mobile Filters Trigger - Visible only in Product View */}
                        {!isLandingPage && (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" className="lg:hidden h-10 px-3 rounded-xl flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-gray-200">
                                        <Filter className="h-4 w-4" /> 
                                        <span>Filters</span>
                                        {activeChips.length > 0 && (
                                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse ml-0.5" />
                                        )}
                                    </Button>
                                </SheetTrigger>
                                <SheetContent
                                    side="left"
                                    className="w-[90vw] sm:w-[380px] overflow-y-auto p-6"
                                > 
                                    <SheetHeader className="mb-4">
                                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                                            <Filter className="h-5 w-5 text-primary" /> Filters
                                        </SheetTitle>
                                    </SheetHeader>
                                    <div className="pb-10">
                                        {FilterContent()}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        )}
                        
                        {/* Sort Dropdown */}
                        {!isLandingPage && (
                            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
                                <SelectTrigger className="w-[140px] sm:w-[160px] h-10 rounded-xl text-sm font-semibold text-gray-700 border-gray-200">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="order">Default Sort</SelectItem>
                                    <SelectItem value="price_asc">Price: Low-High</SelectItem>
                                    <SelectItem value="price_desc">Price: High-Low</SelectItem>
                                    <SelectItem value="spv_asc">SPV: Low-High</SelectItem>
                                    <SelectItem value="spv_desc">SPV: High-Low</SelectItem>
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
                        
                        {/* Shop By State */}
<section className="pt-4">
  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
    <MapPinned className="h-6 w-6 text-primary" />
    Shop by State
  </h2>

  <HorizontalScroll
    itemClassName="grid grid-rows-3 grid-flow-col gap-3 sm:gap-6 auto-cols-[32%] sm:auto-cols-[31%] pb-4"
  >
    {statesWithImages .map((state) => (
      <div
        key={state.id}
        onClick={() => {
          window.scrollTo(0, 0);
          navigate(`/shop/filters?state=${state.slug}`);
        }}
        className="group cursor-pointer bg-white rounded-xl border hover:shadow-md transition-all p-3 flex flex-col items-center text-center gap-2 group-hover:scale-[1.02] snap-start"
      >
    <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
  {state.image ? (
    <img
      src={state.image}
      alt={state.name}
      className="h-full w-full object-cover"
    />
    
  ) : (<><MapPinned className="h-7 w-7 text-primary" />
  <p className="text-xs">{state.image ? "HAS IMAGE" : "NO IMAGE"}</p>
  </>
    
    
  )}
</div>

        <h3 className="font-semibold text-gray-800 text-[10px] sm:text-sm line-clamp-2">
          {state.name}
        </h3>
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
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {/* Desktop Sidebar Filters */}
                        <div className="hidden lg:block w-[300px] shrink-0 sticky top-24 self-start bg-white rounded-3xl border shadow-sm p-6 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
                            <div className="flex items-center justify-between mb-6 pb-2 border-b">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Filter className="h-5 w-5 text-primary" /> Filters
                                </h2>
                                {activeChips.length > 0 && (
                                    <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors">
                                        Clear All
                                    </button>
                                )}
                            </div>
                            {FilterContent()}
                        </div>

                        {/* Product Grid Area */}
                        <div className="flex-1 w-full">
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
                                    {/* Active Filter Chips */}
                                    {activeChips.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 mb-5 bg-white p-3 rounded-2xl border shadow-sm">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 px-1">Active:</span>
                                            {activeChips.map(chip => (
                                                <div 
                                                    key={chip.id} 
                                                    className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full pl-3 pr-1.5 py-1 text-xs font-semibold shadow-sm transition-all hover:bg-primary/15"
                                                >
                                                    <span>{chip.label}</span>
                                                    <button 
                                                        onClick={chip.onClear} 
                                                        className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors shrink-0"
                                                        title="Remove filter"
                                                    >
                                                        <X className="h-2.5 w-2.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={resetFilters} 
                                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full h-8 px-3 ml-auto font-bold"
                                            >
                                                Clear All
                                            </Button>
                                        </div>
                                    )}

                                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => {
                                                    resetFilters();
                                                    setViewMode('landing');
                                                }} 
                                                className="text-xs font-semibold text-gray-600 hover:text-primary hover:bg-primary/5 rounded-xl h-9 border-gray-200"
                                            >
                                                <LayoutGrid className="h-4 w-4 mr-1.5" /> Back to Categories
                                            </Button>
                                            {activeChips.length > 0 && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={resetFilters} 
                                                    className="text-xs font-semibold text-red-500 hover:bg-red-50 rounded-xl h-9"
                                                >
                                                    <X className="h-4 w-4 mr-1.5" /> Clear Filters
                                                </Button>
                                            )}
                                        </div>
                                        
                                        {groupedProducts.length > 0 && (
    <span className="text-xs font-semibold text-gray-500">
        Showing {groupedProducts.length} product{groupedProducts.length !== 1 ? 's' : ''}
    </span>
)}
                                    </div>
                                   <div
  className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-6 overflow-visible"
>
                                        {groupedProducts.map((product) => (
  <ProductCard
    key={product.id}
    product={product}
    openMobileProductId={openMobileProductId}
    setOpenMobileProductId={setOpenMobileProductId}
  />
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
