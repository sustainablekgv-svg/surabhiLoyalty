import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Address } from '@/types/shop';
import { Edit2, MapPin, Plus, Trash2 } from 'lucide-react';

interface AddressListProps {
  addresses: Address[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  isLoading?: boolean;
}

export const AddressList = ({ addresses, onAdd, onEdit, onDelete, isLoading = false }: AddressListProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Saved Addresses
          </h2>
          <p className="text-sm text-gray-500">Manage your shipping addresses for faster checkout.</p>
        </div>
        <Button onClick={onAdd} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" /> Add New
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <MapPin className="h-10 w-10 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No addresses saved yet.</p>
            <Button variant="outline" onClick={onAdd}>Add your first address</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address, index) => (
            <Card key={index} className="relative">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{address.fullName}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-blue-600"
                      onClick={() => onEdit(index)}
                      disabled={isLoading}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-600"
                      onClick={() => onDelete(index)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{address.street}</p>
                  <p>{address.city}, {address.state} - {address.zipCode}</p>
                  {address.landmark && <p className="text-xs text-gray-500">Landmark: {address.landmark}</p>}
                  <p className="font-medium text-gray-900 mt-2">Mobile: {address.mobile}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
