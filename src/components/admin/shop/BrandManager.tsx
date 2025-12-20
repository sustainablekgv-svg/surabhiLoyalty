import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { isValidImageUrl } from '@/lib/image-utils';
import { uploadImageToCloudinary } from '@/services/cloudinary';
import { createBrand, deleteBrand, getBrands, getBrandsPaginated, updateBrand } from '@/services/shop';
import { Brand } from '@/types/shop';
import { Edit, Plus, Search, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const BrandManager = () => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [paginationStack, setPaginationStack] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [hasMore, setHasMore] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        logo: ''
    });

    const fetchBrands = async (startAfterDoc?: any) => {
        setLoading(true);
        try {
            if (searchTerm && searchTerm.length > 2) {
                // Search Mode
                // Using basic getBrands that fetches all (assuming not excessive for search filtering) or large batch
                // Since I reverted getBrands signature to Brand[], I'll check its implementation.
                // It fetches ALL ordered by name. This is fine for client filtering if dataset < 1000.
                const fetchedBrands = await getBrands();
                const filtered = fetchedBrands.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));
                setBrands(filtered);
                setHasMore(false);
            } else {
                const result = await getBrandsPaginated(PAGE_SIZE, startAfterDoc);
                setBrands(result.brands);
                setLastDoc(result.lastDoc);
                setHasMore(result.brands.length >= PAGE_SIZE);
            }
        } catch (error) {
            console.error("Error fetching brands", error);
            toast.error("Failed to load brands");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            setPaginationStack([]);
            setLastDoc(null);
            fetchBrands(null);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadNext = () => {
        if (!lastDoc) return;
        setPaginationStack(prev => [...prev, lastDoc]);
        setPage(prev => prev + 1);
        fetchBrands(lastDoc);
    };

    const loadPrev = () => {
        if (page <= 1) return;
        const newStack = [...paginationStack];
        newStack.pop();
        const prevDoc = newStack[newStack.length - 1] || null;
        setPaginationStack(newStack);
        setPage(prev => prev - 1);
        fetchBrands(prevDoc);
    };

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
        try {
            const brandData = {
                name: formData.name,
                description: formData.description,
                logo: formData.logo,
                isActive: true,
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
            fetchBrands(paginationStack[paginationStack.length - 1]);
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
            fetchBrands(paginationStack[paginationStack.length - 1]);
        } catch (error) {
            toast.error('Error deleting brand');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            logo: ''
        });
    };

    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand);
        setFormData({
            name: brand.name,
            description: brand.description || '',
            logo: brand.logo || ''
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
                        ) : brands.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8">No brands found</TableCell></TableRow>
                        ) : (
                            brands.map(brand => (
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
