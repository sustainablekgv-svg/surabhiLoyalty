import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INDIAN_STATES } from '@/services/shipping';
import { Address } from '@/types/shop';
import { useState } from 'react';

interface AddressFormProps {
  initialData?: Address;
  onSubmit: (address: Address) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const AddressForm = ({ initialData, onSubmit, onCancel, isLoading = false }: AddressFormProps) => {
  const [formData, setFormData] = useState<Address>(initialData || {
    fullName: '',
    mobile: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    landmark: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Address' : 'Add New Address'}</CardTitle>
        <CardDescription>
          {initialData ? 'Update your shipping address details' : 'Add a new shipping address for faster checkout'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                required
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                required
                type="tel"
                value={formData.mobile}
                onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="Enter 10-digit mobile number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              required
              value={formData.street}
              onChange={e => setFormData({ ...formData, street: e.target.value })}
              placeholder="House No, Street Name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                required
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder="Enter city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state}
                onValueChange={val => setFormData({ ...formData, state: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent className="h-64">
                  {INDIAN_STATES.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zipCode">Pincode</Label>
              <Input
                id="zipCode"
                required
                value={formData.zipCode}
                onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                placeholder="Enter 6-digit pincode"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark (Optional)</Label>
              <Input
                id="landmark"
                value={formData.landmark}
                onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                placeholder="Near..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Address'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
