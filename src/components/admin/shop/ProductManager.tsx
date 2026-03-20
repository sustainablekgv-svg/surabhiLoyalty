import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiImageUpload } from '@/components/ui/multi-image-upload';
import { PreviewableImage } from '@/components/ui/previewable-image';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { isValidImageUrl } from '@/lib/image-utils';
import { deleteImageFromR2 } from '@/services/cloudflare';
import { createProduct, deleteGstSlab, deleteProduct, getBrands, getCategories, getProducts, initializeDisplayOrder, reorderProduct, updateGstSlab, updateProduct } from '@/services/shop';
import { Brand, Category, Product } from '@/types/shop';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Edit, ListOrdered, Plus, Star, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const ProductManager = () => {
    // Client-side pagination state
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [origins, setOrigins] = useState<{id: string, name: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBrandId, setFilterBrandId] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);
    const [gstSlabs, setGstSlabs] = useState<{id: string, title: string, percentage: number}[]>([]);
    
    // GST Form State
    const [isGstDialogOpen, setIsGstDialogOpen] = useState(false);
    const [editingGst, setEditingGst] = useState<{id: string, title: string, percentage: number} | null>(null);
    const [newGst, setNewGst] = useState({ title: '', percentage: '' });

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
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Form State

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        sellingPrice: '',
        quantity: '', // Renamed from weight - represents product quantity
        weightInKg: '', // New field for delivery cost calculation
        unitsOfMeasure: '',
        stock: '',
        category: '',
        brandId: '',
        images: [] as string[],
        freeShipping: false,
        variantType: '',
        isVisible: true,
        spv: '',
        trackInventory: false,
        placeOfOrigin: [] as string[], // Multi-select support
        gstTitle: '',
        gstPercentage: '',
        isFeatured: false
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch brands and categories if empty
            if (brands.length === 0 || categories.length === 0) {
                 const [fetchedBrands, fetchedCategories] = await Promise.all([
                    getBrands(),
                    getCategories()
                ]);
                setBrands(fetchedBrands);
                setCategories(fetchedCategories.categories);
            }
            
            // Fetch Origins
            const originsSnapshot = await getDocs(query(collection(db, 'origins'), orderBy('name')));
            const fetchedOrigins = originsSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
            setOrigins(fetchedOrigins);

            try {
                const gstSnapshot = await getDocs(collection(db, 'gstSlabs'));
                const fetchedGst = gstSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
                setGstSlabs(fetchedGst);
            } catch(e) { console.error("Could not fetch GST slabs", e) }

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

    // Image upload is now handled by MultiImageUpload component

    const handleCreateGst = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!newGst.title || !newGst.percentage) {
                toast.error("Please fill all GST fields");
                return;
            }
            const percentage = Number(newGst.percentage);
            if (isNaN(percentage) || percentage < 0) {
                toast.error("GST percentage must be a valid positive number");
                return;
            }
            
            const id = newGst.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
            await setDoc(doc(db, 'gstSlabs', id), {
                title: newGst.title,
                percentage: percentage
            });
            
            setGstSlabs([...gstSlabs, { id, title: newGst.title, percentage }]);
            setFormData({ ...formData, gstTitle: newGst.title, gstPercentage: percentage.toString() });
            setNewGst({ title: '', percentage: '' });
            toast.success("GST Slab created successfully");
        } catch (error) {
            console.error("Error creating GST slab", error);
            toast.error("Failed to create GST slab");
        }
    };

    const handleUpdateGst = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGst) return;
        try {
            const percentage = Number(newGst.percentage);
            await updateGstSlab(editingGst.id, { title: newGst.title, percentage });
            
            setGstSlabs(gstSlabs.map(g => g.id === editingGst.id ? { ...g, title: newGst.title, percentage } : g));
            setEditingGst(null);
            setNewGst({ title: '', percentage: '' });
            toast.success("GST Slab updated successfully");
        } catch (error) {
            toast.error("Failed to update GST slab");
        }
    };

    const handleDeleteGst = async (id: string) => {
        if (!confirm("Are you sure? This will not remove GST from existing products but they will no longer have a reference to this slab.")) return;
        try {
            await deleteGstSlab(id);
            setGstSlabs(gstSlabs.filter(g => g.id !== id));
            toast.success("GST Slab deleted");
        } catch (error) {
            toast.error("Failed to delete GST slab");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const selectedBrand = brands.find(b => b.id === formData.brandId);
            const brandName = selectedBrand ? selectedBrand.name : 'Unknown Brand';
            
            const selectedCategory = categories.find(c => c.id === formData.category);
            const categoryName = selectedCategory ? selectedCategory.name : (editingProduct?.categoryName || "Unknown Category");

            // detailed validation
            if (!formData.name?.trim()) { toast.error("Product name is required"); return; }
            if (!formData.description?.trim()) { toast.error("Description is required"); return; }
            if (!formData.brandId) { toast.error("Brand is required"); return; }
            if (!formData.category) { toast.error("Category is required"); return; }
            
            if (!formData.quantity?.trim()) { toast.error("Quantity is required"); return; }
            if (!formData.weightInKg?.trim()) { toast.error("Weight (kg) is required for delivery calculation"); return; }
            if (!formData.placeOfOrigin || formData.placeOfOrigin.length === 0) { toast.error("At least one place of origin is required"); return; }
            
            const weightInKgNum = Number(formData.weightInKg);
            if (isNaN(weightInKgNum) || weightInKgNum <= 0) { toast.error("Weight (kg) must be a valid positive number"); return; }
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

            if (!formData.images || formData.images.length === 0) { 
                toast.error("At least one product image is required"); 
                return; 
            }

            const productData: any = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                price,
                sellingPrice,
                weight: formData.quantity.trim(), // Keep for backward compatibility
                quantity: formData.quantity.trim(), // New field
                weightInKg: weightInKgNum,
                unitsOfMeasure: formData.unitsOfMeasure,
                stock,
                categoryId: formData.category, 
                categoryName: categoryName,
                brandId: formData.brandId,
                brandName: brandName,
                images: formData.images,
                freeShipping: formData.freeShipping,
                variantType: formData.variantType,
                isVisible: formData.isVisible,
                isActive: true,
                spv,
                trackInventory: formData.trackInventory,
                placeOfOrigin: formData.placeOfOrigin, // Array of origins
                isFeatured: formData.isFeatured,
                gst: formData.gstTitle && formData.gstPercentage ? {
                    title: formData.gstTitle,
                    percentage: Number(formData.gstPercentage)
                } : undefined
            };

            if (editingProduct) {
                // Delete images that were removed
                const oldImages = editingProduct.images || [];
                const newImages = productData.images || [];
                const removedImages = oldImages.filter(img => !newImages.includes(img));
                
                for (const img of removedImages) {
                    try {
                        await deleteImageFromR2(img);
                    } catch (error) {
                        console.error('Failed to delete old image:', error);
                    }
                }

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

    const handleDelete = async (product: Product) => {
        if (!confirm('Are you sure?')) return;
        try {
            if (product.images?.[0]) {
                await deleteImageFromR2(product.images[0]);
            }
            await deleteProduct(product.id);
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
            quantity: '',
            weightInKg: '',
            unitsOfMeasure: '',
            stock: '',
            category: '',
            brandId: '',
            images: [],
            freeShipping: false,
            spv:'',
            variantType: '',
            isVisible: true,
            trackInventory: false,
            placeOfOrigin: [],
            gstTitle: '',
            gstPercentage: '',
            isFeatured: false
        });
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
        // If categories are already loaded, we can set the form data safely. 
        // If not, it will just show placeholder until categories load.
        setFormData({
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            sellingPrice: product.sellingPrice?.toString() || '',
            quantity: product.quantity || product.weight || '',
            weightInKg: product.weightInKg?.toString() || '',
            unitsOfMeasure: product.unitsOfMeasure || '',
            stock: product.stock.toString(),
            category: product.categoryId || (categories.find(c => c.name === product.categoryName)?.id) || '',
            brandId: product.brandId || '',
            images: product.images || [],
            freeShipping: product.freeShipping || false,
            variantType: product.variantType || '',
            isVisible: product.isVisible ?? true,
            spv: product.spv?.toString() || '',
            trackInventory: product.trackInventory || false,
            placeOfOrigin: product.placeOfOrigin || [],
            gstTitle: product.gst?.title || '',
            gstPercentage: product.gst?.percentage?.toString() || '',
            isFeatured: product.isFeatured || false
        });
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
                                <RichTextEditor 
                                    value={formData.description} 
                                    onChange={value => setFormData({ ...formData, description: value })} 
                                    placeholder="Product description..."
                                />
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
                                    <Label>Quantity</Label>
                                    <Input required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="e.g. 500g, 1kg, 12 pcs" />
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Weight (kg) for Delivery</Label>
                                    <Input type="number" step="0.01" required value={formData.weightInKg} onChange={e => setFormData({ ...formData, weightInKg: e.target.value })} placeholder="e.g. 0.5, 1.2" />
                                    <p className="text-xs text-muted-foreground">Used to calculate delivery cost</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Place of Origin (Multi-select)</Label>
                                    <Select 
                                        value="__select__" 
                                        onValueChange={(value) => {
                                            if (value !== "__select__" && !formData.placeOfOrigin.includes(value)) {
                                                setFormData({ ...formData, placeOfOrigin: [...formData.placeOfOrigin, value] });
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Origins" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {origins.map(origin => (
                                                <SelectItem key={origin.id} value={origin.name}>
                                                    {origin.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {formData.placeOfOrigin.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {formData.placeOfOrigin.map((origin, idx) => (
                                                <Badge key={idx} variant="secondary" className="gap-1">
                                                    {origin}
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ 
                                                            ...formData, 
                                                            placeOfOrigin: formData.placeOfOrigin.filter((_, i) => i !== idx) 
                                                        })}
                                                        className="ml-1 hover:text-destructive"
                                                    >
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Variant Type (Optional)</Label>
                                    <Input value={formData.variantType} onChange={e => setFormData({ ...formData, variantType: e.target.value })} placeholder="e.g. Color, Size" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex justify-between items-center">
                                        GST Slab
                                        <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setIsGstDialogOpen(true)}>
                                            + Add New GST
                                        </Button>
                                    </Label>
                                    <Select 
                                        value={formData.gstTitle || "__none__"} 
                                        onValueChange={(value) => {
                                            if (value === "__none__") {
                                                setFormData({ ...formData, gstTitle: '', gstPercentage: '' });
                                            } else {
                                                const selected = gstSlabs.find(g => g.title === value);
                                                if (selected) setFormData({ ...formData, gstTitle: selected.title, gstPercentage: selected.percentage.toString() });
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select GST" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">None</SelectItem>
                                            {gstSlabs.map(slab => (
                                                <SelectItem key={slab.id} value={slab.title}>
                                                    {slab.title} ({slab.percentage}%)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
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

                                <div className="flex items-center space-x-2 border p-3 rounded-md flex-1">
                                    <Switch
                                        id="isFeatured"
                                        checked={formData.isFeatured}
                                        onCheckedChange={(checked) => setFormData({...formData, isFeatured: checked})}
                                    />
                                    <Label htmlFor="isFeatured">Featured (Star)</Label>
                                    <p className="text-xs text-muted-foreground ml-2">
                                        Show on home page.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Product Images</Label>
                                <MultiImageUpload
                                    images={formData.images}
                                    onChange={(images) => setFormData(prev => ({ ...prev, images }))}
                                    folder="products"
                                    maxImages={10}
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                {editingProduct ? 'Update' : 'Create'} Product
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isGstDialogOpen} onOpenChange={(open) => {
                    setIsGstDialogOpen(open);
                    if (!open) {
                        setEditingGst(null);
                        setNewGst({ title: '', percentage: '' });
                    }
                }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Manage GST Slabs</DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                            <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                                <Table>
                                    <TableBody>
                                        {gstSlabs.map(slab => (
                                            <TableRow key={slab.id}>
                                                <TableCell className="py-2">
                                                    {slab.title} ({slab.percentage}%)
                                                </TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                                            setEditingGst(slab);
                                                            setNewGst({ title: slab.title, percentage: slab.percentage.toString() });
                                                        }}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDeleteGst(slab.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <form onSubmit={editingGst ? handleUpdateGst : handleCreateGst} className="space-y-4 pt-4 border-t">
                                <h4 className="text-sm font-medium">{editingGst ? 'Edit GST Slab' : 'Add New GST Slab'}</h4>
                                <div className="space-y-2">
                                    <Label>Title (e.g. Standard 18%)</Label>
                                    <Input required value={newGst.title} onChange={e => setNewGst({ ...newGst, title: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Percentage (e.g. 18)</Label>
                                    <Input type="number" required value={newGst.percentage} onChange={e => setNewGst({ ...newGst, percentage: e.target.value })} />
                                </div>
                                <div className="flex gap-2">
                                    {editingGst && (
                                        <Button type="button" variant="outline" className="flex-1" onClick={() => {
                                            setEditingGst(null);
                                            setNewGst({ title: '', percentage: '' });
                                        }}>
                                            Cancel
                                        </Button>
                                    )}
                                    <Button type="submit" className="flex-1">
                                        {editingGst ? 'Update Slab' : 'Create Slab'}
                                    </Button>
                                </div>
                            </form>
                        </div>
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
                            <TableHead>GST</TableHead>
                            <TableHead>Featured</TableHead>
                            <TableHead>Visibility</TableHead>
                            <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('averageRating')}>
                                Rating {sortConfig?.key === 'averageRating' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={12} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : products.length === 0 ? (
                            <TableRow><TableCell colSpan={12} className="text-center py-8">No products found</TableCell></TableRow>
                        ) : (
                            products.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        {isValidImageUrl(product.images?.[0]) ? (
                                            <PreviewableImage src={product.images[0]} alt={product.name} className="h-10 w-10 object-cover rounded" />
                                        ) : (
                                            <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center text-xs">No</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div>{product.name}</div>
                                        {product.freeShipping && (
                                            <span className="text-[10px] bg-green-100 text-green-800 px-1 py-0.5 rounded">Free Shipping</span>
                                        )}
                                        <div className="text-xs text-gray-500">
                                            {product.quantity || product.weight} ({product.weightInKg}kg)
                                        </div>
                                        {product.placeOfOrigin && product.placeOfOrigin.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {product.placeOfOrigin.map((o, i) => (
                                                    <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded">{o}</span>
                                                ))}
                                            </div>
                                        )}
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
                                        {product.gst ? (
                                            <div className="text-xs">
                                                <div className="font-medium">{product.gst.percentage}%</div>
                                                <div className="text-[10px] text-gray-400">{product.gst.title}</div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 border px-1 rounded">N/A</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className={product.isFeatured ? "text-amber-500" : "text-gray-300"}
                                            onClick={async () => {
                                                try {
                                                    await updateProduct(product.id, { isFeatured: !product.isFeatured });
                                                    fetchData();
                                                    toast.success(product.isFeatured ? "Removed from featured" : "Added to featured");
                                                } catch (e) {
                                                    toast.error("Failed to update featured status");
                                                }
                                            }}
                                        >
                                            <Star className={`h-5 w-5 ${product.isFeatured ? "fill-current" : ""}`} />
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${product.isVisible !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {product.isVisible !== false ? 'Visible' : 'Hidden'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {product.totalReviews ? (
                                            <div className="flex items-center gap-1 text-xs">
                                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                <span className="font-bold">{product.averageRating}</span>
                                                <span className="text-gray-400">({product.totalReviews})</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">0 Reviews</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(product)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(product)}>
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
