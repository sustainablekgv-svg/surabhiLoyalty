import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getShippingConfig, INDIAN_STATES, saveShippingConfig, ShippingConfig } from '@/services/shipping';
import { Globe, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const ShippingManager = () => {
    const [config, setConfig] = useState<ShippingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const data = await getShippingConfig();
            setConfig(data);
        } catch (error) {
            toast.error("Failed to load shipping config");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await saveShippingConfig(config);
            toast.success("Shipping configuration saved successfully");
        } catch (error) {
            toast.error("Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    const updateZoneRate = (zone: string, index: number, value: string) => {
        if (!config) return;
        const newRates = { ...config.rateTable };
        const rates = [...newRates[zone]];
        rates[index] = Number(value);
        newRates[zone] = rates;
        setConfig({ ...config, rateTable: newRates });
    };

    const updateExtraCost = (zone: string, value: string) => {
        if (!config) return;
        const newExtra = { ...config.extraPerKg };
        newExtra[zone] = Number(value);
        setConfig({ ...config, extraPerKg: newExtra });
    };

    const toggleStateInZone = (zone: string, state: string) => {
        if (!config) return;
        const newZones = { ...config.zones };
        
        // Remove from all other zones first
        Object.keys(newZones).forEach(z => {
            newZones[z] = newZones[z].filter(s => s !== state);
        });

        // Add to targeted zone
        newZones[zone] = [...newZones[zone], state];
        setConfig({ ...config, zones: newZones });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!config) return null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Globe className="h-5 w-5" /> Shipping Zones & Rates
                </h3>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-md">Rate Table (Weights in kg)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Zone</TableHead>
                                <TableHead>0.5kg</TableHead>
                                <TableHead>1kg</TableHead>
                                <TableHead>2kg</TableHead>
                                <TableHead>3kg</TableHead>
                                <TableHead>5kg</TableHead>
                                <TableHead>Extra /kg (&gt;5kg)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(config.rateTable).map(zone => (
                                <TableRow key={zone}>
                                    <TableCell className="font-bold">{zone}</TableCell>
                                    {[0, 1, 2, 3, 4].map(idx => (
                                        <TableCell key={idx}>
                                            <Input 
                                                type="number" 
                                                value={config.rateTable[zone][idx]} 
                                                onChange={(e) => updateZoneRate(zone, idx, e.target.value)}
                                                className="w-20"
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            value={config.extraPerKg[zone]} 
                                            onChange={(e) => updateExtraCost(zone, e.target.value)}
                                            className="w-24"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(config.zones).map(zone => (
                    <Card key={zone}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Zone {zone} States
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {config.zones[zone].map(state => (
                                    <div key={state} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs flex items-center gap-1">
                                        {state}
                                    </div>
                                ))}
                            </div>
                            <Separator className="my-4" />
                            <div className="space-y-2">
                                <Label className="text-xs">Add State to Zone {zone}</Label>
                                <Select 
                                    onValueChange={(val) => {
                                        if (val) toggleStateInZone(zone, val);
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a state..." />
                                    </SelectTrigger>
                                    <SelectContent className="h-64">
                                        {INDIAN_STATES.filter(s => !config.zones[zone].includes(s)).map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
