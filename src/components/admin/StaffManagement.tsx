import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  UserPlus, 
  Search, 
  MapPin, 
  Phone, 
  Mail,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface Staff {
  id: string;
  name: string;
  mobile: string;
  email: string;
  storeLocation: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export const StaffManagement = () => {
  const [staff, setStaff] = useState<Staff[]>([
    {
      id: '1',
      name: 'Rajesh Kumar',
      mobile: '9876543210',
      email: 'rajesh@store.com',
      storeLocation: 'Downtown Branch',
      createdAt: '2024-01-15',
      status: 'active'
    },
    {
      id: '2',
      name: 'Priya Sharma',
      mobile: '8765432109',
      email: 'priya@store.com',
      storeLocation: 'Mall Branch',
      createdAt: '2024-02-10',
      status: 'active'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    mobile: '',
    email: '',
    storeLocation: '',
    password: ''
  });

  const storeLocations = [
    'Downtown Branch',
    'Mall Branch',
    'Airport Branch',
    'Central Plaza'
  ];

  const handleAddStaff = () => {
    if (!newStaff.name || !newStaff.mobile || !newStaff.email || !newStaff.storeLocation) {
      toast.error('Please fill all required fields');
      return;
    }

    const staff_member: Staff = {
      id: Date.now().toString(),
      name: newStaff.name,
      mobile: newStaff.mobile,
      email: newStaff.email,
      storeLocation: newStaff.storeLocation,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    setStaff([...staff, staff_member]);
    setNewStaff({ name: '', mobile: '', email: '', storeLocation: '', password: '' });
    setIsAddDialogOpen(false);
    toast.success('Staff member added successfully');
  };

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.mobile.includes(searchTerm) ||
    member.storeLocation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-gray-600">Manage store staff and their permissions</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
              <DialogDescription>
                Create a new staff account for store management
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter staff name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="Enter mobile number"
                  value={newStaff.mobile}
                  onChange={(e) => setNewStaff({ ...newStaff, mobile: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="store">Store Location</Label>
                <Select value={newStaff.storeLocation} onValueChange={(value) => setNewStaff({ ...newStaff, storeLocation: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store location" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeLocations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Set initial password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddStaff} className="flex-1">
                  Add Staff
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <CardTitle>Staff Members</CardTitle>
              <CardDescription>
                {staff.length} staff members across all locations
              </CardDescription>
            </div>
            
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {filteredStaff.map((member) => (
              <div key={member.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-gray-900">{member.name}</h3>
                    <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                      {member.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{member.mobile}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span>{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span>{member.storeLocation}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
