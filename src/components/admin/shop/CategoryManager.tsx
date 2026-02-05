import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { uploadImageToR2 } from '@/services/cloudflare';
import { createCategory, deleteCategory, getCategories, initializeDisplayOrder, reorderCategory, updateCategory } from '@/services/shop';
import { Category } from '@/types/shop';
import { ArrowDown, ArrowUp, Edit, ListOrdered, Plus, Search, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const CategoryManager = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [paginationStack, setPaginationStack] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [hasMore, setHasMore] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        image: '',
        isActive: true
    });

    const fetchCategories = async (startAfterDoc?: any) => {
        setLoading(true);
        try {
            if (searchTerm && searchTerm.length > 2) {
                // Search Mode - fetch all relevant (simple client-side filter approximation for now as Firestore lacks partial search)
                 // Or fetch many and filter.
                 const result = await getCategories(200); // reuse existing or new simple fetcher with limit
                 const filtered = result.categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
                 setCategories(filtered);
                 setHasMore(false);
            } else {
                const result = await getCategories(PAGE_SIZE, startAfterDoc);
                setCategories(result.categories);
                setLastDoc(result.lastDoc);
                setHasMore(result.categories.length >= PAGE_SIZE);
            }
        } catch (error) {
            console.error("Error fetching categories", error);
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            setPaginationStack([]);
            setLastDoc(null);
            fetchCategories(null);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadNext = () => {
        if (!lastDoc) return;
        setPaginationStack(prev => [...prev, lastDoc]);
        setPage(prev => prev + 1);
        fetchCategories(lastDoc);
    };

    const loadPrev = () => {
        if (page <= 1) return;
        const newStack = [...paginationStack];
        newStack.pop();
        const prevDoc = newStack[newStack.length - 1] || null;
        setPaginationStack(newStack);
        setPage(prev => prev - 1);
        fetchCategories(prevDoc);
    };
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImageToR2(file);
            setFormData(prev => ({ ...prev, image: url }));
            toast.success("Image uploaded");
        } catch (error: any) {
            toast.error(error.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setFormData(prev => ({ 
            ...prev, 
            name,
            slug: editingCategory ? prev.slug : generateSlug(name) // Only auto-generate slug for new categories
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
            if (!formData.slug?.trim()) { toast.error("Slug is required"); return; }
            if (!formData.image && (!editingCategory || !editingCategory.image)) { 
                toast.error("Category image is required"); 
                return; 
            }

            const categoryData = {
                name: formData.name.trim(),
                slug: formData.slug.trim(),
                image: formData.image || (editingCategory?.image || ''),
                isActive: formData.isActive,
            };

            if (editingCategory) {
                await updateCategory(editingCategory.id, categoryData);
                toast.success('Category updated successfully');
            } else {
                await createCategory(categoryData);
                toast.success('Category added successfully');
            }

            setIsDialogOpen(false);
            setEditingCategory(null);
            resetForm();
            fetchCategories(paginationStack[paginationStack.length - 1]);
        } catch (error) {
            toast.error('Error saving category');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? Deleting a category might affect products linked to it.')) return;
        try {
            await deleteCategory(id);
            toast.success('Category deleted');
            fetchCategories(paginationStack[paginationStack.length - 1]);
        } catch (error) {
            toast.error('Error deleting category');
        }
    };

    const handleReorder = async (category: Category, direction: 'up' | 'down') => {
        try {
            await reorderCategory(category.id, category.displayOrder || 0, direction);
            // Refresh
            fetchCategories(paginationStack[paginationStack.length - 1]);
        } catch (error) {
            console.error(error);
            toast.error("Failed to reorder");
        }
    };

    const handleInitializeOrder = async () => {
        // if (!confirm("This will reset the order of all categories. Continue?")) return; // Removed native confirm
        setLoading(true);
        try {
            await initializeDisplayOrder('categories');
            toast.success("Order initialized");
            fetchCategories(null);
        } catch (error) {
            toast.error("Failed to initialize");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            slug: '',
            image: '',
            isActive: true
        });
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            slug: category.slug,
            image: category.image || '',
            isActive: category.isActive
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search categories..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingCategory(null);
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Add Category</Button>
                    </DialogTrigger>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" title="Fix missing orders">
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Initialize Category Order?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will reset the order of all categories based on creation date.
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleInitializeOrder}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Category Name</Label>
                                <Input required value={formData.name} onChange={handleNameChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug (URL identifier)</Label>
                                <Input required value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Image</Label>
                                <div className="flex items-center gap-4">
                                    {formData.image && (
                                        <img src={formData.image} alt="Preview" className="h-12 w-12 object-contain border rounded" />
                                    )}
                                    <div className="relative flex-1">
                                        <Input
                                            type="file"
                                            className="hidden"
                                            id="category-image-upload"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                        <Label htmlFor="category-image-upload" className="cursor-pointer">
                                            <div className="flex items-center justify-center gap-2 border px-3 py-2 rounded-md hover:bg-gray-50 text-sm">
                                                <Upload className="h-4 w-4" />
                                                <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                                            </div>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={uploading}>
                                {editingCategory ? 'Update' : 'Create'} Category
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Image</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                            ) : categories.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-8">No categories found</TableCell></TableRow>
                            ) : (
                                categories.map(category => (
                                    <TableRow key={category.id}>
                                        <TableCell>
                                            {category.image ? (
                                                <img src={category.image} alt={category.name} className="h-8 w-8 object-contain" />
                                            ) : (
                                                <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center text-xs text-muted-foreground">No</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{category.name}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{category.slug}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => handleEdit(category)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(category.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <div className="flex flex-col gap-0.5">
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleReorder(category, 'up')}>
                                                        <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleReorder(category, 'down')}>
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
