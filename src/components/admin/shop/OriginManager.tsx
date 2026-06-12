import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { statesList } from '@/constants/states';

import { uploadImageToR2 } from '@/services/cloudflare';
interface Origin {
    id: string;
    name: string;
    state?: string;
    stateSlug?: string;
    stateImage?: string;
    zone: string;
}

export const OriginManager = () => {
    const [origins, setOrigins] = useState<Origin[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOrigin, setNewOrigin] = useState('');
    const [newZone, setNewZone] = useState('A');
    const [newState, setNewState] = useState('');
    const [stateImage, setStateImage] = useState('');
    const [selectedImage, setSelectedImage] =useState<File | null>(null);
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
        let uploadedImageUrl = stateImage;

        if (selectedImage) {
            uploadedImageUrl = await uploadImageToR2(
                selectedImage,
                'states'
            );
        }

        const selectedState = statesList.find(
            s => s.name === newState
        );

        if (editingId) {
            await updateDoc(doc(db, 'origins', editingId), {
                name: newOrigin.trim(),
                state: newState,
                stateSlug: selectedState?.slug || '',
                stateImage: uploadedImageUrl,
                zone: newZone
            });

            toast.success("Origin updated");
        } else {
            await addDoc(collection(db, 'origins'), {
                name: newOrigin.trim(),
                state: newState,
                stateSlug: selectedState?.slug || '',
                stateImage: uploadedImageUrl,
                zone: newZone
            });

            toast.success("Origin added");
        }

        resetForm();
        fetchOrigins();

    } catch (error) {
        console.error(error);
        toast.error(
            editingId
                ? "Failed to update origin"
                : "Failed to add origin"
        );
    }
};
    const handleEdit = (origin: Origin) => {
        setNewOrigin(origin.name);
        setNewState(origin.state || '');
        setStateImage(origin.stateImage || '');
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
  setNewState('');
  setStateImage('');
  setSelectedImage(null);
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
    <label className="text-sm font-medium">
        State
    </label>

    <select
        className="w-full border rounded-md p-2 h-10"
        value={newState}
        onChange={(e) => setNewState(e.target.value)}
    >
        <option value="">
            Select State
        </option>

        {statesList.map((state) => (
            <option
                key={state.slug}
                value={state.name}
            >
                {state.name}
            </option>
        ))}
    </select>
</div>
<div className="space-y-2">
  <label className="text-sm font-medium">
    State Image
  </label>

<div className="border-2 border-dashed border-[#D8D2C2] bg-[#FFFDF7] rounded-xl p-5 shadow-sm hover:border-[#C8BFAE] transition-all">
    <input
      type="file"
      accept="image/*"
      className="hidden"
      id="state-image-upload"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          setSelectedImage(file);
        }
      }}
    />

    <label
      htmlFor="state-image-upload"
      className="cursor-pointer flex flex-col items-center justify-center gap-2"
    >
      <div className="text-sm font-medium text-blue-500 bg-color-grey">
  Click to upload state image
  
</div>
      {selectedImage ? (
        <>
          <img
            src={URL.createObjectURL(selectedImage)}
            alt="Preview"
            className="h-24 w-24 rounded-lg object-cover border"
          />
          <span className="text-xs text-green-600">
            {selectedImage.name}
          </span>
            
        </>
      ) : (
        <span className="text-xs text-gray-400">
          No image selected
        </span>
      )}
    </label>
  </div>
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
                           <TableHead>State</TableHead>
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
                                    <TableCell> {origin.state || '-'}</TableCell>
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
