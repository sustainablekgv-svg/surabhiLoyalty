
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ContactUs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
        <div className="space-y-6 text-gray-700">
          <p>We're here to help! Reach out to us via any of the following methods:</p>
          
          <div className="flex items-start gap-4 p-4 border rounded-lg">
             <MapPin className="h-6 w-6 text-purple-600 mt-1" />
             <div>
                 <h3 className="font-semibold">Address</h3>
                 <p>15-158/2 Dhanalakshmi Nagar, M R Palli,<br/>Tirupati, Andhra Pradesh, 517507</p>
             </div>
          </div>

          <div className="flex items-start gap-4 p-4 border rounded-lg">
             <Phone className="h-6 w-6 text-purple-600 mt-1" />
             <div>
                 <h3 className="font-semibold">Phone</h3>
                 <p><a href="tel:9606979530" className="hover:underline">9606979530</a></p>
                 <p className="text-sm text-gray-500">Mon-Fri: 9:00 AM - 6:00 PM</p>
             </div>
          </div>

          <div className="flex items-start gap-4 p-4 border rounded-lg">
             <Mail className="h-6 w-6 text-purple-600 mt-1" />
             <div>
                 <h3 className="font-semibold">Email</h3>
                 <p><a href="mailto:sustainablekgv@gmail.com" className="hover:underline">sustainablekgv@gmail.com</a></p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
