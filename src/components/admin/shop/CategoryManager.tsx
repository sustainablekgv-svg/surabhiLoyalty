import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { uploadImageToCloudinary } from '@/services/cloudinary';
import { createCategory, deleteCategory, getCategories, updateCategory } from '@/services/shop';
import { Category } from '@/types/shop';
import { Edit, Plus, Search, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const CategoryManager = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const fetchedCategories = await getCategories();
            setCategories(fetchedCategories);
        } catch (error) {
            console.error("Error fetching categories", error);
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImageToCloudinary(file);
            setFormData(prev => ({ ...prev, image: url }));
            toast.success("Image uploaded");
        } catch (error) {
            toast.error("Upload failed");
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
            const categoryData = {
                name: formData.name,
                slug: formData.slug,
                image: formData.image,
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
            fetchCategories();
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
            fetchCategories();
        } catch (error) {
            toast.error('Error deleting category');
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

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                            ) : filteredCategories.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-8">No categories found</TableCell></TableRow>
                            ) : (
                                filteredCategories.map(category => (
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
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};
