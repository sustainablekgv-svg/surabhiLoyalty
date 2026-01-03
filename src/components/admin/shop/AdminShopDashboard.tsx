import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, LayoutDashboard, ListOrdered, Package, ShoppingBag, Tag } from 'lucide-react';
import { BrandManager } from './BrandManager';
import { CatalogManager } from './CatalogManager';
import { CategoryManager } from './CategoryManager';
import { InventoryManager } from './InventoryManager';
import { OrderManager } from './OrderManager';
import { ProductManager } from './ProductManager';
import { ShopAnalytics } from './ShopAnalytics';

export const AdminShopDashboard = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Shop Management</h2>
            </div>

            <Tabs defaultValue="products" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Analytics
                    </TabsTrigger>
                     <TabsTrigger value="catalog" className="flex items-center gap-2">
                        <ListOrdered className="h-4 w-4" />
                        Ordering
                    </TabsTrigger>
                     <TabsTrigger value="categories" className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Categories
                    </TabsTrigger>
                     <TabsTrigger value="brands" className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Brands
                    </TabsTrigger>

                    <TabsTrigger value="products" className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Products
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Inventory
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Orders
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="products" className="space-y-4">
                    <ProductManager />
                </TabsContent>
                <TabsContent value="brands" className="space-y-4">
                    <BrandManager />
                </TabsContent>
                <TabsContent value="categories" className="space-y-4">
                    <CategoryManager />
                </TabsContent>
                <TabsContent value="orders" className="space-y-4">
                    <OrderManager />
                </TabsContent>
                <TabsContent value="inventory" className="space-y-4">
                    <InventoryManager />
                </TabsContent>
                <TabsContent value="analytics" className="space-y-4">
                    <ShopAnalytics />
                </TabsContent>
                <TabsContent value="catalog" className="space-y-4">
                    <CatalogManager />
                </TabsContent>
            </Tabs>
        </div>
    );
};
