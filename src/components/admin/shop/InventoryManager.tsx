import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getProducts, updateProduct } from '@/services/shop';
import { Product } from '@/types/shop';
import { Save, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const InventoryManager = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const fetchedProducts = await getProducts();
            setProducts(fetchedProducts);
        } catch (error) {
            console.error("Error fetching products", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleStockChange = (productId: string, val: string) => {
        const num = parseInt(val);
        if (!isNaN(num)) {
            setStockUpdates(prev => ({ ...prev, [productId]: num }));
        }
    };

    const saveStock = async (productId: string) => {
        const newStock = stockUpdates[productId];
        if (newStock === undefined) return;

        try {
            await updateProduct(productId, { stock: newStock });
            toast.success("Stock updated");
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
            setStockUpdates(prev => {
                const copy = { ...prev };
                delete copy[productId];
                return copy;
            });
        } catch (error) {
            toast.error("Update failed");
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
             <div className="relative w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search products..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Current Stock</TableHead>
                            <TableHead>Update Stock</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : filteredProducts.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8">No products found</TableCell></TableRow>
                        ) : (
                            filteredProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.stock}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            className="w-24"
                                            value={stockUpdates[product.id] ?? product.stock}
                                            onChange={(e) => handleStockChange(product.id, e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            size="sm" 
                                            disabled={stockUpdates[product.id] === undefined || stockUpdates[product.id] === product.stock}
                                            onClick={() => saveStock(product.id)}
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            Save
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
