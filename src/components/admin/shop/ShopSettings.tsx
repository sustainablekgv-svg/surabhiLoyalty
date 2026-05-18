import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { PauseCircle, PlayCircle, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';

export const ShopSettings = () => {
    const { settings, isLoading } = useGlobalSettings();
    const [pauseOrders, setPauseOrders] = useState(false);
    const [pauseMessage, setPauseMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setPauseOrders(!!settings.pauseOrders);
            setPauseMessage(settings.pauseMessage || 'We are currently not accepting new orders. Please check back later.');
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const settingsRef = doc(db, 'settings', 'global');
            await updateDoc(settingsRef, {
                pauseOrders,
                pauseMessage
            });
            toast.success("Shop settings updated successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to update shop settings");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <div className="space-y-6">
            <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        {pauseOrders ? (
                            <PauseCircle className="h-8 w-8 text-amber-600 animate-pulse" />
                        ) : (
                            <PlayCircle className="h-8 w-8 text-emerald-600" />
                        )}
                        <div>
                            <CardTitle className="text-xl">Pause Shop Orders</CardTitle>
                            <CardDescription>
                                Temporarily stop customers from placing new orders while keeping the catalog visible.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-amber-100 shadow-sm">
                        <div className="space-y-0.5">
                            <Label className="text-base font-bold">Orders Status</Label>
                            <p className="text-sm text-gray-500">
                                {pauseOrders 
                                    ? "Shop is currently PAUSED. Customers cannot checkout." 
                                    : "Shop is currently ACTIVE. Customers can place orders."}
                            </p>
                        </div>
                        <Switch 
                            checked={pauseOrders} 
                            onCheckedChange={setPauseOrders}
                            className="data-[state=checked]:bg-amber-600"
                        />
                    </div>

                    {pauseOrders && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label htmlFor="pauseMessage" className="font-bold">Pause Announcement Message</Label>
                            <Input 
                                id="pauseMessage"
                                value={pauseMessage}
                                onChange={(e) => setPauseMessage(e.target.value)}
                                placeholder="Enter message to show to customers..."
                                className="bg-white border-amber-200 focus:ring-amber-500"
                            />
                            <p className="text-[11px] text-amber-700 italic">
                                This message will appear in a scrolling bar at the top of the shop and on product pages.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <Button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className={pauseOrders ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? "Saving..." : "Save Shop Settings"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
