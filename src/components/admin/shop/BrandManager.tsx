import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { isValidImageUrl } from '@/lib/image-utils';
import { uploadImageToCloudinary } from '@/services/cloudinary';
import { createBrand, deleteBrand, getBrands, getCategories, initializeDisplayOrder, reorderBrand, updateBrand } from '@/services/shop';
import { Brand, Category } from '@/types/shop';
import { ArrowDown, ArrowUp, Edit, ListOrdered, Plus, Search, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const BrandManager = () => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
    
    // Pagination
    const [allBrands, setAllBrands] = useState<Brand[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        logo: '',
        categoryId: '',
        categoryIds: [] as string[]
    });

    const fetchBrands = async () => {
        setLoading(true);
        try {
            const categoryArg = filterCategoryId === 'all' ? undefined : filterCategoryId;
            const fetchedBrands = await getBrands(categoryArg);
            setAllBrands(fetchedBrands);
        } catch (error) {
            console.error("Error fetching brands", error);
            toast.error("Failed to load brands");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchBrands();
    }, [filterCategoryId]);

    // Client-side filtering
    const filteredBrands = React.useMemo(() => {
        let result = [...allBrands];
        if (searchTerm) {
             result = result.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return result;
    }, [allBrands, searchTerm]);

    const displayBrands = React.useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredBrands.slice(start, start + PAGE_SIZE);
    }, [filteredBrands, page]);

    const hasMore = (page * PAGE_SIZE) < filteredBrands.length;
    
    const loadNext = () => setPage(p => p + 1);
    const loadPrev = () => setPage(p => Math.max(1, p - 1));

    useEffect(() => {
        const loadCats = async () => {
             try {
                const data = await getCategories(200);
                setCategories(data.categories);
             } catch(e) { console.error("Failed to load categories", e); }
        };
        loadCats();
    }, []);



    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImageToCloudinary(file);
            setFormData(prev => ({ ...prev, logo: url }));
            toast.success("Logo uploaded");
        } catch (error) {
            toast.error("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name?.trim()) {
            toast.error("Brand name is required");
            return;
        }

        if (formData.categoryIds.length === 0) {
            toast.error("Please select at least one category");
            return;
        }

        if (!formData.logo && (!editingBrand || !editingBrand.logo)) {
             toast.error("Brand logo is required");
             return;
        }

        try {
            const brandData: any = {
                name: formData.name.trim(),
                description: formData.description,
                logo: formData.logo || (editingBrand?.logo || ''),
                isActive: true,
                categoryId: formData.categoryIds[0], // Primary category for legacy support
                categoryIds: formData.categoryIds,
                categoryName: categories.find(c => c.id === formData.categoryIds[0])?.name || ''
            };

            if (editingBrand) {
                await updateBrand(editingBrand.id, brandData);
                toast.success('Brand updated successfully');
            } else {
                await createBrand(brandData);
                toast.success('Brand added successfully');
            }

            setIsDialogOpen(false);
            setEditingBrand(null);
            resetForm();
            fetchBrands();
        } catch (error) {
            toast.error('Error saving brand');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? Deleting a brand might affect products linked to it.')) return;
        try {
            await deleteBrand(id);
            toast.success('Brand deleted');
            fetchBrands();
        } catch (error) {
            toast.error('Error deleting brand');
        }
    };

    const handleReorder = async (brand: Brand, direction: 'up' | 'down') => {
        // If filtering by specific category, use it. Otherwise, assume global reorder (if supported) or warn.
        // User requested "totally independent" Brand Order. This implies a global order.
        // We will pass undefined or a specific flag for global order.
        
        try {
            const contextId = filterCategoryId !== 'all' ? filterCategoryId : undefined;
            const currentOrder = contextId ? (brand.categoryOrders?.[contextId] ?? 0) : (brand.displayOrder ?? 0);
            
            await reorderBrand(brand.id, currentOrder, direction, contextId);
            fetchBrands();
        } catch (error) {
            console.error(error);
            toast.error("Failed to reorder");
        }
    };

    const handleInitializeOrder = async () => {
        // if (!confirm("This will reset the order of all brands. Continue?")) return;
        setLoading(true);
        try {
            if (filterCategoryId === 'all') {
                // if(!confirm("Reset ALL brands globally?")) return;
                await initializeDisplayOrder('brands');
            } else {
                await initializeDisplayOrder('brands', { field: 'categoryId', value: filterCategoryId });
            }
            toast.success("Order initialized");
            fetchBrands();
        } catch (error) {
            toast.error("Failed to initialize");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            logo: '',
            categoryId: '',
            categoryIds: []
        });
    };

    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand);
        setFormData({
            name: brand.name,
            description: brand.description || '',
            logo: brand.logo || '',
            categoryId: brand.categoryId || '',
            categoryIds: brand.categoryIds || (brand.categoryId ? [brand.categoryId] : [])
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search brands..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-[200px]">
                    <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingBrand(null);
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" /> Add Brand</Button>
                    </DialogTrigger>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" title="Fix missing orders" className="ml-2">
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Initialize Brand Order?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will reset the order of displayed brands.
                                    {filterCategoryId === 'all' ? " This will affect ALL brands globally." : " This will affect brands in the selected category."}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleInitializeOrder}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add New Brand'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Brand Name</Label>
                                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Categories</Label>
                                <div className="border rounded-md p-3 h-48 overflow-y-auto space-y-2">
                                    {categories.map(c => (
                                        <div key={c.id} className="flex items-center space-x-2">
                                            <input 
                                                type="checkbox"
                                                id={`cat-${c.id}`}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={formData.categoryIds.includes(c.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setFormData(prev => {
                                                        const current = prev.categoryIds;
                                                        if (checked) return { ...prev, categoryIds: [...current, c.id] };
                                                        return { ...prev, categoryIds: current.filter(id => id !== c.id) };
                                                    });
                                                }}
                                            />
                                            <Label htmlFor={`cat-${c.id}`} className="font-normal cursor-pointer text-sm">
                                                {c.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Select all categories this brand belongs to.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Logo</Label>
                                <div className="flex items-center gap-4">
                                    {isValidImageUrl(formData.logo) && (
                                        <img src={formData.logo} alt="Preview" className="h-12 w-12 object-contain border rounded" />
                                    )}
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            className="hidden"
                                            id="brand-logo-upload"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                        <Label htmlFor="brand-logo-upload" className="cursor-pointer">
                                            <div className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-gray-50">
                                                <Upload className="h-4 w-4" />
                                                <span>{uploading ? 'Uploading...' : 'Upload Logo'}</span>
                                            </div>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={uploading}>
                                {editingBrand ? 'Update' : 'Create'} Brand
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Logo</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : displayBrands.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8">No brands found</TableCell></TableRow>
                        ) : (
                            displayBrands.map(brand => (
                                <TableRow key={brand.id}>
                                    <TableCell>
                                        {isValidImageUrl(brand.logo) ? (
                                            <img src={brand.logo} alt={brand.name} className="h-8 w-8 object-contain" />
                                        ) : (
                                            <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center text-xs">No</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{brand.name}</TableCell>
                                    <TableCell className="max-w-xs truncate">{brand.description}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(brand)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(brand.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <div className="flex flex-col gap-0.5">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleReorder(brand, 'up')}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleReorder(brand, 'down')}>
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
