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
import { createProduct, deleteProduct, getBrands, getCategories, getProducts, updateProduct } from '@/services/shop';
import { Brand, Category, Product } from '@/types/shop';
import { Edit, Plus, Search, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const ProductManager = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [paginationStack, setPaginationStack] = useState<any[]>([]); // To handle "Previous"
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [hasMore, setHasMore] = useState(true);

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
        isVisible: true
    });

    const fetchData = async (startAfterDoc?: any) => {
        setLoading(true);
        try {
            // Fetch brands and categories only once if empty
            if (brands.length === 0 || categories.length === 0) {
                 const [fetchedBrands, fetchedCategories] = await Promise.all([
                    getBrands(),
                    getCategories()
                ]);
                setBrands(fetchedBrands);
                setCategories(fetchedCategories.categories);
            }

            // Client side search is not effective with pagination unless we index everything or specific search service.
            // For now, if searching, we fetch all active (upto a limit) and filter.
            // But getProducts handles some logic.
            
            // To support search properly without Algolia, we either:
            // 1. Fetch ALL products (expensive if many) -> filter client side => Good for 100-500 products.
            // 2. Search only matches exact ID or basic filter if supported by Firestore (it isn't for substring).
            
            // Let's implement: If search term > 3 chars, fetch ALL active products and filter client side.
            // Else use pagination.
            
            if (searchTerm && searchTerm.length > 2) {
                // Search Mode (No pagination, limited to top X matches)
                const result = await getProducts({ includeInactive: true }, null, 500);
                const filtered = result.products.filter(p => 
                    p.name.toLowerCase().includes(searchTerm.toLowerCase())
                );
                setProducts(filtered);
                setHasMore(false);
            } else {
                // Pagination Mode
                const result = await getProducts({ includeInactive: true }, startAfterDoc, PAGE_SIZE);
                setProducts(result.products);
                setLastDoc(result.lastDoc);
                setHasMore(result.products.length >= PAGE_SIZE);
            }

        } catch (error) {
            console.error("Error fetching data", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            setPage(1);
            setPaginationStack([]);
            setLastDoc(null);
            fetchData(null);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadNext = () => {
        if (!lastDoc) return;
        setPaginationStack(prev => [...prev, lastDoc]);
        setPage(prev => prev + 1);
        fetchData(lastDoc);
    };

    const loadPrev = () => {
        if (page <= 1) return;
        const newStack = [...paginationStack];
        newStack.pop(); // Remove current page's start
        const prevDoc = newStack[newStack.length - 1] || null;
        
        setPaginationStack(newStack);
        setPage(prev => prev - 1);
        fetchData(prevDoc);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImageToCloudinary(file);
            setFormData(prev => ({ ...prev, imageUrl: url }));
            toast.success("Image uploaded");
        } catch (error) {
            toast.error("Upload failed");
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

            // Basic validation
            if (!formData.brandId) {
                toast.error("Please select a brand");
                return;
            }

            const productData: any = {
                name: formData.name,
                description: formData.description,
                price: Number(formData.price),
                sellingPrice: formData.sellingPrice ? Number(formData.sellingPrice) : Number(formData.price),
                weight: formData.weight,
                unitsOfMeasure: formData.unitsOfMeasure,
                stock: Number(formData.stock),
                categoryId: formData.category, 
                categoryName: categoryName,
                brandId: formData.brandId,
                brandName: brandName,
                images: formData.imageUrl ? [formData.imageUrl] : [],
                freeShipping: formData.freeShipping,
                variantType: formData.variantType,
                isVisible: formData.isVisible,
                isActive: true,
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
            fetchData(paginationStack[paginationStack.length - 1]);
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
            fetchData(paginationStack[paginationStack.length - 1]);
        } catch (error) {
            toast.error('Error deleting product');
        }
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
            variantType: '',
            isVisible: true
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
            isVisible: product.isVisible ?? true
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search products..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
                            </div>

                            <div className="space-y-2">
                                <Label>Variant Type (Optional)</Label>
                                <Input value={formData.variantType} onChange={e => setFormData({ ...formData, variantType: e.target.value })} placeholder="e.g. Color, Size" />
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
                            <TableHead>Price</TableHead>
                            <TableHead>Stock</TableHead>
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
