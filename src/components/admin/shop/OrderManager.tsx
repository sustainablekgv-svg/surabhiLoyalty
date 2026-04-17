import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PreviewableImage } from '@/components/ui/previewable-image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { isValidImageUrl } from '@/lib/image-utils';
import { calculateShippingCost, getShippingConfig, getWeightBracketLabel, parseWeightToKg } from '@/services/shipping';
import { adjustOrderShippingBalance, getOrders, getProducts, getStoreByLocation, updateOrderItems, updateOrderStatus, updateOrderTotal } from '@/services/shop';
import { CartItem, Order, Product } from '@/types/shop';
import { collection, getDocs } from 'firebase/firestore';
import { Check, Package, Pencil, Plus, Search, TrendingUp, Truck, X } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getUserName } from '@/lib/userUtils';

export const OrderManager = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingTotal, setIsEditingTotal] = useState(false);
    const [newTotal, setNewTotal] = useState('');
    
    // Shipping Adjustment State
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [showConfirmAdjust, setShowConfirmAdjust] = useState<{type: 'add' | 'deduct', amount: number} | null>(null);
    
    // Items Editing State
    const [isEditingItems, setIsEditingItems] = useState(false);
    const [tempItems, setTempItems] = useState<CartItem[]>([]);
    const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    // Filters & Pagination
    const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [paginationStack, setPaginationStack] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [hasMore, setHasMore] = useState(true);

    // Shipping & Calculation Config
    const [brandsList, setBrandsList] = useState<any[]>([]);
    const [shippingConfig, setShippingConfig] = useState<any>(null);
    const [originsList, setOriginsList] = useState<any[]>([]);

    useEffect(() => {
        const fetchConfig = async () => {
            const [config, originsSnap, brandsSnap] = await Promise.all([
                getShippingConfig(),
                getDocs(collection(db, 'origins')),
                getDocs(collection(db, 'brands'))
            ]);
            setShippingConfig(config);
            setOriginsList(originsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setBrandsList(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchConfig();
    }, []);

    const fetchOrders = async (startAfterDoc?: any) => {
        setLoading(true);
        try {
            const result = await getOrders(
                PAGE_SIZE, 
                startAfterDoc, 
                statusFilter === 'all' ? undefined : statusFilter, 
                searchTerm
            );
            setOrders(result.orders);
            setLastDoc(result.lastDoc);
            setHasMore(result.orders.length >= PAGE_SIZE || (!!searchTerm && result.orders.length > 0)); 
            // Note: with client-side search approximation inside getOrders, hasMore logic might be tricky.
            // If getOrders returns fewer than PAGE_SIZE, typically means end of list.
        } catch (error) {
            console.error("Error fetching orders", error);
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            setPaginationStack([]);
            setLastDoc(null);
            fetchOrders(null);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter]);

    const loadNext = () => {
        if (!lastDoc) return;
        setPaginationStack(prev => [...prev, lastDoc]);
        setPage(prev => prev + 1);
        fetchOrders(lastDoc);
    };

    const loadPrev = () => {
        if (page <= 1) return;
        const newStack = [...paginationStack];
        newStack.pop();
        const prevDoc = newStack[newStack.length - 1] || null;
        setPaginationStack(newStack);
        setPage(prev => prev - 1);
        fetchOrders(prevDoc);
    };

    const handleUpdateTotal = async () => {
        if (!selectedOrder || !newTotal) return;
        try {
            const amount = parseFloat(newTotal);
            if (isNaN(amount)) {
                toast.error("Invalid amount");
                return;
            }
            await updateOrderTotal(selectedOrder.id, amount);
            toast.success("Order total updated");
            
            // Local update
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, totalAmount: amount } : o));
            setSelectedOrder({ ...selectedOrder, totalAmount: amount });
            setIsEditingTotal(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update total");
        }
    };

    const handleStatusUpdate = async (orderId: string, newStatus: Order['status']) => {
        try {
            await updateOrderStatus(orderId, newStatus, undefined, user);
            toast.success(`Order status updated to ${newStatus}`);
            // Optimistic update
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const [currentStore, setCurrentStore] = useState<any>(null);

    useEffect(() => {
        const fetchStore = async () => {
            if (!selectedOrder) return;
            const store = await getStoreByLocation(selectedOrder.shippingAddress.state || 'Main Store'); // Approximating store selection
            setCurrentStore(store);
        };
        fetchStore();
    }, [selectedOrder]);

    // DERIVED SUMMARY LOGIC (Mirroring CheckoutPage.tsx)
    const orderSummary = useMemo(() => {
        if (!selectedOrder || !shippingConfig || originsList.length === 0 || brandsList.length === 0) return null;

        const itemsToCalculate = isEditingItems ? tempItems : selectedOrder.items;
        const postalState = selectedOrder.shippingAddress.state;

        // 1. Group by brand for shipping
        const groups = itemsToCalculate.reduce<Record<string, any>>((acc, item: CartItem) => {
            const brandName = item.brandName || 'Other';
            const originName = (item.placeOfOrigin && item.placeOfOrigin.length > 0) ? item.placeOfOrigin[0] : 'Unknown';
            const groupKey = brandName;
        
            if (!acc[groupKey]) {
                const originObj = originsList.find(o => o.name && o.name.toLowerCase() === originName.toLowerCase());
                const brandObj = brandsList.find(b => b.name && b.name.toLowerCase() === brandName.toLowerCase());
                
                acc[groupKey] = {
                    brandName,
                    originName,
                    items: [],
                    weight: 0,
                    displayWeight: 0,
                    shipping: 0,
                    originZone: originObj?.zone || 'A',
                    groupSpv: 0,
                    creditPercentage: brandObj?.shippingPercentage ?? (currentStore?.shippingCommission || 0)
                };
            }
            acc[groupKey].items.push(item);
            
            const weight = item.weightInKg || parseWeightToKg(item.weight || '0.5kg');
            acc[groupKey].displayWeight += (weight * item.quantity);
            acc[groupKey].groupSpv += (item.spv || 0) * item.quantity;
            
            if (!item.freeShipping) {
                acc[groupKey].weight += (weight * item.quantity);
            }
            return acc;
        }, {});

        // 2. Calculate shipping per group
        if (postalState) {
            Object.values(groups).forEach(group => {
                const effectiveWeight = group.weight > 0 ? group.weight : group.displayWeight;
                if (effectiveWeight > 0) {
                    const cost = calculateShippingCost(effectiveWeight, group.originZone, postalState, shippingConfig);
                    group.shipping = cost;
                    group.bracketLabel = getWeightBracketLabel(effectiveWeight);
                }
            });
        }

        // 3. Totals
        const itemsTotalInclTax = itemsToCalculate.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalTax = itemsToCalculate.reduce((sum, item) => {
            if (!item.gst?.percentage) return sum;
            const gstRate = item.gst.percentage / 100;
            const baseLineTotal = (item.price * item.quantity) / (1 + gstRate);
            return sum + ((item.price * item.quantity) - baseLineTotal);
        }, 0);
        const subtotal = itemsTotalInclTax - totalTax;
        const totalSpv = itemsToCalculate.reduce((sum, item) => sum + ((item.spv || 0) * item.quantity), 0);

        const shippingCost = Object.values(groups).reduce((sum: number, g: any) => sum + g.shipping, 0);
        const shippingCreditsUsed = selectedOrder.shippingPointsUsed || 0;
        const netShippingCharges = Math.max(0, shippingCost - shippingCreditsUsed);
        
        // Match CheckoutPage.tsx logic: Inclusive discount application
        const totalCoins = Math.min(selectedOrder.surabhiCoinsUsed || 0, itemsTotalInclTax);
        const discountPercent = itemsTotalInclTax > 0 ? totalCoins / itemsTotalInclTax : 0;

        const totalAdjustedTax = itemsToCalculate.reduce((sum, item) => {
            if (!item.gst?.percentage) return sum;
            const originalItemTotalInclTax = item.price * item.quantity;
            
            const itemDiscount = originalItemTotalInclTax * discountPercent;
            const adjustedLineTotal = originalItemTotalInclTax - itemDiscount;
            
            const gstRate = item.gst.percentage / 100;
            const adjustedBaseLineTotal = adjustedLineTotal / (1 + gstRate);
            const adjustedTax = adjustedLineTotal - adjustedBaseLineTotal;
            
            return sum + adjustedTax;
        }, 0);

        const adjustedTotalItemsValue = itemsTotalInclTax - totalCoins;
        const itemsTotalAfterCoins = adjustedTotalItemsValue; 

        // ASPV Calculation
        const aggregateAdjustedSpv = itemsTotalInclTax > 0 
            ? (itemsTotalAfterCoins * totalSpv) / itemsTotalInclTax 
            : 0;

        const netSpvForEarning = Math.max(0, aggregateAdjustedSpv);

        // Earnings
        const totalShippingCreditsEarned = totalSpv > 0 ? Object.values(groups).reduce((sum, group) => {
            const groupShareOfNetSPV = (group.groupSpv / totalSpv) * netSpvForEarning;
            return sum + ((groupShareOfNetSPV * group.creditPercentage) / 100);
        }, 0) : 0;

        const surabhiCoinsEarned = currentStore ? Number(((netSpvForEarning * (currentStore.cashOnlyCommission || 0)) / 100).toFixed(2)) : 0;
        const sevaCoinsEarned = currentStore ? Number(((netSpvForEarning * (currentStore.sevaCommission || 0)) / 100).toFixed(2)) : 0;
        const referralBonusEarned = currentStore ? Number(((netSpvForEarning * (currentStore.referralCommission || 0)) / 100).toFixed(2)) : 0;

        const totalPayableAmount = itemsTotalAfterCoins + netShippingCharges + (selectedOrder.adminShippingAdjustment || 0);

        const adjustedItems = itemsToCalculate.map(item => {
            const gstRate = (item.gst?.percentage || 0) / 100;
            const originalTotalInclTax = item.price * item.quantity;
            const originalTax = originalTotalInclTax - (originalTotalInclTax / (1 + gstRate));
            const originalBase = originalTotalInclTax - originalTax;
            
            const itemDiscount = originalTotalInclTax * discountPercent;
            const adjustedLineTotal = originalTotalInclTax - itemDiscount;
            const adjustedBaseLineTotal = adjustedLineTotal / (1 + gstRate);
            const adjustedTax = adjustedLineTotal - adjustedBaseLineTotal;
            
            return {
                ...item,
                originalBase,
                originalTax,
                originalTotalInclTax,
                adjustedBaseLineTotal,
                adjustedTax,
                adjustedLineTotal
            };
        });

        return {
            groups,
            subtotal,
            shippingCost,
            totalTax,
            totalAdjustedTax,
            adjustedTaxValue: itemsTotalAfterCoins - totalAdjustedTax,
            totalSpv,
            itemsTotalInclTax,
            itemsTotalAfterCoins,
            aggregateAdjustedSpv,
            totalShippingCreditsEarned,
            surabhiCoinsEarned,
            sevaCoinsEarned,
            referralBonusEarned,
            totalPayableAmount,
            netShippingCharges,
            adjustedItems
        };
    }, [selectedOrder, tempItems, isEditingItems, shippingConfig, originsList, brandsList, currentStore]);

    const handleAdjustShipping = async () => {
        if (!selectedOrder || !showConfirmAdjust || !user) return;
        
        setIsAdjusting(true);
        try {
            const magnitude = Math.abs(showConfirmAdjust.amount);
            await adjustOrderShippingBalance(
                selectedOrder.id,
                selectedOrder.userId,
                magnitude,
                showConfirmAdjust.type === 'add',
                user
            );
            
            toast.success(`Successfully ${showConfirmAdjust.type === 'add' ? 'added' : 'deducted'} shipping credits.`);
            
            const adjustmentDelta =
                showConfirmAdjust.type === 'add' ? magnitude : -magnitude;
            
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { 
                ...o, 
                adminShippingAdjustment: (o.adminShippingAdjustment || 0) + adjustmentDelta,
                totalAmount: (o.totalAmount || 0) + adjustmentDelta
            } : o));
            
            setSelectedOrder(prev => prev ? { 
                ...prev, 
                adminShippingAdjustment: (prev.adminShippingAdjustment || 0) + adjustmentDelta,
                totalAmount: (prev.totalAmount || 0) + adjustmentDelta
            } : null);
            
            setAdjustmentAmount('');
            setShowConfirmAdjust(null);
            
        } catch (error: any) {
            console.error("Adjustment error", error);
            toast.error(error.message || "Failed to adjust shipping credits");
        } finally {
            setIsAdjusting(false);
        }
    };

    const handleEditItems = () => {
        setTempItems([...(selectedOrder?.items || [])]);
        setIsEditingItems(true);
    };

    const handleQuantityChange = (index: number, delta: number) => {
        const newItems = [...tempItems];
        newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
        setTempItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        if (tempItems.length <= 1) {
            toast.error("An order must have at least one item.");
            return;
        }
        setTempItems(prev => prev.filter((_, i) => i !== index));
    };

    const fetchCatalog = async () => {
        if (catalogProducts.length > 0) return;
        try {
            const result = await getProducts({ includeInactive: false }, null, 100);
            setCatalogProducts(result.products);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load products");
        }
    };

    const handleAddProduct = (product: Product) => {
        const existingIndex = tempItems.findIndex(item => item.productId === product.id);
        if (existingIndex > -1) {
            handleQuantityChange(existingIndex, 1);
        } else {
            const newItem: CartItem = {
                productId: product.id,
                name: product.name,
                price: product.sellingPrice,
                image: product.images?.[0] || '',
                quantity: 1,
                maxStock: product.stock,
                brandId: product.brandId,
                brandName: product.brandName,
                categoryId: product.categoryId,
                categoryName: product.categoryName,
                spv: product.spv,
                placeOfOrigin: product.placeOfOrigin || [],
                gst: product.gst,
                weightInKg: product.weightInKg,
                unitsOfMeasure: product.unitsOfMeasure,
                productQuantity: product.quantity || product.weight
            };
            setTempItems([...tempItems, newItem]);
        }
        setIsAddingProduct(false);
    };

    const handleSaveItems = async () => {
        if (!selectedOrder || !orderSummary) return;
        try {
            const updatedItems = tempItems.map(tempItem => {
                const originalItem = selectedOrder.items.find(i => i.productId === tempItem.productId);
                if (!originalItem || originalItem.quantity !== tempItem.quantity) {
                    return { ...tempItem, isAdminUpdated: true };
                }
                return tempItem;
            });

            const summary = updatedItems
                .filter(i => i.isAdminUpdated)
                .map(i => `${i.name} (Qty: ${i.quantity})`)
                .join(', ');

            const updates: Partial<Order> = {
                items: updatedItems,
                totalAmount: orderSummary.totalPayableAmount,
                totalTax: orderSummary.totalAdjustedTax,
                netShippingCharges: orderSummary.netShippingCharges,
                shippingPointsEarned: orderSummary.totalShippingCreditsEarned,
                surabhiCoinsEarned: orderSummary.surabhiCoinsEarned,
                sevaCoinsEarned: orderSummary.sevaCoinsEarned,
                referralBonusEarned: orderSummary.referralBonusEarned
            };

            await updateOrderItems(selectedOrder.id, updates, summary ? `Items updated: ${summary}` : undefined);
            toast.success("Order updated successfully");
            
            fetchOrders(null);
            setIsEditingItems(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save order changes");
        }
    };

    const getStatusColor = (status: Order['status']) => {
        switch (status) {
            case 'pending': return 'bg-slate-100 text-slate-800 border border-slate-200';
            case 'payment_pending': return 'bg-orange-100 text-orange-800 border border-orange-200';
            case 'paid': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
            case 'received': return 'bg-blue-100 text-blue-800 border border-blue-200';
            case 'confirmed': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
            case 'in_transit': return 'bg-purple-100 text-purple-800 border border-purple-200';
            case 'delivered': return 'bg-green-100 text-green-800 border border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border border-red-200';
            default: return 'bg-gray-100 text-gray-800 border border-gray-200';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search Order ID, Name, Phone..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="payment_pending">Payment Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : orders.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8">No orders found</TableCell></TableRow>
                        ) : (
                            orders.map(order => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                                    <TableCell>
                                        {/* Handle Firestore Timestamp */}
                                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div>{order.shippingAddress?.fullName || 'Unknown'}</div>
                                            <div className="text-xs text-gray-500">{order.shippingAddress?.mobile}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{order.items.length} items</TableCell>
                                    <TableCell>₹{order.totalAmount}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`border-0 ${getStatusColor(order.status)}`}>
                                            {order.status.toUpperCase().replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button size="icon" variant="ghost" onClick={() => setSelectedOrder(order)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>Order Details</DialogTitle>
                                                </DialogHeader>
                                                {selectedOrder && (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <h4 className="font-semibold mb-1">Shipping Address</h4>
                                                                <p>{selectedOrder.shippingAddress.fullName}</p>
                                                                <p>{selectedOrder.shippingAddress.street}</p>
                                                                <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.zipCode}</p>
                                                                <p>Phone: {selectedOrder.shippingAddress.mobile}</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <h4 className="font-semibold mb-1">Payment</h4>
                                                                    <p>Method: {selectedOrder.paymentMethod.toUpperCase()}</p>
                                                                    <p>Status: {selectedOrder.paymentStatus.toUpperCase()}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-semibold mb-1">Order Status</h4>
                                                                    <Select 
                                                                        key={`${selectedOrder.id}-${selectedOrder.status}`}
                                                                        value={selectedOrder.status} 
                                                                        onValueChange={(val: Order['status']) => handleStatusUpdate(selectedOrder.id, val)}
                                                                    >
                                                                        <SelectTrigger className="w-[180px]">
                                                                            <SelectValue placeholder="Status" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="pending">Pending</SelectItem>
                                                                            <SelectItem value="payment_pending">Payment Pending</SelectItem>
                                                                            <SelectItem value="paid">Paid</SelectItem>
                                                                            <SelectItem value="received">Received</SelectItem>
                                                                            <SelectItem value="confirmed">Confirmed</SelectItem>
                                                                            <SelectItem value="in_transit">In Transit</SelectItem>
                                                                            <SelectItem value="delivered">Delivered</SelectItem>
                                                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Timeline */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="font-semibold">Order Timeline</h4>
                                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold font-mono">Visible to Customer</span>
                                                            </div>
                                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                                {selectedOrder.timeline?.map((event, idx) => (
                                                                    <div key={idx} className="flex gap-2 text-sm border-l-2 border-slate-200 pl-3 py-1">
                                                                        <div className="w-28 text-slate-500 text-[10px] font-mono leading-tight shrink-0">
                                                                            {/* Enhanced Timestamp Formatting */}
                                                                            {event.timestamp?.toDate ? (
                                                                                <>
                                                                                    <div className="font-bold">{event.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                                                    <div>{event.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <div className="font-bold">{new Date().toLocaleDateString()}</div>
                                                                                    <div>{new Date().toLocaleTimeString()}</div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="font-black text-slate-800 text-xs uppercase tracking-tight">{event.status.toUpperCase().replace('_', ' ')}</div>
                                                                            {event.note && (
                                                                                <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded mt-1 border border-slate-100 italic leading-relaxed">
                                                                                    {event.note}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Internal Admin Notes (NOT Visible to Customer) */}
                                                        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xl">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                                    <Pencil className="h-3 w-3" />
                                                                    Internal Admin Notes
                                                                </h4>
                                                                <Badge variant="outline" className="border-slate-700 text-slate-400 text-[9px] font-black uppercase tracking-tighter">Private / Staff Only</Badge>
                                                            </div>

                                                            <div className="space-y-3 mb-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                                {(selectedOrder.internalNotes || []).length === 0 ? (
                                                                    <p className="text-[11px] text-slate-500 italic text-center py-2">No internal notes yet.</p>
                                                                ) : (
                                                                    selectedOrder.internalNotes?.map((note, idx) => (
                                                                        <div key={idx} className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
                                                                            <div className="flex justify-between items-start mb-1 text-[9px] font-bold text-slate-500 border-b border-slate-700/30 pb-1">
                                                                                <span className="text-indigo-400">By: {note.adminName}</span>
                                                                                <span className="font-mono">
                                                                                    {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString('en-IN') : new Date().toLocaleString()}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-300 leading-relaxed pt-1">{note.note}</p>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>

                                                            <div className="flex gap-2">
                                                                <Input 
                                                                    className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-9 focus-visible:ring-indigo-500/50" 
                                                                    placeholder="Add a private note..." 
                                                                    id="newInternalNote"
                                                                    onKeyDown={async (e) => {
                                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                                            const val = e.currentTarget.value.trim();
                                                                            const input = e.currentTarget;
                                                                            try {
                                                                                const { addInternalNote } = await import('@/services/shop');
                                                                                await addInternalNote(selectedOrder.id, val, getUserName(user) || 'Admin');
                                                                                input.value = '';
                                                                                toast.success("Note added");
                                                                                // Refresh local state if possible or refetch
                                                                                fetchOrders(null); 
                                                                                setSelectedOrder(null); // Close to refresh for now
                                                                            } catch (err) {
                                                                                toast.error("Failed to add note");
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                                <Button 
                                                                    size="sm" 
                                                                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-xs whitespace-nowrap"
                                                                    onClick={async () => {
                                                                        const input = document.getElementById('newInternalNote') as HTMLInputElement;
                                                                        if (input?.value.trim()) {
                                                                            try {
                                                                                const { addInternalNote } = await import('@/services/shop');
                                                                                await addInternalNote(selectedOrder.id, input.value.trim(), getUserName(user) || 'Admin');
                                                                                input.value = '';
                                                                                toast.success("Note added");
                                                                                fetchOrders(null);
                                                                                setSelectedOrder(null);
                                                                            } catch (err) {
                                                                                toast.error("Failed to add note");
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    Post
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Shipping Adjustment */}
                                                        <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                                                            <h4 className="font-semibold mb-2 text-blue-900">Admin Shipping Adjustment</h4>
                                                            <div className="flex flex-col gap-2">
                                                                <div className="text-sm text-blue-800 mb-2">
                                                                    Total Adjustments Made to Order: ₹{selectedOrder.adminShippingAdjustment || 0}
                                                                </div>
                                                                <div className="flex gap-2 items-center">
                                                                    <Input 
                                                                        type="number" 
                                                                        placeholder="Amount (e.g. 50 or -50)" 
                                                                        value={adjustmentAmount}
                                                                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                                                                        className="w-48 bg-white"
                                                                    />
                                                                    <Button 
                                                                        variant="default" 
                                                                        size="sm"
                                                                        disabled={!adjustmentAmount.trim() || !Number.isFinite(parseFloat(adjustmentAmount)) || parseFloat(adjustmentAmount) === 0}
                                                                        onClick={() => {
                                                                            const amt = parseFloat(adjustmentAmount);
                                                                            if (!Number.isFinite(amt) || amt === 0) return;
                                                                            setShowConfirmAdjust({ type: amt > 0 ? 'add' : 'deduct', amount: Math.abs(amt) });
                                                                        }}
                                                                    >
                                                                        Apply Adjustment
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                                                    <Package className="h-5 w-5" />
                                                                    Order Items
                                                                </h4>
                                                                {!isEditingItems && (selectedOrder.status === 'received' || selectedOrder.status === 'payment_pending') && (
                                                                    <Button size="sm" variant="outline" onClick={handleEditItems}>
                                                                        <Pencil className="h-4 w-4 mr-2" /> Edit Items
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="w-full overflow-hidden border border-slate-200 rounded-xl">
                                                                <table className="w-full text-left border-collapse table-auto">
                                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                                        <tr className="border-b border-slate-200">
                                                                            <th className="pl-4 pr-2 py-3 text-[11px] font-black uppercase text-slate-500 tracking-wider">Product</th>
                                                                            <th className="px-1.5 py-3 text-[11px] font-black uppercase text-slate-500 text-center tracking-wider">Qty</th>
                                                                            <th className="px-1.5 py-3 text-[11px] font-black uppercase text-slate-500 text-right tracking-wider">Base</th>
                                                                            <th className="px-1.5 py-3 text-[11px] font-black uppercase text-slate-500 text-right tracking-wider">Tax</th>
                                                                            <th className="pl-2 pr-4 py-3 text-[11px] font-black uppercase text-slate-500 text-right tracking-wider">Total</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 italic">
                                                                        {(orderSummary?.adjustedItems || []).map((item, idx) => (
                                                                            <React.Fragment key={idx}>
                                                                                {/* Original Row */}
                                                                                <tr className="bg-white hover:bg-slate-50/50 transition-colors">
                                                                                    <td className="pl-4 pr-2 py-3 relative">
                                                                                        {isEditingItems && (
                                                                                            <Button 
                                                                                                size="icon" 
                                                                                                variant="destructive" 
                                                                                                className="h-5 w-5 rounded-full absolute -top-1 -left-1 shadow-sm z-10"
                                                                                                onClick={() => handleRemoveItem(idx)}
                                                                                            >
                                                                                                <X className="h-3 w-3" />
                                                                                            </Button>
                                                                                        )}
                                                                                        <div className="flex items-center gap-3">
                                                                                            {isValidImageUrl(item.image) ? (
                                                                                                <PreviewableImage src={item.image} alt={item.name} className="h-10 w-10 rounded-md object-cover border border-slate-100 flex-shrink-0" />
                                                                                            ) : (
                                                                                                <div className="h-10 w-10 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
                                                                                                    <Package className="h-4 w-4 text-slate-400" />
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="min-w-0">
                                                                                                <p className="font-bold text-slate-900 text-xs truncate leading-tight">{item.name}</p>
                                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                                    <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">SPV: {item.spv}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-1.5 py-3 text-center">
                                                                                        {isEditingItems ? (
                                                                                            <div className="flex items-center justify-center bg-slate-100 rounded-lg p-0.5">
                                                                                                <Button 
                                                                                                    size="icon" 
                                                                                                    variant="ghost" 
                                                                                                    className="h-6 w-6 text-slate-600"
                                                                                                    onClick={() => handleQuantityChange(idx, -1)}
                                                                                                >
                                                                                                    -
                                                                                                </Button>
                                                                                                <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                                                                                                <Button 
                                                                                                    size="icon" 
                                                                                                    variant="ghost" 
                                                                                                    className="h-6 w-6 text-slate-600"
                                                                                                    onClick={() => handleQuantityChange(idx, 1)}
                                                                                                >
                                                                                                    +
                                                                                                </Button>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-sm font-bold text-slate-600">{item.quantity}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-1.5 py-3 text-right text-xs font-medium text-slate-600 whitespace-nowrap">
                                                                                        ₹{item.originalBase.toFixed(2)}
                                                                                    </td>
                                                                                    <td className="px-1.5 py-3 text-right text-xs font-medium text-slate-600 whitespace-nowrap">
                                                                                        ₹{item.originalTax.toFixed(2)}
                                                                                        <span className="block text-[8px] text-slate-400 font-black">({item.gst?.percentage || 0}%)</span>
                                                                                    </td>
                                                                                    <td className="pl-2 pr-4 py-3 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                                                                                        ₹{item.originalTotalInclTax.toFixed(2)}
                                                                                    </td>
                                                                                </tr>

                                                                                {/* Adjusted Row (Only if coins used) */}
                                                                                {(selectedOrder.surabhiCoinsUsed || 0) > 0 && (
                                                                                    <tr className="bg-slate-50/30">
                                                                                        <td className="pl-4 pr-2 py-2">
                                                                                            <span className="inline-flex items-center px-1 py-0.5 rounded bg-slate-900 text-white text-[7px] font-black uppercase tracking-widest leading-none">
                                                                                                ADJUSTED
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-1.5 py-2 text-center text-slate-300">-</td>
                                                                                        <td className="px-1.5 py-2 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                                                                                            ₹{item.adjustedBaseLineTotal.toFixed(2)}
                                                                                        </td>
                                                                                        <td className="px-1.5 py-2 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                                                                                            ₹{item.adjustedTax.toFixed(2)}
                                                                                            <span className="block text-[8px] text-slate-400 font-black">({item.gst?.percentage || 0}%)</span>
                                                                                        </td>
                                                                                        <td className="pl-2 pr-4 py-2 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                                                                                            ₹{item.adjustedLineTotal.toFixed(2)}
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </React.Fragment>
                                                                        ))}
                                                                    </tbody>
                                                                </table>

                                                                {isEditingItems && (
                                                                    <div className="p-4 bg-slate-50 flex justify-center border-t border-slate-200">
                                                                        <Dialog open={isAddingProduct} onOpenChange={(open) => {
                                                                            setIsAddingProduct(open);
                                                                            if (open) fetchCatalog();
                                                                        }}>
                                                                            <DialogTrigger asChild>
                                                                                <Button variant="outline" size="sm" className="bg-white hover:bg-slate-100 border-dashed border-2">
                                                                                    <Plus className="h-4 w-4 mr-2" /> Add More Products
                                                                                </Button>
                                                                            </DialogTrigger>
                                                                            <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0 overflow-hidden">
                                                                                <DialogHeader className="p-4 border-b">
                                                                                    <DialogTitle>Add Product to Order</DialogTitle>
                                                                                </DialogHeader>
                                                                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                                                    {catalogProducts.map(product => (
                                                                                        <div 
                                                                                            key={product.id} 
                                                                                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                                                                                            onClick={() => handleAddProduct(product)}
                                                                                        >
                                                                                            {isValidImageUrl(product.images?.[0]) ? (
                                                                                                <img src={product.images[0]} alt="" className="h-10 w-10 object-cover rounded shadow-sm" />
                                                                                            ) : (
                                                                                                <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                                                                                                    <Package className="h-5 w-5 text-slate-400" />
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="text-sm font-bold truncate">{product.name}</p>
                                                                                                <p className="text-xs text-slate-500">₹{product.sellingPrice} • Stock: {product.stock}</p>
                                                                                            </div>
                                                                                            <Plus className="h-4 w-4 text-slate-400" />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </DialogContent>
                                                                        </Dialog>
                                                                    </div>
                                                                )}
                                                            </div>

                                                        {/* Brand Wise Shipping Breakdown */}
                                                        {orderSummary && (
                                                            <div className="py-3 space-y-2.5 border border-indigo-100 bg-indigo-50/30 rounded-xl px-4 my-4">
                                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex justify-between items-center">
                                                                    <span>Delivery Breakdown</span>
                                                                    <span className="text-indigo-600">Brand Wise</span>
                                                                </p>
                                                                {Object.values(orderSummary.groups).map((group: any) => (
                                                                    <div key={group.brandName} className="grid grid-cols-2 gap-4 items-center border-b border-indigo-100/30 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold text-slate-700">{group.brandName}</span>
                                                                            <span className="text-[9px] text-indigo-500 font-medium leading-none mt-1">Total Weight: {group.displayWeight.toFixed(2)}kg</span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="text-xs font-black text-slate-900">₹{group.shipping.toFixed(2)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="mt-8 p-0 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                                                            <div className="bg-slate-50 border-b border-slate-100 p-6">
                                                                <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                                                                    <span className="h-1 w-4 bg-slate-900 rounded-full"></span>
                                                                    Order Financial Summary
                                                                </h4>
                                                            </div>
                                                            {orderSummary && (
                                                                <div className="p-6 space-y-4">
                                                                    <div className="space-y-3 text-sm font-medium text-slate-600">
                                                                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                                                                            <span className="text-sm font-medium text-purple-900">Items Total (Excl Tax)</span>
                                                                            <span className="font-bold text-purple-600">₹{orderSummary.subtotal.toFixed(2)}</span>
                                                                        </div>

                                                                        <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                                                            <span className="text-sm font-medium text-indigo-900 font-bold italic">Total SPV Points</span>
                                                                            <span className="font-bold text-indigo-600 font-mono italic">{orderSummary.totalSpv.toFixed(2)}</span>
                                                                        </div>
                                                                        
                                                                        {(selectedOrder.surabhiCoinsUsed || 0) > 0 && (
                                                                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                                                                                <span className="text-sm font-medium text-amber-900">
                                                                                    Surabhi Coins Applied ({(((selectedOrder.surabhiCoinsUsed || 0) / (orderSummary.itemsTotalInclTax || 1)) * 100).toFixed(1)}%)
                                                                                </span>
                                                                                <span className="font-bold text-amber-600">-{(selectedOrder.surabhiCoinsUsed || 0).toFixed(2)}</span>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                                            <span className="text-sm font-medium text-slate-700">Adjusted Total Items Value</span>
                                                                            <span className="font-bold text-slate-900">₹{orderSummary.adjustedTaxValue.toFixed(2)}</span>
                                                                        </div>

                                                                        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                                            <span className="text-sm font-medium text-slate-700">Adjusted Tax value</span>
                                                                            <span className="font-bold text-slate-900">₹{orderSummary.totalAdjustedTax.toFixed(2)}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                                                                            <span className="text-sm font-medium text-emerald-900 font-bold">Adjusted Items Total(Incl Tax)</span>
                                                                            <span className="font-bold text-emerald-600">₹{orderSummary.itemsTotalAfterCoins.toFixed(2)}</span>
                                                                        </div>

                                                                        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                                                                            <span className="text-sm font-medium text-indigo-900">Total Delivery Charges</span>
                                                                            <span className="font-bold text-indigo-600">₹{orderSummary.shippingCost.toFixed(2)}</span>
                                                                        </div>

                                                                        {(selectedOrder.shippingPointsUsed !== undefined && selectedOrder.shippingPointsUsed !== 0) && (
                                                                            <div className={`flex items-center justify-between p-3 rounded-lg ${selectedOrder.shippingPointsUsed > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                                                                                <span className={`text-sm font-black ${selectedOrder.shippingPointsUsed > 0 ? 'text-blue-900' : 'text-red-900'}`}>
                                                                                    {selectedOrder.shippingPointsUsed > 0 ? 'Shipping Credits Applied (Capped at Fee)' : 'Previous Shipping Dues (Added Total)'}
                                                                                </span>
                                                                                <span className={`font-bold ${selectedOrder.shippingPointsUsed > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                                                    {selectedOrder.shippingPointsUsed > 0 ? '-' : '+'}₹{Math.abs(selectedOrder.shippingPointsUsed).toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {(selectedOrder.adminShippingAdjustment || 0) !== 0 && (
                                                                            <div className="flex justify-between p-3 bg-blue-50/50 rounded-lg font-bold">
                                                                                <span className="text-blue-900 border-b border-blue-200">Admin Balance Adjustment</span>
                                                                                <span className={(selectedOrder.adminShippingAdjustment || 0) < 0 ? "text-red-600" : "text-emerald-600"}>
                                                                                    {(selectedOrder.adminShippingAdjustment || 0) > 0 ? '+' : ''}{(selectedOrder.adminShippingAdjustment || 0).toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="pt-4 border-t border-slate-300">
                                                                        <div className="flex justify-between items-end">
                                                                            <div>
                                                                                <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-1">Total Payable Amount</p>
                                                                                <div className="flex items-center gap-2">
                                                                                    {isEditingTotal ? (
                                                                                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
                                                                                            <Input 
                                                                                                type="number" 
                                                                                                value={newTotal} 
                                                                                                onChange={(e) => setNewTotal(e.target.value)}
                                                                                                className="w-32 h-10 text-right font-black text-xl border-0 focus-visible:ring-0"
                                                                                            />
                                                                                            <Button size="icon" variant="ghost" className="h-10 w-10 text-emerald-600 hover:bg-emerald-50" onClick={handleUpdateTotal}>
                                                                                                <Check className="h-5 w-5" />
                                                                                            </Button>
                                                                                            <Button size="icon" variant="ghost" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => setIsEditingTotal(false)}>
                                                                                                <X className="h-5 w-5" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center gap-3">
                                                                                            <h2 
                                                                                                className={`text-5xl font-black text-slate-900 leading-none tracking-tighter ${!['confirmed', 'delivered', 'cancelled'].includes(selectedOrder.status) ? "cursor-pointer hover:text-slate-600 transition-colors" : ""}`}
                                                                                                onClick={() => {
                                                                                                    if (!['confirmed', 'delivered', 'cancelled'].includes(selectedOrder.status)) {
                                                                                                        setNewTotal(orderSummary.totalPayableAmount.toFixed(2));
                                                                                                        setIsEditingTotal(true);
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                ₹{orderSummary.totalPayableAmount.toFixed(2)}
                                                                                            </h2>
                                                                                            {!['confirmed', 'delivered', 'cancelled'].includes(selectedOrder.status) && (
                                                                                                <Pencil 
                                                                                                    className="h-4 w-4 text-slate-300 cursor-pointer hover:text-slate-900 transition-colors" 
                                                                                                    onClick={() => {
                                                                                                        setNewTotal(orderSummary.totalPayableAmount.toFixed(2));
                                                                                                        setIsEditingTotal(true);
                                                                                                    }}
                                                                                                />
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-3 flex items-center gap-2">
                                                                                    <span className="h-1 w-4 bg-slate-200 rounded-full"></span>
                                                                                    Inclusive of GST & Delivery Fees
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Rewards Projection */}
                                                                    <div className="pt-5 border-t border-slate-200">
                                                                        <div className="flex flex-col gap-1 mb-4">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                                <TrendingUp className="h-3 w-3" />
                                                                                Projected Order Earnings (ASPV: {orderSummary.aggregateAdjustedSpv.toFixed(2)})
                                                                            </p>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                                                            <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Surabhi Coins</span>
                                                                                <span className="text-sm font-black text-green-600">{orderSummary.surabhiCoinsEarned}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Shipping Credit</span>
                                                                                <span className="text-sm font-black text-emerald-600">₹{orderSummary.totalShippingCreditsEarned.toFixed(2)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Seva Pool</span>
                                                                                <span className="text-sm font-black text-blue-600">₹{orderSummary.sevaCoinsEarned.toFixed(2)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Referral Bonus</span>
                                                                                <span className="text-sm font-black text-indigo-600">₹{orderSummary.referralBonusEarned.toFixed(2)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {isEditingItems && (
                                                                <div className="mt-6 flex gap-3">
                                                                    <Button variant="outline" className="flex-1 font-bold" onClick={() => setIsEditingItems(false)}>
                                                                        Cancel
                                                                    </Button>
                                                                    <Button className="flex-1 font-bold bg-slate-900" onClick={handleSaveItems}>
                                                                        Save Changes
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </DialogContent>
                                        </Dialog>
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

            {/* Confirmation Dialog */}
            <Dialog open={!!showConfirmAdjust} onOpenChange={(open) => !open && setShowConfirmAdjust(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Shipping Adjustment</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p>
                            Are you sure you want to <strong>{showConfirmAdjust?.type === 'add' ? 'add' : 'deduct'} ₹{Math.abs(showConfirmAdjust?.amount || 0)}</strong> to this customer&apos;s shipping credit balance for this order?
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            This will create a ledger entry and update the customer&apos;s shipping balance immediately. Order total is adjusted to match.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmAdjust(null)} disabled={isAdjusting}>Cancel</Button>
                        <Button variant={showConfirmAdjust?.type === 'add' ? 'default' : 'destructive'} onClick={handleAdjustShipping} disabled={isAdjusting}>
                            {isAdjusting ? "Processing..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};
