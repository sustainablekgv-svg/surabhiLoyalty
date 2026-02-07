import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandManager } from "./BrandManager";
import { CategoryManager } from "./CategoryManager";
import { ProductManager } from "./ProductManager";

export const CatalogManager = () => {
    return (
        <div className="h-full p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Catalog Management</h1>
            </div>

            <Tabs defaultValue="categories" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="brands">Brands</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="space-y-4">
                    <CategoryManager />
                </TabsContent>

                <TabsContent value="brands" className="space-y-4">
                    <BrandManager />
                </TabsContent>

                <TabsContent value="products" className="space-y-4">
                    <ProductManager />
                </TabsContent>
            </Tabs>
        </div>
    );
};
