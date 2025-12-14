import { ProductCard } from '@/components/shop/ProductCard';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { getBrands, getProducts } from '@/services/shop';
import { Brand, Product } from '@/types/shop';
import { Filter, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const ShopPage = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [sortBy, setSortBy] = useState<string>('newest');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [fetchedProducts, fetchedBrands] = await Promise.all([
                    getProducts(),
                    getBrands()
                ]);
                setProducts(fetchedProducts);
                setBrands(fetchedBrands);
            } catch (error) {
                console.error("Failed to load shop data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const categories = Array.from(new Set(products.map(p => p.categoryName).filter(Boolean)));
    const maxPrice = Math.max(...products.map(p => p.sellingPrice || p.price), 10000);

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              product.brandName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory ? product.categoryName === selectedCategory : true;
        const matchesBrand = selectedBrand ? product.brandId === selectedBrand : true;
        
        const price = product.sellingPrice || product.price;
        const matchesPrice = price >= priceRange[0] && price <= priceRange[1];

        return matchesSearch && matchesCategory && matchesBrand && matchesPrice;
    }).sort((a, b) => {
        const priceA = a.sellingPrice || a.price;
        const priceB = b.sellingPrice || b.price;
        
        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'price_desc') return priceB - priceA;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
         // Default newest
         return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime();
    });

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCategory(null);
        setSelectedBrand(null);
        setPriceRange([0, maxPrice]);
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
                    max={10000} // Ideally dynamic maxPrice, but slider needs static max often or re-renders issues
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
                                <SelectItem value="name_asc">Name: A to Z</SelectItem>
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
                        {loading ? (
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
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ShopLayout>
    );
};

export default ShopPage;
