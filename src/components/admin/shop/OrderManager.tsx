import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isValidImageUrl } from '@/lib/image-utils';
import { getOrders, updateOrderStatus, updateOrderTotal } from '@/services/shop';
import { Order } from '@/types/shop';
import { Check, Eye, Package, Pencil, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const OrderManager = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingTotal, setIsEditingTotal] = useState(false);
    const [newTotal, setNewTotal] = useState('');

    // Filters & Pagination
    const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [paginationStack, setPaginationStack] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [hasMore, setHasMore] = useState(true);

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
            await updateOrderStatus(orderId, newStatus);
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

    const getStatusColor = (status: Order['status']) => {
        switch (status) {
            case 'payment_pending': return 'bg-orange-100 text-orange-800';
            case 'received': return 'bg-blue-100 text-blue-800';
            case 'confirmed': return 'bg-yellow-100 text-yellow-800';
            case 'in_transit': return 'bg-purple-100 text-purple-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
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
                        <SelectItem value="payment_pending">Payment Pending</SelectItem>
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
                                                    <Eye className="h-4 w-4" />
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
                                                                        value={selectedOrder.status} 
                                                                        onValueChange={(val: Order['status']) => handleStatusUpdate(selectedOrder.id, val)}
                                                                    >
                                                                        <SelectTrigger className="w-[180px]">
                                                                            <SelectValue placeholder="Status" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="payment_pending">Payment Pending</SelectItem>
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
                                                            <h4 className="font-semibold mb-2">Order Timeline</h4>
                                                            <div className="space-y-2">
                                                                {selectedOrder.timeline?.map((event, idx) => (
                                                                    <div key={idx} className="flex gap-2 text-sm border-l-2 border-gray-200 pl-3">
                                                                        <div className="w-24 text-gray-500 text-xs shrink-0">
                                                                            {event.timestamp?.toDate ? event.timestamp.toDate().toLocaleString() : new Date().toLocaleString()}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-medium">{event.status.toUpperCase().replace('_', ' ')}</div>
                                                                            {event.note && <div className="text-xs text-gray-500">{event.note}</div>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="font-semibold mb-2">Order Items</h4>
                                                            <div className="border rounded-md divide-y">
                                                                {selectedOrder.items.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between p-3 items-center">
                                                                        <div className="flex items-center gap-3">
                                                                            {isValidImageUrl(item.image) ? (
                                                                                <img src={item.image} alt={item.name} className="h-10 w-10 rounded object-cover" />
                                                                            ) : (
                                                                                <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                                                                                    <Package className="h-5 w-5 text-gray-400" />
                                                                                </div>
                                                                            )}
                                                                            <div>
                                                                                <p className="font-medium text-sm">{item.name}</p>
                                                                                <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="font-medium">
                                                                            ₹{item.price * item.quantity}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex justify-end mt-4 pt-4 border-t items-center gap-2">
                                                                <div className="font-bold flex items-center gap-2">
                                                                    Total: 
                                                                    {isEditingTotal ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <Input 
                                                                                type="number" 
                                                                                value={newTotal} 
                                                                                onChange={(e) => setNewTotal(e.target.value)}
                                                                                className="w-24 h-8"
                                                                            />
                                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleUpdateTotal}>
                                                                                <Check className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setIsEditingTotal(false)}>
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <span onClick={() => {
                                                                            if (selectedOrder.status !== 'confirmed' && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled') {
                                                                                setNewTotal(selectedOrder.totalAmount.toString());
                                                                                setIsEditingTotal(true);
                                                                            }
                                                                        }} className={selectedOrder.status !== 'confirmed' && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' ? "cursor-pointer hover:underline decoration-dashed" : ""}>
                                                                            ₹{selectedOrder.totalAmount}
                                                                        </span>
                                                                    )}
                                                                    
                                                                    {!isEditingTotal && selectedOrder.status !== 'confirmed' && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400 hover:text-gray-900" onClick={() => {
                                                                             setNewTotal(selectedOrder.totalAmount.toString());
                                                                             setIsEditingTotal(true);
                                                                        }}>
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
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
        </div>
    );
};
