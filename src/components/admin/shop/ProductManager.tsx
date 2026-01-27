import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { isValidImageUrl } from '@/lib/image-utils';
import { uploadImageToCloudinary } from '@/services/cloudinary';
import { createProduct, deleteProduct, getBrands, getCategories, getProducts, initializeDisplayOrder, reorderProduct, updateProduct } from '@/services/shop';
import { Brand, Category, Product } from '@/types/shop';
import { ArrowDown, ArrowUp, Edit, ListOrdered, Plus, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const ProductManager = () => {
    // Client-side pagination state
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBrandId, setFilterBrandId] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: keyof Product) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc' 
                    ? { key, direction: 'desc' } 
                    : null;
            }
            return { key, direction: 'asc' };
        });
    };
    
    // Legacy pagination state removed
    // const [lastDoc, setLastDoc] = useState<any>(null);
    // const [paginationStack, setPaginationStack] = useState<any[]>([]);
    // const [hasMore, setHasMore] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        sellingPrice: '',
        weight: '',
        unitsOfMeasure: '',
        stock: '',
        category: '',
        brandId: '',
        imageUrl: '',
        freeShipping: false,
        variantType: '',
        isVisible: true,
        spv: '',
        trackInventory: false
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            if (brands.length === 0 || categories.length === 0) {
                 const [fetchedBrands, fetchedCategories] = await Promise.all([
                    getBrands(),
                    getCategories()
                ]);
                setBrands(fetchedBrands);
                setCategories(fetchedCategories.categories);
            }

            // Fetch ALL active/inactive products (limit 1000)
            const result = await getProducts({ includeInactive: true, sort: 'order' }, null, 1000);
            setAllProducts(result.products);
        } catch (error) {
            console.error("Error fetching data", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Client-side filtering and pagination logic
    const filteredProducts = React.useMemo(() => {
        let result = [...allProducts];

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lower));
        }

        if (filterBrandId !== 'all') {
            result = result.filter(p => p.brandId === filterBrandId);
        }

        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === bValue) return 0;
                
                // Handle mixed types (e.g. number vs undefined)
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
             // Default Sort
             if (filterBrandId !== 'all') {
                 result.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
             } else {
                result.sort((a, b) => {
                    const diff = (a.displayOrder || 999999) - (b.displayOrder || 999999);
                    if (diff !== 0) return diff;
                    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                });
             }
        }
        return result;
    }, [allProducts, searchTerm, filterBrandId, sortConfig]);

    const products = React.useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredProducts.slice(start, start + PAGE_SIZE);
    }, [filteredProducts, page]);

    const hasMore = (page * PAGE_SIZE) < filteredProducts.length;

    const loadNext = () => setPage(p => p + 1);
    const loadPrev = () => setPage(p => Math.max(1, p - 1));

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterBrandId]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImageToCloudinary(file);
            setFormData(prev => ({ ...prev, imageUrl: url }));
            toast.success("Image uploaded");
        } catch (error: any) {
            toast.error(error.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const selectedBrand = brands.find(b => b.id === formData.brandId);
            const brandName = selectedBrand ? selectedBrand.name : 'Unknown Brand';
            
            const selectedCategory = categories.find(c => c.id === formData.category);
            const categoryName = selectedCategory ? selectedCategory.name : formData.category;

            // detailed validation
            if (!formData.name?.trim()) { toast.error("Product name is required"); return; }
            if (!formData.description?.trim()) { toast.error("Description is required"); return; }
            if (!formData.brandId) { toast.error("Brand is required"); return; }
            if (!formData.category) { toast.error("Category is required"); return; }
            
            if (!formData.weight?.trim()) { toast.error("Weight is required"); return; }
            if (!formData.unitsOfMeasure) { toast.error("Unit of measure is required"); return; }

            const price = Number(formData.price);
            const sellingPrice = formData.sellingPrice ? Number(formData.sellingPrice) : price;
            const stock = Number(formData.stock);
            const spv = Number(formData.spv || 0);

            if (isNaN(price) || price <= 0) { toast.error("MRP must be valid and greater than 0"); return; }
            if (isNaN(sellingPrice) || sellingPrice <= 0) { toast.error("Selling price must be valid and greater than 0"); return; }
            if (sellingPrice > price) { toast.error("Selling price cannot be greater than MRP"); return; }
            if (isNaN(stock) || stock < 0) { toast.error("Stock cannot be negative"); return; }
            if (isNaN(spv) || spv < 0) { toast.error("SPV cannot be negative"); return; }

            if (!formData.imageUrl && !editingProduct?.images?.length) { 
                toast.error("Product image is required"); 
                return; 
            }

            const productData: any = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                price,
                sellingPrice,
                weight: formData.weight.trim(),
                unitsOfMeasure: formData.unitsOfMeasure,
                stock,
                categoryId: formData.category, 
                categoryName: categoryName,
                brandId: formData.brandId,
                brandName: brandName,
                images: formData.imageUrl ? [formData.imageUrl] : (editingProduct?.images || []),
                freeShipping: formData.freeShipping,
                variantType: formData.variantType,
                isVisible: formData.isVisible,
                isActive: true,
                spv,
                trackInventory: formData.trackInventory
            };

            if (editingProduct) {
                await updateProduct(editingProduct.id, productData);
                toast.success('Product updated successfully');
            } else {
                await createProduct(productData);
                toast.success('Product added successfully');
            }

            setIsDialogOpen(false);
            setEditingProduct(null);
            resetForm();
            // Refresh current view
            fetchData();
        } catch (error) {
            toast.error('Error saving product');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await deleteProduct(id);
            toast.success('Product deleted');
            // Refresh current view
            fetchData();
        } catch (error) {
            toast.error('Error deleting product');
        }
    };

    const handleReorder = async (product: Product, direction: 'up' | 'down') => {
        try {
            const contextId = filterBrandId !== 'all' ? filterBrandId : undefined;
            await reorderProduct(product.id, product.displayOrder || 0, direction, contextId);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to reorder");
        }
    };
    
    const handleInitializeOrder = async () => {
        if (filterBrandId === 'all') {
             if (!confirm("This will reset order for ALL products globally (by creation date)? It's safer to do per brand.")) {
                 if(!confirm("Are you REALLY sure you want to init all?")) return;
             }
             // For safety, maybe block global init or allow generic init
             await initializeDisplayOrder('products');
        } else {
             if (!confirm(`Reset order for products in this brand?`)) return;
             await initializeDisplayOrder('products', { field: 'brandId', value: filterBrandId });
        }
        toast.success("Order initialized");
        fetchData();
    };

    const handleInitializeOrderConfirm = async () => {
        await handleInitializeOrder();
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: '',
            sellingPrice: '',
            weight: '',
            unitsOfMeasure: '',
            stock: '',
            category: '',
            brandId: '',
            imageUrl: '',
            freeShipping: false,
            spv:'',
            variantType: '',
            isVisible: true,
            trackInventory: false
        });
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            sellingPrice: product.sellingPrice?.toString() || '',
            weight: product.weight || '',
            unitsOfMeasure: product.unitsOfMeasure || '',
            stock: product.stock.toString(),
            category: product.categoryName || product.categoryId || '',
            brandId: product.brandId || '',
            imageUrl: product.images?.[0] || '',
            freeShipping: product.freeShipping || false,
            variantType: product.variantType || '',
            isVisible: product.isVisible ?? true,
            spv: product.spv?.toString() || '',
            trackInventory: product.trackInventory || false
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-72">
                    {/* <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" /> */}
                    <Input
                        placeholder="Search products..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-[200px]">
                    <Select value={filterBrandId} onValueChange={setFilterBrandId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter Brand" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Brands</SelectItem>
                            {brands.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingProduct(null);
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
                    </DialogTrigger>
                    {filterBrandId !== 'all' && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" title="Fix orders for this brand" className="ml-2">
                                    <ListOrdered className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Initialize Display Order?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will reset the display order for all products in this brand based on creation date. 
                                        This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleInitializeOrderConfirm}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Product Name</Label>
                                    <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Brand</Label>
                                    <Select 
                                        value={formData.brandId} 
                                        onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Brand" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {brands.map(brand => (
                                                <SelectItem key={brand.id} value={brand.id}>
                                                    {brand.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select 
                                        value={formData.category} 
                                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(category => (
                                                <SelectItem key={category.id} value={category.id}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Weight</Label>
                                    <Input required value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} placeholder="e.g. 500g, 1kg" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Units of Measure</Label>
                                    <Select 
                                        value={formData.unitsOfMeasure} 
                                        onValueChange={(value) => setFormData({ ...formData, unitsOfMeasure: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['kg', 'g', 'ltr', 'ml', 'pcs', 'dozen', 'box', 'pack'].map(unit => (
                                                <SelectItem key={unit} value={unit}>
                                                    {unit}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Original Price (MRP)</Label>
                                    <Input type="number" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Selling Price</Label>
                                    <Input type="number" required value={formData.sellingPrice} onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Stock Quantity</Label>
                                    <Input type="number" required value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>SPV</Label>
                                    <Input type="number" value={formData.spv} onChange={e => setFormData({ ...formData, spv: e.target.value })} placeholder="0" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Variant Type (Optional)</Label>
                                <Input value={formData.variantType} onChange={e => setFormData({ ...formData, variantType: e.target.value })} placeholder="e.g. Color, Size" />
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2 border p-3 rounded-md flex-1">
                                    <Switch
                                        id="trackInventory"
                                        checked={formData.trackInventory}
                                        onCheckedChange={(checked) => setFormData({...formData, trackInventory: checked})}
                                    />
                                    <Label htmlFor="trackInventory">Track Inventory</Label>
                                    <p className="text-xs text-muted-foreground ml-2">
                                        Enable stock count logic.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2 border p-3 rounded-md flex-1">
                                    <Checkbox 
                                        id="freeShipping" 
                                        checked={formData.freeShipping} 
                                        onCheckedChange={(checked) => setFormData({...formData, freeShipping: checked === true})}
                                    />
                                    <Label htmlFor="freeShipping">Free Shipping</Label>
                                    <p className="text-xs text-muted-foreground ml-2">
                                        Exclude from shipping cost.
                                    </p>
                                </div>

                                <div className="flex items-center space-x-2 border p-3 rounded-md flex-1">
                                    <Switch
                                        id="isVisible"
                                        checked={formData.isVisible}
                                        onCheckedChange={(checked) => setFormData({...formData, isVisible: checked})}
                                    />
                                    <Label htmlFor="isVisible">Show in Shop</Label>
                                    <p className="text-xs text-muted-foreground ml-2">
                                        Toggle visibility for customers.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Product Image</Label>
                                <div className="flex items-center gap-4">
                                    {isValidImageUrl(formData.imageUrl) && (
                                        <img src={formData.imageUrl} alt="Preview" className="h-16 w-16 object-cover border rounded" />
                                    )}
                                    <div className="relative flex-1">
                                        <Input
                                            type="file"
                                            className="hidden"
                                            id="product-image-upload"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                        <Label htmlFor="product-image-upload" className="cursor-pointer block w-full">
                                            <div className="flex items-center justify-center gap-2 border-2 border-dashed px-4 py-8 rounded-md hover:bg-gray-50 text-gray-500">
                                                <Upload className="h-6 w-6" />
                                                <span>{uploading ? 'Uploading...' : 'Click to Upload Image'}</span>
                                            </div>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={uploading}>
                                {editingProduct ? 'Update' : 'Create'} Product
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Image</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sellingPrice')}>
                                Price {sortConfig?.key === 'sellingPrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('spv')}>
                                SPV {sortConfig?.key === 'spv' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('stock')}>
                                Stock {sortConfig?.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead>Visibility</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : products.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-8">No products found</TableCell></TableRow>
                        ) : (
                            products.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        {isValidImageUrl(product.images?.[0]) ? (
                                            <img src={product.images[0]} alt={product.name} className="h-10 w-10 object-cover rounded" />
                                        ) : (
                                            <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center text-xs">No</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div>{product.name}</div>
                                        {product.freeShipping && (
                                            <span className="text-[10px] bg-green-100 text-green-800 px-1 py-0.5 rounded">Free Shipping</span>
                                        )}
                                        <div className="text-xs text-gray-500">{product.weight}</div>
                                    </TableCell>
                                    <TableCell>{product.categoryName}</TableCell>
                                    <TableCell>{product.brandName}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold">₹{product.sellingPrice}</span>
                                            {product.price > product.sellingPrice && (
                                                <span className="text-xs text-muted-foreground line-through">₹{product.price}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium text-blue-600">
                                            {product.spv || 0}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={product.stock < 10 ? "text-red-500 font-bold" : ""}>
                                            {product.stock}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${product.isVisible !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {product.isVisible !== false ? 'Visible' : 'Hidden'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(product)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(product.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                                <div className="flex flex-col gap-0.5">
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleReorder(product, 'up')}>
                                                        <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleReorder(product, 'down')}>
                                                        <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            
             {/* Pagination Controls */}
             <div className="flex items-center justify-between px-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadPrev} 
                    disabled={page <= 1 || loading}
                >
                    Previous
                </Button>
                <div className="text-sm text-gray-500">
                    Page {page}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadNext} 
                    disabled={!hasMore || loading}
                >
                    Next
                </Button>
            </div>
        </div>
    );
};
