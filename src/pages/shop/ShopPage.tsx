import { ProductCard } from '@/components/shop/ProductCard';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { getActiveProducts, getBrands } from '@/services/shop';
import { Brand, Product } from '@/types/shop';
import { Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const ShopPage = () => {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 12;

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [sortBy, setSortBy] = useState<string>('newest');

    // Debounce search query
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch brands and products in parallel
                const [fetchedBrands, fetchedProducts] = await Promise.all([
                    getBrands(),
                    getActiveProducts()
                ]);
                
                setBrands(fetchedBrands);
                setAllProducts(fetchedProducts);
            } catch (error) {
                console.error("Failed to load shop data", error);
                toast.error("Failed to load products");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Extract categories
    const categories = useMemo(() => 
        Array.from(new Set(allProducts.map(p => p.categoryName).filter(Boolean))),
    [allProducts]);

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

        // Sort
        if (sortBy === 'price_asc') {
            result.sort((a, b) => a.sellingPrice - b.sellingPrice);
        } else if (sortBy === 'price_desc') {
            result.sort((a, b) => b.sellingPrice - a.sellingPrice);
        } else {
            // Newest
            result.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
        }

        return result;
    }, [allProducts, debouncedSearch, selectedCategory, selectedBrand, priceRange, sortBy]);

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
    }, [debouncedSearch, selectedCategory, selectedBrand, priceRange, sortBy]);
    

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCategory(null);
        setSelectedBrand(null);
        setPriceRange([0, 10000]);
        setSortBy('newest');
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
                    {categories.map(cat => (
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
             <Button variant="outline" className="w-full" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
        </div>
    );

    return (
        <ShopLayout title="Shop">
            <div className="flex flex-col gap-6">
                {/* Mobile Filter Sheet & Search & Sort */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm sticky top-16 z-30">
                     <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Search products..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
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
                        
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort By" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest Arrivals</SelectItem>
                                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

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
            </div>
        </ShopLayout>
    );
};

export default ShopPage;
