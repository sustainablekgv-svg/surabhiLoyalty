
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/auth-context';
import { isValidImageUrl } from '@/lib/image-utils';
import { cancelOrder, getOrdersByUser, updateOrderAddress } from '@/services/shop';
import { Order } from '@/types/shop';
import { Clock, Eye, MapPin, Package, Truck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const CustomerOrderHistory = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    
    // Actions
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    
    const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
    const [editAddress, setEditAddress] = useState<any>(null);

    const fetchOrders = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getOrdersByUser(user.id);
            setOrders(data);
        } catch (error) {
            console.error("Error fetching orders", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [user]);

    const handleCancelOrder = async () => {
        if (!selectedOrder || !cancelReason) return;
        try {
            await cancelOrder(selectedOrder.id, cancelReason);
            toast.success("Order cancelled successfully");
            setIsCancelDialogOpen(false);
            setCancelReason('');
            fetchOrders(); // Refresh
            setSelectedOrder(null);
        } catch (error) {
            toast.error("Failed to cancel order");
        }
    };

    const handleUpdateAddress = async () => {
        if (!selectedOrder || !editAddress) return;
        try {
            await updateOrderAddress(selectedOrder.id, editAddress);
            toast.success("Shipping address updated");
            setIsEditAddressOpen(false);
            fetchOrders(); // Refresh
            setSelectedOrder(prev => prev ? { ...prev, shippingAddress: editAddress } : null);
        } catch (error) {
            toast.error("Failed to update address");
        }
    };

    const openCancelDialog = (order: Order) => {
        setSelectedOrder(order);
        setCancelReason('');
        setIsCancelDialogOpen(true);
    };

    const openEditAddressDialog = (order: Order) => {
        setSelectedOrder(order);
        setEditAddress({ ...order.shippingAddress });
        setIsEditAddressOpen(true);
    };
    
    const getStatusStep = (status: Order['status']) => {
        const steps = ['payment_pending', 'received', 'confirmed', 'in_transit', 'delivered'];
        if (status === 'cancelled') return -1;
        return steps.indexOf(status);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">My Orders</h2>
            
            {loading ? (
                <div className="text-center py-8">Loading your orders...</div>
            ) : orders.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-gray-50">
                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No orders yet</h3>
                    <p className="text-gray-500">Start shopping to see your orders here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <Card key={order.id} className="overflow-hidden">
                            <CardHeader className="bg-gray-50/50 pb-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="text-sm text-gray-500">Order Placed</div>
                                        <div className="font-medium">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Total Amount</div>
                                        <div className="font-medium">₹{order.totalAmount}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Order ID</div>
                                        <div className="font-mono text-sm">#{order.id.slice(0, 8)}</div>
                                    </div>
                                    <div className="sm:ml-auto">
                                        <Badge className={`
                                            ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                                              order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                                              order.status === 'payment_pending' ? 'bg-orange-100 text-orange-800' :
                                              'bg-blue-100 text-blue-800'} border-0 px-3 py-1
                                        `}>
                                            {order.status.toUpperCase().replace('_', ' ')}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-6">
                                    {/* Order Items Preview */}
                                    <div className="space-y-4">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-4">
                                                {isValidImageUrl(item.image) ? (
                                                    <img src={item.image} alt={item.name} className="h-16 w-16 object-cover rounded border border-gray-100" />
                                                ) : (
                                                    <div className="h-16 w-16 bg-gray-100 rounded border flex items-center justify-center">
                                                        <Package className="h-6 w-6 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-900 truncate">{item.name}</h4>
                                                    <div className="flex flex-wrap gap-x-4 text-sm text-gray-500 mt-1">
                                                        <span>Qty: {item.quantity}</span>
                                                        <span>₹{item.price} each</span>
                                                        {item.gst && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">GST {item.gst.percentage}%</span>}
                                                    </div>
                                                    {item.isAdminUpdated && (
                                                        <Badge variant="outline" className="mt-2 bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-black py-0.5 px-2 animate-pulse">
                                                            ADJUSTED BY STORE
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-right font-medium">
                                                    ₹{item.price * item.quantity}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions & Status Details */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t gap-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            {order.status === 'in_transit' && <><Truck className="h-4 w-4" /> Your order is on the way</>}
                                            {order.status === 'delivered' && <><Package className="h-4 w-4" /> Delivered on {order.updatedAt?.toDate().toLocaleDateString()}</>}
                                            {order.status === 'cancelled' && <><XCircle className="h-4 w-4" /> Order cancelled</>}
                                        </div>
                                        
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                                                        <Eye className="h-4 w-4 mr-2" /> View Details
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Order #{order.id}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-6">
                                                        {/* Status Stepper */}
                                                        {order.status !== 'cancelled' && (
                                                            <div className="relative">
                                                                <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10"></div>
                                                                <div className="flex justify-between">
                                                                    {['Payment Pending', 'Received', 'Confirmed', 'In Transit', 'Delivered'].map((step, index) => {
                                                                        const currentStep = getStatusStep(order.status);
                                                                        const isCompleted = index <= currentStep;
                                                                        const isCurrent = index === currentStep;
                                                                        
                                                                        return (
                                                                            <div key={step} className="flex flex-col items-center bg-white px-2">
                                                                                <div className={`
                                                                                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2
                                                                                    ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'}
                                                                                `}>
                                                                                    {index + 1}
                                                                                </div>
                                                                                <span className={`text-xs mt-1 ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{step}</span>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Timeline */}
                                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                                    <Clock className="h-4 w-4 text-indigo-500" /> 
                                                                    Order Journey
                                                                </h4>
                                                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-white">Live Status</Badge>
                                                            </div>
                                                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                                {order.timeline?.map((event, i) => (
                                                                    <div key={i} className="flex gap-4 group">
                                                                        <div className="flex flex-col items-center">
                                                                            <div className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm mt-1 ${i === (order.timeline?.length || 0) - 1 ? 'bg-indigo-500 ring-4 ring-indigo-100' : 'bg-slate-300'}`}></div>
                                                                            {i < (order.timeline?.length || 0) - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1 mb-1"></div>}
                                                                        </div>
                                                                        <div className="flex-1 pb-4">
                                                                            <div className="flex justify-between items-start mb-1">
                                                                                <div className="font-black text-slate-900 text-xs uppercase tracking-tight">
                                                                                    {event.status.toUpperCase().replace('_', ' ')}
                                                                                    {/* Explicit Admin Label */}
                                                                                    {event.note?.toLowerCase().includes('admin') || event.note?.toLowerCase().includes('updated') ? (
                                                                                        <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-black tracking-tighter self-center">MODIFIED BY STORE</span>
                                                                                    ) : null}
                                                                                </div>
                                                                                <div className="text-[10px] font-mono text-slate-400 text-right leading-tight">
                                                                                    {event.timestamp?.toDate ? (
                                                                                        <>
                                                                                            <div className="font-bold text-slate-500">{event.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                                                                            <div>{event.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                                                                        </>
                                                                                    ) : (
                                                                                        <div className="font-bold">JUST NOW</div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {event.note && (
                                                                                <div className="text-[11px] text-slate-500 bg-white/60 p-2 rounded-lg border border-slate-100/80 italic leading-relaxed">
                                                                                    {event.note}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Items & Summary */}
                                                        <div>
                                                            <h4 className="font-semibold mb-3">Order Summary</h4>
                                                            <div className="border rounded-lg overflow-hidden divide-y">
                                                                {order.items.map((item, idx) => (
                                                                    <div key={idx} className="px-4 py-3 flex justify-between items-center bg-white">
                                                                        <div className="flex items-center gap-3">
                                                                            <img src={item.image} alt="" className="h-10 w-10 object-cover rounded" />
                                                                            <div>
                                                                                <p className="text-sm font-medium">{item.name}</p>
                                                                                <p className="text-xs text-gray-500">{item.quantity} × ₹{item.price}</p>
                                                                                {item.isAdminUpdated && (
                                                                                    <Badge variant="outline" className="mt-1 bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-black py-0.5 px-2">
                                                                                        ADJUSTED BY STORE
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-sm font-semibold">
                                                                            ₹{item.price * item.quantity}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            
                                                            <div className="mt-4 space-y-2 px-1">
                                                                <div className="flex justify-between text-sm text-gray-600">
                                                                    <span>Subtotal</span>
                                                                    <span>₹{order.items.reduce((acc, i) => acc + (i.price * i.quantity), 0)}</span>
                                                                </div>
                                                                {order.totalTax > 0 && (
                                                                    <div className="flex justify-between text-sm text-gray-600">
                                                                        <span>Tax (GST)</span>
                                                                        <span>₹{order.totalTax}</span>
                                                                    </div>
                                                                )}
                                                                {order.adminShippingAdjustment !== 0 && (
                                                                    <div className="flex justify-between text-sm text-gray-600">
                                                                        <span>Shipping Adjustment</span>
                                                                        <span className={order.adminShippingAdjustment && order.adminShippingAdjustment < 0 ? "text-red-500" : "text-green-600"}>
                                                                            {order.adminShippingAdjustment && order.adminShippingAdjustment > 0 ? '+' : ''}
                                                                            ₹{order.adminShippingAdjustment || 0}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between text-base font-bold pt-2 border-t mt-2">
                                                                    <span>Order Total</span>
                                                                    <span>₹{order.totalAmount}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Address */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="border p-4 rounded-lg bg-gray-50/50">
                                                                <h4 className="font-semibold mb-2 flex items-center text-sm uppercase tracking-wider text-gray-500">
                                                                    <MapPin className="h-4 w-4 mr-2" /> Shipping Address
                                                                </h4>
                                                                <div className="text-sm space-y-0.5">
                                                                    <p className="font-medium">{order.shippingAddress.fullName}</p>
                                                                    <p>{order.shippingAddress.street}</p>
                                                                    <p>{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.zipCode}</p>
                                                                    <p className="pt-1 text-gray-600">Ph: {order.shippingAddress.mobile}</p>
                                                                </div>
                                                            </div>
                                                            <div className="border p-4 rounded-lg bg-gray-50/50">
                                                                <h4 className="font-semibold mb-2 flex items-center text-sm uppercase tracking-wider text-gray-500">
                                                                    <Package className="h-4 w-4 mr-2" /> Payment Details
                                                                </h4>
                                                                <div className="text-sm space-y-0.5">
                                                                    <p><span className="text-gray-500">Method:</span> {order.paymentMethod.toUpperCase()}</p>
                                                                    <p><span className="text-gray-500">Status:</span> {order.paymentStatus.toUpperCase()}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                            {(order.status === 'received' || order.status === 'payment_pending') && (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => openEditAddressDialog(order)}>
                                                        Edit Address
                                                    </Button>
                                                    <Button variant="destructive" size="sm" onClick={() => openCancelDialog(order)}>
                                                        Cancel Order
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Cancel Dialog */}
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Order</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this order? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Reason for cancellation</Label>
                        <Textarea 
                            placeholder="Please tell us why you are cancelling..." 
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>Keep Order</Button>
                        <Button variant="destructive" onClick={handleCancelOrder} disabled={!cancelReason}>Cancel Order</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Address Dialog */}
            <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Shipping Address</DialogTitle>
                    </DialogHeader>
                    {editAddress && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input value={editAddress.fullName} onChange={e => setEditAddress({...editAddress, fullName: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Street Address</Label>
                                <Input value={editAddress.street} onChange={e => setEditAddress({...editAddress, street: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>City</Label>
                                    <Input value={editAddress.city} onChange={e => setEditAddress({...editAddress, city: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>State</Label>
                                    <Input value={editAddress.state} onChange={e => setEditAddress({...editAddress, state: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Zip Code</Label>
                                    <Input value={editAddress.zipCode} onChange={e => setEditAddress({...editAddress, zipCode: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mobile</Label>
                                    <Input value={editAddress.mobile} onChange={e => setEditAddress({...editAddress, mobile: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAddressOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateAddress}>Save Address</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
