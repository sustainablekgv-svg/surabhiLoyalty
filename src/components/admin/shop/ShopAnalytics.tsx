import { Badge as UIBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getActiveProducts, getOrders } from '@/services/shop';
import { Order, Product } from '@/types/shop';
import { endOfDay, endOfMonth, endOfWeek, format, isWithinInterval, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ArrowDown, CreditCard, Package, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const ShopAnalytics = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('month'); // today, week, month, all

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedOrders, fetchedProducts] = await Promise.all([
          getOrders(1000),
          getActiveProducts()
        ]);
        setOrders(fetchedOrders.orders);
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Error loading analytics data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let start, end;

    switch (dateFilter) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now);
        end = endOfWeek(now);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'last_month':
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case 'all':
      default:
        return orders;
    }

    return orders.filter(order => {
        // Handle Firestore timestamp or Date object
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        return isWithinInterval(orderDate, { start, end });
    });
  }, [orders, dateFilter]);

  // Metrics
  const totalSales = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const orderCount = filteredOrders.length;
  const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
  
  // Inventory Value (Snapshot of current stock)
  const inventoryValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const lowStockProducts = products.filter(p => p.stock < 10 && p.stock > 0);
  const outOfStockProducts = products.filter(p => p.stock <= 0);

  // Chart Data (Sales by Day)
  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
       const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
       const key = format(orderDate, 'MMM dd');
       dataMap[key] = (dataMap[key] || 0) + order.totalAmount;
    });

    return Object.keys(dataMap).map(key => ({
      name: key,
      total: dataMap[key]
    })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()); // Simplified sort, might need full date key for proper sorting
  }, [filteredOrders]);

  // Popular Products
  const popularProducts = useMemo(() => {
     const productCount: Record<string, number> = {};
     filteredOrders.forEach(order => {
        order.items.forEach(item => {
           productCount[item.name] = (productCount[item.name] || 0) + item.quantity;
        });
     });
     
     return Object.entries(productCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Dashboard Overview</h3>
            <div className="flex gap-2">
                 <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>
       </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{filteredOrders.length} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Math.round(averageOrderValue).toLocaleString()}</div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{inventoryValue.toLocaleString()}</div>
             <p className="text-xs text-muted-foreground">{products.length} products</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockProducts.length + outOfStockProducts.length}</div>
             <p className="text-xs text-muted-foreground">Items need restock</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
           {/* Chart */}
           <Card className="md:col-span-4">
                <CardHeader>
                    <CardTitle>Sales Trend</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                                <Tooltip formatter={(value) => [`₹${value}`, 'Sales']} />
                                <Bar dataKey="total" fill="#8884d8" radius={[4, 4, 0, 0]} className="fill-primary" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            No sales data for this period
                        </div>
                    )}
                </CardContent>
           </Card>

           {/* Popular Products */}
            <Card className="md:col-span-3">
                <CardHeader>
                    <CardTitle>Popular Products</CardTitle>
                </CardHeader>
                <CardContent>
                     {popularProducts.length > 0 ? (
                        <div className="space-y-4">
                            {popularProducts.map((p, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="font-medium truncate max-w-[200px]">{p.name}</div>
                                    <div className="text-sm text-gray-500">{p.count} sold</div>
                                </div>
                            ))}
                        </div>
                     ) : (
                         <div className="text-center text-muted-foreground py-8">No data</div>
                     )}
                </CardContent>
            </Card>
      </div>

       {/* Low Stock Table */}
       {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
           <Card>
               <CardHeader>
                   <CardTitle className="text-red-600">Low Stock Alerts</CardTitle>
               </CardHeader>
               <CardContent>
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead>Product Name</TableHead>
                               <TableHead>Status</TableHead>
                               <TableHead className="text-right">Stock Left</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {outOfStockProducts.map(p => (
                               <TableRow key={p.id}>
                                   <TableCell className="font-medium">{p.name}</TableCell>
                                   <TableCell><UIBadge variant="destructive">Out of Stock</UIBadge></TableCell>
                                   <TableCell className="text-right text-red-600 font-bold">0</TableCell>
                               </TableRow>
                           ))}
                           {lowStockProducts.map(p => (
                               <TableRow key={p.id}>
                                   <TableCell className="font-medium">{p.name}</TableCell>
                                   <TableCell><UIBadge variant="outline" className="text-orange-500 border-orange-500">Low Stock</UIBadge></TableCell>
                                   <TableCell className="text-right font-bold">{p.stock}</TableCell>
                               </TableRow>
                           ))}
                       </TableBody>
                   </Table>
               </CardContent>
           </Card>
       )}
    </div>
  );
};
