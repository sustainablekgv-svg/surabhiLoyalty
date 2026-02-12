import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Origin {
    id: string;
    name: string;
    zone: string;
}

export const OriginManager = () => {
    const [origins, setOrigins] = useState<Origin[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOrigin, setNewOrigin] = useState('');
    const [newZone, setNewZone] = useState('A');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);

    const fetchOrigins = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'origins'), orderBy('name'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Origin));
            setOrigins(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load origins");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrigins();
    }, []);

    const handleSave = async () => {
        if (!newOrigin.trim()) return;
        
        try {
            if (editingId) {
                // Update existing
                await updateDoc(doc(db, 'origins', editingId), {
                    name: newOrigin.trim(),
                    zone: newZone
                });
                toast.success("Origin updated");
            } else {
                // Create new
                await addDoc(collection(db, 'origins'), { 
                    name: newOrigin.trim(),
                    zone: newZone 
                });
                toast.success("Origin added");
            }
            
            resetForm();
            fetchOrigins();
        } catch (error) {
            console.error(error);
            toast.error(editingId ? "Failed to update origin" : "Failed to add origin");
        }
    };

    const handleEdit = (origin: Origin) => {
        setNewOrigin(origin.name);
        setNewZone(origin.zone || 'A');
        setEditingId(origin.id);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await deleteDoc(doc(db, 'origins', id));
            toast.success("Origin deleted");
            fetchOrigins();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete origin");
        }
    };

    const resetForm = () => {
        setNewOrigin('');
        setNewZone('A');
        setEditingId(null);
        setIsDialogOpen(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Place of Origin</h3>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => resetForm()}>
                            <Plus className="h-4 w-4 mr-2" /> Add Origin
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Origin" : "Add Place of Origin"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Place Name</label>
                                <Input 
                                    value={newOrigin} 
                                    onChange={(e) => setNewOrigin(e.target.value)} 
                                    placeholder="e.g. Kashmir, Ooty"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Shipping Zone</label>
                                <select 
                                    className="w-full border rounded-md p-2 h-10"
                                    value={newZone}
                                    onChange={(e) => setNewZone(e.target.value)}
                                >
                                    <option value="A">Zone A (Local/Regional)</option>
                                    <option value="B">Zone B</option>
                                    <option value="C">Zone C</option>
                                    <option value="D">Zone D</option>
                                    <option value="E">Zone E (Remote/Hilly)</option>
                                </select>
                            </div>
                            <Button className="w-full" onClick={handleSave}>
                                {editingId ? "Update Origin" : "Save Origin"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Zone</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow>
                        ) : origins.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center">No origins found</TableCell></TableRow>
                        ) : (
                            origins.map(origin => (
                                <TableRow key={origin.id}>
                                    <TableCell className="font-medium">{origin.name}</TableCell>
                                    <TableCell>Zone {origin.zone || 'A'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(origin)}>
                                                <Edit2 className="h-4 w-4 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(origin.id)}>
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
        </div>
    );
};
